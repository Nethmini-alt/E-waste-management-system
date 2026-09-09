import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  CheckCircle, AlertTriangle, Cpu, Loader, ShieldAlert, 
  Tag, Weight, DollarSign, LayoutDashboard, Send, XCircle, Check, Search, Filter
} from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'user' | 'admin'>('user');

  // User Form States
  const [description, setDescription] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [submission, setSubmission] = useState<SubmissionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState<boolean>(false);

  // Admin Dashboard States
  const [allSubmissions, setAllSubmissions] = useState<SubmissionResponse[]>([]);
  const [adminLoading, setAdminLoading] = useState<boolean>(false);

  // Admin Filter & Search States
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [selectedHazard, setSelectedHazard] = useState<string>('All');

  // Handle Form Submission
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

  // Real-Time Polling for User View
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    if (polling && submission?.id) {
      timer = setInterval(async () => {
        try {
          const res = await axios.get<SubmissionResponse>(`http://localhost:5172/api/v1/submissions/${submission.id}`);
          const data = res.data;

          const hasAi = data.aiAnalysis || (data as any).aIAnalysis;
          if (hasAi || data.status === 'Approved' || data.status === 'Analyzed') {
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

  // Fetch All Submissions for Admin Dashboard
  const fetchAdminSubmissions = async () => {
    setAdminLoading(true);
    try {
      const res = await axios.get('http://localhost:5172/api/v1/submissions');
      const responseData = res.data;

      if (Array.isArray(responseData)) {
        setAllSubmissions(responseData);
      } else if (responseData && Array.isArray(responseData.data)) {
        setAllSubmissions(responseData.data);
      } else if (responseData && Array.isArray(responseData.items)) {
        setAllSubmissions(responseData.items);
      } else {
        setAllSubmissions([]);
      }
    } catch (err) {
      console.error("Failed to fetch submissions for admin:", err);
      setAllSubmissions([]);
    } finally {
      setAdminLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminSubmissions();
  }, []);

  // Admin Decision Handler (Approve / Reject)
  const handleAdminDecision = async (id: string, status: 'Approved' | 'Rejected') => {
    try {
      await axios.patch(`http://localhost:5172/api/v1/submissions/${id}/status`, { status });
      fetchAdminSubmissions();
    } catch (err) {
      console.error(`Failed to update status to ${status}`, err);
      fetchAdminSubmissions();
    }
  };

  // Filter Submissions Logic
  const filteredSubmissions = allSubmissions.filter((sub) => {
    const item = sub.items?.[0] || (sub as any).Items?.[0];
    const ai = sub.aiAnalysis || (sub as any).aIAnalysis || (sub as any).AiAnalysis;

    const desc = (item?.description || item?.Description || '').toLowerCase();
    const itemName = (item?.itemName || item?.ItemName || '').toLowerCase();
    const category = (ai?.wasteCategory || ai?.WasteCategory || '').toLowerCase();
    const matchesSearch = desc.includes(searchTerm.toLowerCase()) || 
                          itemName.includes(searchTerm.toLowerCase()) || 
                          category.includes(searchTerm.toLowerCase()) ||
                          sub.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = selectedStatus === 'All' || sub.status === selectedStatus;
    
    const hazard = ai?.hazardLevel || ai?.HazardLevel || 'Unknown';
    const matchesHazard = selectedHazard === 'All' || hazard === selectedHazard;

    return matchesSearch && matchesStatus && matchesHazard;
  });

  return (
    <div style={{ maxWidth: '900px', margin: '30px auto', fontFamily: 'Arial, sans-serif', padding: '20px' }}>
      
      {/* Navigation Bar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', borderBottom: '2px solid #ddd', paddingBottom: '10px' }}>
        <button 
          onClick={() => setActiveTab('user')}
          style={{ 
            padding: '10px 20px', 
            borderRadius: '6px', 
            border: 'none', 
            cursor: 'pointer', 
            fontWeight: 'bold',
            background: activeTab === 'user' ? '#2e7d32' : '#e0e0e0',
            color: activeTab === 'user' ? '#fff' : '#333',
            display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          <Send size={18} /> User Submission
        </button>

        <button 
          onClick={() => {
            setActiveTab('admin');
            fetchAdminSubmissions();
          }}
          style={{ 
            padding: '10px 20px', 
            borderRadius: '6px', 
            border: 'none', 
            cursor: 'pointer', 
            fontWeight: 'bold',
            background: activeTab === 'admin' ? '#1565c0' : '#e0e0e0',
            color: activeTab === 'admin' ? '#fff' : '#333',
            display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          <LayoutDashboard size={18} /> Admin Approval Panel
        </button>
      </div>

      {/* USER SUBMISSION TAB */}
      {activeTab === 'user' && (
        <div>
          <h2><Cpu style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Smart E-Waste Collector</h2>
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
              ) : (submission.aiAnalysis || (submission as any).aIAnalysis) ? (
                (() => {
                  const ai = submission.aiAnalysis || (submission as any).aIAnalysis;
                  return (
                    <div style={{ marginTop: '15px', background: '#f1f8e9', padding: '15px', borderRadius: '6px', border: '1px solid #c8e6c9' }}>
                      <h4 style={{ margin: '0 0 10px 0', color: '#1b5e20' }}>🤖 Gemini AI Assessment Result:</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <p><Tag size={16} /> <strong>Category:</strong> {ai.wasteCategory}</p>
                        <p><ShieldAlert size={16} /> <strong>Hazard Level:</strong> <span style={{ color: ai.hazardLevel === 'Critical' || ai.hazardLevel === 'High' ? 'red' : 'green', fontWeight: 'bold' }}>{ai.hazardLevel}</span></p>
                        <p><Weight size={16} /> <strong>Est. Weight:</strong> {ai.estimatedVolumeKg} kg</p>
                        <p><DollarSign size={16} /> <strong>Est. Value:</strong> ${ai.estimatedValueUsd}</p>
                      </div>
                      <p style={{ marginTop: '10px', fontWeight: 'bold', color: ai.requiresHumanApproval ? '#c62828' : '#2e7d32' }}>
                        {ai.requiresHumanApproval ? '⚠️ Requires Admin Approval (Hazardous)' : '✅ Auto-Approved for Collection'}
                      </p>
                    </div>
                  );
                })()
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* ADMIN APPROVAL DASHBOARD TAB */}
      {activeTab === 'admin' && (
        <div>
          <h2><LayoutDashboard style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Admin E-Waste Review Panel</h2>
          <p style={{ color: '#666' }}>Review hazardous items flagged by Gemini AI and approve/reject collection requests.</p>

          {/* SEARCH & FILTER CONTROLS */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', background: '#f5f5f5', padding: '12px', borderRadius: '8px' }}>
            <div style={{ flex: 2, minWidth: '200px', display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #ccc', borderRadius: '4px', padding: '0 8px' }}>
              <Search size={18} color="#888" />
              <input 
                type="text" 
                placeholder="Search by description, ID or category..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ border: 'none', padding: '8px', width: '100%', outline: 'none' }}
              />
            </div>

            <div style={{ flex: 1, minWidth: '140px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Filter size={16} color="#555" />
              <select 
                value={selectedStatus} 
                onChange={(e) => setSelectedStatus(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              >
                <option value="All">All Statuses</option>
                <option value="Pending_Approval">Pending Approval</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            <div style={{ flex: 1, minWidth: '140px' }}>
              <select 
                value={selectedHazard} 
                onChange={(e) => setSelectedHazard(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              >
                <option value="All">All Hazard Levels</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
          </div>

          {adminLoading ? (
            <p>Loading submissions list...</p>
          ) : filteredSubmissions.length === 0 ? (
            <p style={{ color: '#777' }}>No submissions matched your search/filter criteria.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {filteredSubmissions.map((sub) => {
                const item = sub.items?.[0] || (sub as any).Items?.[0];
                const ai = sub.aiAnalysis || (sub as any).aIAnalysis || (sub as any).AiAnalysis;
                const imgUrl = item?.imageUrl || item?.ImageUrl || item?.image_url;

                return (
                  <div key={sub.id} style={{ background: '#fff', border: '1px solid #ddd', borderRadius: '8px', padding: '15px', display: 'flex', gap: '15px', alignItems: 'center' }}>
                    
                    <div style={{ width: '100px', height: '100px', borderRadius: '6px', overflow: 'hidden', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid #eee' }}>
                      {imgUrl ? (
                        <img 
                          src={imgUrl} 
                          alt={item?.itemName || "E-Waste"} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).onerror = null;
                            (e.target as HTMLImageElement).src = 'https://placehold.co/100x100?text=E-Waste';
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: '11px', color: '#888' }}>No Image</span>
                      )}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <h4 style={{ margin: '0 0 5px 0' }}>{item?.itemName || item?.ItemName || 'E-Waste Item'}</h4>
                        <span style={{ fontSize: '12px', background: '#eee', padding: '3px 8px', borderRadius: '4px' }}>ID: {sub.id.substring(0, 8)}...</span>
                      </div>
                      <p style={{ margin: '0 0 8px 0', color: '#555', fontSize: '14px' }}>"{item?.description || item?.Description}"</p>
                      
                      {ai ? (
                        <div style={{ fontSize: '13px', background: '#f5f5f5', padding: '8px', borderRadius: '4px', display: 'flex', gap: '15px' }}>
                          <span><strong>Category:</strong> {ai.wasteCategory || ai.WasteCategory}</span>
                          <span><strong>Hazard:</strong> <span style={{ color: (ai.hazardLevel || ai.HazardLevel) === 'High' || (ai.hazardLevel || ai.HazardLevel) === 'Critical' ? 'red' : 'green', fontWeight: 'bold' }}>{ai.hazardLevel || ai.HazardLevel}</span></span>
                          <span><strong>Value:</strong> ${ai.estimatedValueUsd ?? ai.EstimatedValueUsd}</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#e65100' }}>Pending AI Analysis...</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                      <span style={{ 
                        fontWeight: 'bold', 
                        padding: '4px 10px', 
                        borderRadius: '4px', 
                        fontSize: '12px',
                        background: sub.status === 'Approved' ? '#e8f5e9' : sub.status === 'Rejected' ? '#ffebee' : '#fff3e0',
                        color: sub.status === 'Approved' ? '#2e7d32' : sub.status === 'Rejected' ? '#c62828' : '#e65100'
                      }}>
                        {sub.status}
                      </span>

                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button 
                          onClick={() => handleAdminDecision(sub.id, 'Approved')}
                          style={{ background: '#2e7d32', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
                        >
                          <Check size={14} /> Approve
                        </button>
                        <button 
                          onClick={() => handleAdminDecision(sub.id, 'Rejected')}
                          style={{ background: '#c62828', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
                        >
                          <XCircle size={14} /> Reject
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default App;