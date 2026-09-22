import os
import json
import httpx
import uvicorn
import asyncio
import shutil
from fastapi import FastAPI, BackgroundTasks, Form, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

app = FastAPI(title="E-Waste Agentic AI Service")

# Configure CORS to allow Flutter web and mobile requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for testing purposes
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount uploads directory to serve uploaded images statically
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

DOTNET_BACKEND_URL = "http://localhost:5172/api/v1/submissions"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Gemini Client Setup
ai_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

class SubmissionAnalysisRequest(BaseModel):
    submission_id: str
    description: str | None = ""
    image_urls: list[str] = []

async def analyze_with_gemini(description: str, image_url: str | None):
    """Call Gemini Vision model with retry logic for high-demand spikes."""
    if not ai_client:
        print("Warning: GEMINI_API_KEY not found. Falling back to default values.")
        return {
            "wasteCategory": "Electronics",
            "hazardLevel": "Medium",
            "estimatedVolumeKg": 1.0,
            "estimatedValueUsd": 5.0,
            "requiresHumanApproval": False
        }

    prompt = f"""
    You are an expert E-Waste Management Inspector. Analyze this electronic waste item.
    User Description: {description}

    Return a strict raw JSON object with these exact fields:
    - wasteCategory: string (e.g. Household Electronics, Batteries, IT Equipment, Heavy Appliances)
    - hazardLevel: string (Low, Medium, High, Critical)
    - estimatedVolumeKg: float (estimated weight in kilograms)
    - estimatedValueUsd: float (estimated scrap/recycled value in USD)
    - requiresHumanApproval: boolean (true if highly hazardous or illegal, otherwise false)
    """

    # Retry setup for 503 Traffic spikes
    max_retries = 3
    for attempt in range(max_retries):
        try:
            contents = [prompt]
            
            if image_url:
                async with httpx.AsyncClient() as client:
                    img_res = await client.get(image_url, timeout=10.0)
                    if img_res.status_code == 200:
                        image_bytes = img_res.content
                        image_part = types.Part.from_bytes(
                            data=image_bytes,
                            mime_type="image/jpeg"
                        )
                        contents.append(image_part)

            response = ai_client.models.generate_content(
                model='gemini-3.6-flash', # Updated to a stable standard flash model version
                contents=contents,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
            
            # Successfully got response
            return json.loads(response.text)

        except Exception as e:
            print(f"Attempt {attempt + 1} failed: {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(2)  # Wait 2 seconds before retrying
            else:
                print("Max retries reached. Returning default fallback result.")
                return {
                    "wasteCategory": "Uncategorized",
                    "hazardLevel": "Medium",
                    "estimatedVolumeKg": 1.0,
                    "estimatedValueUsd": 0.0,
                    "requiresHumanApproval": True
                }

async def process_ai_analysis(data: SubmissionAnalysisRequest):
    """Background task to run Gemini AI analysis and send callback to .NET backend."""
    print(f"Analyzing submission {data.submission_id} using Gemini AI...")
    
    first_image = data.image_urls[0] if data.image_urls else None
    ai_result = await analyze_with_gemini(data.description or "", first_image)
    
    print(f"AI Result: {ai_result}")

    async with httpx.AsyncClient() as client:
        try:
            callback_url = f"{DOTNET_BACKEND_URL}/{data.submission_id}/ai-callback"
            response = await client.post(callback_url, json=ai_result)
            print(f"Callback status: {response.status_code}")
        except Exception as e:
            print(f"Failed to send callback to .NET backend: {e}")

@app.post("/analyze-submission")
async def analyze_submission(request: SubmissionAnalysisRequest, background_tasks: BackgroundTasks):
    """Endpoint for triggering background AI analysis."""
    background_tasks.add_task(process_ai_analysis, request)
    return {"status": "Processing started", "submissionId": request.submission_id}

# Endpoint to receive pickup requests and uploaded images directly from Flutter mobile app
@app.post("/api/pickup-requests")
async def create_pickup_request(
    category: str = Form(...),
    item_details: str = Form(...),
    estimated_weight: str = Form(...), # Changed to str to prevent type mismatch errors
    address: str = Form(...),
    phone: str = Form(...),
    file: UploadFile | None = File(None)
):
    """Handles multipart form-data submission from Flutter frontend including image file uploads safely."""
    image_url = None
    
    # Save the uploaded image file locally if provided
    if file:
        file_path = os.path.join("uploads", file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Construct accessible URL for the uploaded image
        image_url = f"http://127.0.0.1:8000/uploads/{file.filename}"

    print(f"Received Pickup Request: Category={category}, Item={item_details}, Weight={estimated_weight}kg")

    return {
        "status": "Success",
        "message": "Pickup Request and Image received successfully!",
        "data": {
            "category": category,
            "item_details": item_details,
            "estimated_weight": estimated_weight,
            "address": address,
            "phone": phone,
            "image_url": image_url
        }
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)