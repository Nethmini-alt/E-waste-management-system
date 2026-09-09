from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
import httpx
import uvicorn

app = FastAPI(title="E-Waste Agentic AI Service")

DOTNET_BACKEND_URL = "http://localhost:5172/api/v1/submissions"

class SubmissionAnalysisRequest(BaseModel):
    submission_id: str
    description: str | None = ""
    image_urls: list[str] = []

async def process_ai_analysis(data: SubmissionAnalysisRequest):
    print(f"Analyzing submission {data.submission_id}...")
    
    # Mock AI Analysis Payload (Matching .NET AIAnalysisDto)
    ai_result = {
        "wasteCategory": "Electronics",
        "hazardLevel": "Medium",
        "estimatedVolumeKg": 2.5,
        "estimatedValueUsd": 15.0,
        "requiresHumanApproval": False
    }

    async with httpx.AsyncClient() as client:
        try:
            callback_url = f"{DOTNET_BACKEND_URL}/{data.submission_id}/ai-callback"
            response = await client.post(callback_url, json=ai_result)
            print(f"Callback status: {response.status_code}")
        except Exception as e:
            print(f"Failed to send callback to .NET backend: {e}")

@app.post("/analyze-submission")
async def analyze_submission(request: SubmissionAnalysisRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(process_ai_analysis, request)
    return {"status": "Processing started", "submissionId": request.submission_id}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)