import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CheckCircle, AlertTriangle, Cpu, Loader, ShieldAlert, Tag, Weight, DollarSign } from 'lucide-react';

interface AiAnalysis {
  id?: string;
  submissionId?: string;
  wasteCategory: string;
  estimatedVolumeKg: number;
  estimatedValueUsd: number;
  hazardLevel: string;
  requiresHumanApproval: boolean;
  analyzedAt?: string;
}

interface SubmissionItem {
  id?: string;
  submissionId?: string;
  itemName: string;
  description: string;
  imageUrl: string;
}

interface SubmissionResponse {
  id: string;
  userId?: string;
  userType?: string;
  status: string;
  createdAt?: string;
  items?: SubmissionItem[];
  aiAnalysis?: AiAnalysis;
}

const App: React.FC = () => {
  const [description, setDescription] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [submission, setSubmission] = useState<SubmissionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setSubmission(null);
    setError(null);

    const payload = {
      userId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      userType: "Generator",
      items: [
        {
          itemName: "E-Waste Item",
          description: description,
          imageUrl: imageUrl
        }
      ]
    };

    try {
      const res = await axios.post<SubmissionResponse>('http://localhost:5172/api/v1/submissions', payload);
      setSubmission(res.data);
      setPolling(true);
    } catch (err) {
      console.error(err);
      setError('Failed to submit item. Make sure .NET Backend is running on port 5172.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    if (polling && submission?.id) {
      timer = setInterval(async () => {
        try {
          const res = await axios.get<SubmissionResponse>(`http://localhost:5172/api/v1/submissions/${submission.id}`);
          const data = res.data;

          // Checking if aiAnalysis object is present in backend response
          if (data.aiAnalysis || data.status === 'Approved' || data.status === 'Analyzed') {
            setSubmission(data);
            setPolling(false);
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 1500);
    }

    return () => clearInterval(timer);
  }, [polling, submission?.id]);

  return (
    <div style={{ maxWidth: '750px', margin: '40px auto', fontFamily: 'Arial, sans-serif', padding: '20px' }}>
      <h2><Cpu style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Smart E-Waste Collector (TypeScript)</h2>
      <p style={{ color: '#666' }}>Upload e-waste items for instant Gemini Vision AI assessment & hazard categorization.</p>

      <form onSubmit={handleSubmit} style={{ background: '#f9f9f9', padding: '20px', borderRadius: '8px', border: '1px solid #ddd' }}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Item Description:</label>
          <textarea 
            rows={3} 
            style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }} 
            placeholder="e.g. Swollen lithium battery leaking chemical liquid..." 
            value={description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
            required
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Image URL:</label>
          <input 
            type="url" 
            style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }} 
            placeholder="https://example.com/image.jpg" 
            value={imageUrl}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImageUrl(e.target.value)}
            required
          />
        </div>

        <button 
          type="submit" 
          disabled={loading || polling}
          style={{ background: '#2e7d32', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {loading ? 'Submitting...' : polling ? 'Analyzing with Gemini AI...' : 'Submit E-Waste Item'}
        </button>
      </form>

      {error && (
        <div style={{ marginTop: '20px', padding: '15px', background: '#ffebee', color: '#c62828', borderRadius: '4px' }}>
          <AlertTriangle style={{ verticalAlign: 'middle', marginRight: '5px' }} /> {error}
        </div>
      )}

      {submission && (
        <div style={{ marginTop: '20px', padding: '20px', background: '#ffffff', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
          <h3 style={{ color: '#2e7d32', marginTop: 0 }}>
            <CheckCircle style={{ verticalAlign: 'middle', marginRight: '5px' }} /> Submission Recorded
          </h3>
          <p><strong>Submission ID:</strong> <code>{submission.id}</code></p>
          <p><strong>Status:</strong> <span style={{ fontWeight: 'bold', color: '#0288d1' }}>{submission.status}</span></p>

          {polling ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#e65100', background: '#fff3e0', padding: '12px', borderRadius: '6px' }}>
              <Loader className="spin" style={{ animation: 'spin 1s linear infinite' }} />
              <span>Gemini AI is analyzing your image & description... Please wait!</span>
            </div>
          ) : submission.aiAnalysis ? (
            <div style={{ marginTop: '15px', background: '#f1f8e9', padding: '15px', borderRadius: '6px', border: '1px solid #c8e6c9' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#1b5e20' }}>🤖 Gemini AI Assessment Result:</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <p><Tag size={16} /> <strong>Category:</strong> {submission.aiAnalysis.wasteCategory}</p>
                <p><ShieldAlert size={16} /> <strong>Hazard Level:</strong> <span style={{ color: submission.aiAnalysis.hazardLevel === 'Critical' || submission.aiAnalysis.hazardLevel === 'High' ? 'red' : 'green', fontWeight: 'bold' }}>{submission.aiAnalysis.hazardLevel}</span></p>
                <p><Weight size={16} /> <strong>Est. Weight:</strong> {submission.aiAnalysis.estimatedVolumeKg} kg</p>
                <p><DollarSign size={16} /> <strong>Est. Value:</strong> ${submission.aiAnalysis.estimatedValueUsd}</p>
              </div>
              <p style={{ marginTop: '10px', fontWeight: 'bold', color: submission.aiAnalysis.requiresHumanApproval ? '#c62828' : '#2e7d32' }}>
                {submission.aiAnalysis.requiresHumanApproval ? '⚠️ Requires Admin Approval (Hazardous)' : '✅ Auto-Approved for Collection'}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default App;