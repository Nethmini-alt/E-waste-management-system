import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  CheckCircle, AlertTriangle, Cpu, Loader, ShieldAlert, 
  Tag, Weight, DollarSign, LayoutDashboard, Send, XCircle, Check, MapPin, Phone
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
  pickupAddress?: string;
  phoneNumber?: string;
  estimatedWeight?: number;
  category?: string;
  status: string;
  createdAt?: string;
  items?: SubmissionItem[];
  aiAnalysis?: AiAnalysis;
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'user' | 'admin'>('user');

  // User Form States
  const [category, setCategory] = useState<string>('Computers/Laptops');
  const [description, setDescription] = useState<string>('');
  const [estimatedWeight, setEstimatedWeight] = useState<string>('');
  const [pickupAddress, setPickupAddress] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [submission, setSubmission] = useState<SubmissionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState<boolean>(false);

  // Admin Dashboard States
  const [allSubmissions, setAllSubmissions] = useState<SubmissionResponse[]>([]);
  const [adminLoading, setAdminLoading] = useState<boolean>(false);

  const categories: string[] = [
    'Computers/Laptops',
    'Mobile Phones/Tablets',
    'Home Appliances',
    'Batteries & Chargers',
    'Other E-Waste'
  ];

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setSubmission(null);
    setError(null);

    const payload = {
      userId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      userType: "Generator",
      category: category,
      estimatedWeight: parseFloat(estimatedWeight) || 0,
      pickupAddress: pickupAddress,
      phoneNumber: phone,
      items: [
        {
          itemName: category,
          description: description,
          imageUrl: imageUrl || 'https://example.com/default.jpg'
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

  // Fetch All Submissions for Admin Dashboard
  const fetchAdminSubmissions = async () => {
    setAdminLoading(true);
    try {
      const res = await axios.get<SubmissionResponse[]>('http://localhost:5172/api/v1/submissions');
      setAllSubmissions(res.data);
    } catch (err) {
      console.error("Failed to fetch submissions for admin:", err);
    } finally {
      setAdminLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'admin') {
      fetchAdminSubmissions();
    }
  }, [activeTab]);

  // Admin Decision Handler
  const handleAdminDecision = async (id: string, status: 'Approved' | 'Rejected') => {
    try {
      await axios.patch(`http://localhost:5172/api/v1/submissions/${id}/status`, { status });
      fetchAdminSubmissions();
    } catch (err) {
      console.error(`Failed to update status to ${status}`, err);
      fetchAdminSubmissions();
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f8fafc', 
      color: '#1e293b', 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '40px 20px'
    }}>
      <div style={{ maxWidth: '850px', margin: '0 auto' }}>
        
        {/* Navigation Bar */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '15px', 
          marginBottom: '35px', 
          background: '#ffffff', 
          padding: '8px', 
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 15px rgba(0,0,0,0.05)'
        }}>
          <button 
            onClick={() => setActiveTab('user')}
            style={{ 
              padding: '12px 24px', 
              borderRadius: '10px', 
              border: 'none', 
              cursor: 'pointer', 
              fontWeight: '600',
              fontSize: '14px',
              transition: 'all 0.3s ease',
              background: activeTab === 'user' ? 'linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)' : 'transparent',
              color: activeTab === 'user' ? '#ffffff' : '#64748b',
              display: 'flex', alignItems: 'center', gap: '8px',
              boxShadow: activeTab === 'user' ? '0 4px 12px rgba(45, 106, 79, 0.3)' : 'none'
            }}
          >
            <Send size={18} /> User Submission
          </button>

          <button 
            onClick={() => setActiveTab('admin')}
            style={{ 
              padding: '12px 24px', 
              borderRadius: '10px', 
              border: 'none', 
              cursor: 'pointer', 
              fontWeight: '600',
              fontSize: '14px',
              transition: 'all 0.3s ease',
              background: activeTab === 'admin' ? 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)' : 'transparent',
              color: activeTab === 'admin' ? '#ffffff' : '#64748b',
              display: 'flex', alignItems: 'center', gap: '8px',
              boxShadow: activeTab === 'admin' ? '0 4px 12px rgba(37, 99, 235, 0.3)' : 'none'
            }}
          >
            <LayoutDashboard size={18} /> Admin Approval Panel
          </button>
        </div>

        {/* USER SUBMISSION TAB */}
        {activeTab === 'user' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
              <div style={{ display: 'inline-flex', padding: '12px', background: '#e8f5e9', borderRadius: '50%', color: '#2d6a4f', marginBottom: '10px', border: '1px solid #c8e6c9' }}>
                <Cpu size={28} />
              </div>
              <h1 style={{ margin: '0 0 8px 0', fontSize: '26px', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.5px' }}>Smart E-Waste Collector</h1>
              <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Upload e-waste items for instant Gemini Vision AI assessment & hazard categorization.</p>
            </div>

            <form onSubmit={handleSubmit} style={{ 
              background: '#ffffff', 
              padding: '30px', 
              borderRadius: '20px', 
              border: '1px solid #e2e8f0',
              boxShadow: '0 10px 30px rgba(0,0,0,0.04)'
            }}>
              
              {/* Category Dropdown */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>E-Waste Category</label>
                <select 
                  value={category} 
                  onChange={(e) => setCategory(e.target.value)}
                  style={{ 
                    width: '100%', padding: '12px 16px', borderRadius: '10px', 
                    border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a',
                    fontSize: '14px', outline: 'none', cursor: 'pointer'
                  }}
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Item Description */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Item Description</label>
                <textarea 
                  rows={3} 
                  style={{ 
                    width: '100%', padding: '12px 16px', borderRadius: '10px', 
                    border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a',
                    fontSize: '14px', outline: 'none', resize: 'vertical', boxSizing: 'border-box'
                  }} 
                  placeholder="e.g. Swollen lithium battery leaking chemical liquid..." 
                  value={description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                  required
                />
              </div>

              {/* Estimated Weight */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Estimated Weight (kg)</label>
                <input 
                  type="number" 
                  step="0.1"
                  style={{ 
                    width: '100%', padding: '12px 16px', borderRadius: '10px', 
                    border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a',
                    fontSize: '14px', outline: 'none', boxSizing: 'border-box'
                  }} 
                  placeholder="e.g. 2.5" 
                  value={estimatedWeight}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEstimatedWeight(e.target.value)}
                  required
                />
              </div>

              {/* Pickup Address */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pickup Address</label>
                <textarea 
                  rows={2} 
                  style={{ 
                    width: '100%', padding: '12px 16px', borderRadius: '10px', 
                    border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a',
                    fontSize: '14px', outline: 'none', resize: 'vertical', boxSizing: 'border-box'
                  }} 
                  placeholder="e.g. No. 123, Main Street, Kurunegala" 
                  value={pickupAddress}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPickupAddress(e.target.value)}
                  required
                />
              </div>

              {/* Phone Number */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contact Phone Number</label>
                <input 
                  type="tel" 
                  style={{ 
                    width: '100%', padding: '12px 16px', borderRadius: '10px', 
                    border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a',
                    fontSize: '14px', outline: 'none', boxSizing: 'border-box'
                  }} 
                  placeholder="e.g. 0766984838" 
                  value={phone}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
                  required
                />
              </div>

              {/* Image URL */}
              <div style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Image URL</label>
                <input 
                  type="url" 
                  style={{ 
                    width: '100%', padding: '12px 16px', borderRadius: '10px', 
                    border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a',
                    fontSize: '14px', outline: 'none', boxSizing: 'border-box'
                  }} 
                  placeholder="https://example.com/image.jpg" 
                  value={imageUrl}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImageUrl(e.target.value)}
                  required
                />
              </div>

              <button 
                type="submit" 
                disabled={loading || polling}
                style={{ 
                  background: 'linear-gradient(135deg, #2d6a4f 0%, #1b4332 100%)', 
                  color: '#ffffff', border: 'none', padding: '14px 20px', 
                  borderRadius: '12px', cursor: 'pointer', fontWeight: '700', fontSize: '15px', 
                  width: '100%', boxShadow: '0 4px 15px rgba(45, 106, 79, 0.3)',
                  transition: 'transform 0.2s ease'
                }}
              >
                {loading ? 'Submitting...' : polling ? 'Analyzing with Gemini AI...' : 'Submit E-Waste Item'}
              </button>
            </form>

            {error && (
              <div style={{ marginTop: '20px', padding: '15px 20px', background: '#fef2f2', color: '#dc2626', borderRadius: '12px', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertTriangle size={20} /> {error}
              </div>
            )}

            {/* RESULT CARD */}
            {submission && (
              <div style={{ 
                marginTop: '30px', 
                padding: '28px', 
                background: '#ffffff', 
                border: '1px solid #cbd5e1', 
                borderRadius: '20px', 
                boxShadow: '0 15px 35px rgba(0,0,0,0.06)',
                color: '#1e293b'
              }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: '#e8f5e9', padding: '10px', borderRadius: '12px', border: '1px solid #c8e6c9', color: '#2d6a4f' }}>
                      <CheckCircle size={24} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, color: '#0f172a', fontSize: '18px', fontWeight: '700' }}>Submission Recorded</h3>
                      <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#64748b' }}>ID: {submission.id}</span>
                    </div>
                  </div>
                  <span style={{ 
                    background: '#fef3c7', 
                    border: '1px solid #f59e0b', 
                    color: '#92400e', 
                    padding: '6px 14px', 
                    borderRadius: '20px', 
                    fontSize: '12px', 
                    fontWeight: '700',
                    letterSpacing: '0.5px'
                  }}>
                    {submission.status}
                  </span>
                </div>

                {/* Details Grid */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr', 
                  gap: '14px', 
                  background: '#f8fafc', 
                  padding: '16px', 
                  borderRadius: '14px', 
                  border: '1px solid #e2e8f0',
                  marginBottom: '20px',
                  fontSize: '14px'
                }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Category</span>
                    <strong style={{ color: '#0f172a', fontSize: '15px' }}>{submission.category || category}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Est. Weight</span>
                    <strong style={{ color: '#2d6a4f', fontSize: '15px' }}>{submission.estimatedWeight || estimatedWeight} kg</strong>
                  </div>
                  <div style={{ gridColumn: 'span 2', borderTop: '1px solid #e2e8f0', paddingTop: '10px', marginTop: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Pickup Address</span>
                    <span style={{ color: '#334155' }}>{submission.pickupAddress || pickupAddress}</span>
                  </div>
                </div>

                {/* Gemini AI Section */}
                {polling ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#92400e', background: '#fef3c7', padding: '16px', borderRadius: '14px', border: '1px solid #fcd34d' }}>
                    <Loader className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                    <span style={{ fontWeight: '600', fontSize: '14px' }}>Gemini AI is analyzing your image & description... Please wait!</span>
                  </div>
                ) : submission.aiAnalysis ? (
                  <div style={{ 
                    background: '#f0fdf4', 
                    padding: '20px', 
                    borderRadius: '16px', 
                    border: '1px solid #bbf7d0' 
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                      <span style={{ fontSize: '18px' }}>🤖</span>
                      <h4 style={{ margin: 0, color: '#166534', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: '700' }}>Gemini AI Assessment Result</h4>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px', marginBottom: '16px' }}>
                      <div style={{ background: '#ffffff', padding: '12px', borderRadius: '10px', border: '1px solid #dcfce7' }}>
                        <span style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '3px' }}>AI Category</span>
                        <strong style={{ color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}><Tag size={14} color="#2d6a4f" /> {submission.aiAnalysis.wasteCategory}</strong>
                      </div>

                      <div style={{ background: '#ffffff', padding: '12px', borderRadius: '10px', border: '1px solid #dcfce7' }}>
                        <span style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '3px' }}>Hazard Level</span>
                        <strong style={{ color: submission.aiAnalysis.hazardLevel === 'High' || submission.aiAnalysis.hazardLevel === 'Critical' ? '#c2410c' : '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <ShieldAlert size={14} /> {submission.aiAnalysis.hazardLevel}
                        </strong>
                      </div>

                      <div style={{ background: '#ffffff', padding: '12px', borderRadius: '10px', border: '1px solid #dcfce7' }}>
                        <span style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '3px' }}>Est. Volume</span>
                        <strong style={{ color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}><Weight size={14} color="#2d6a4f" /> {submission.aiAnalysis.estimatedVolumeKg} kg</strong>
                      </div>

                      <div style={{ background: '#ffffff', padding: '12px', borderRadius: '10px', border: '1px solid #dcfce7' }}>
                        <span style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '3px' }}>Est. Value</span>
                        <strong style={{ color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}><DollarSign size={14} /> ${submission.aiAnalysis.estimatedValueUsd}</strong>
                      </div>
                    </div>

                    <div style={{ 
                      textAlign: 'center', 
                      padding: '10px', 
                      borderRadius: '10px', 
                      fontSize: '13px', 
                      fontWeight: '700',
                      background: submission.aiAnalysis.requiresHumanApproval ? '#fef3c7' : '#dcfce7',
                      border: `1px solid ${submission.aiAnalysis.requiresHumanApproval ? '#f59e0b' : '#86efac'}`,
                      color: submission.aiAnalysis.requiresHumanApproval ? '#92400e' : '#166534'
                    }}>
                      {submission.aiAnalysis.requiresHumanApproval ? '⚠️ Requires Admin Approval (Hazardous Material)' : '✨ Auto-Approved for Collection'}
                    </div>
                  </div>
                ) : null}

              </div>
            )}
          </div>
        )}

        {/* ADMIN APPROVAL DASHBOARD TAB */}
        {activeTab === 'admin' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
              <div style={{ display: 'inline-flex', padding: '12px', background: '#eff6ff', borderRadius: '50%', color: '#2563eb', marginBottom: '10px', border: '1px solid #bfdbfe' }}>
                <LayoutDashboard size={28} />
              </div>
              <h1 style={{ margin: '0 0 8px 0', fontSize: '26px', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.5px' }}>Admin E-Waste Review Panel</h1>
              <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Review hazardous items flagged by Gemini AI and approve/reject collection requests.</p>
            </div>

            {adminLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Loading submissions list...</div>
            ) : allSubmissions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', color: '#64748b' }}>
                No e-waste submissions found in database.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {allSubmissions.map((sub) => {
                  const item = sub.items?.[0];
                  const ai = sub.aiAnalysis;

                  return (
                    <div key={sub.id} style={{ 
                      background: '#ffffff', 
                      border: '1px solid #e2e8f0', 
                      borderRadius: '16px', 
                      padding: '20px', 
                      display: 'flex', 
                      gap: '20px', 
                      alignItems: 'center', 
                      boxShadow: '0 6px 20px rgba(0,0,0,0.04)' 
                    }}>
                      {item?.imageUrl && (
                        <img src={item.imageUrl} alt="E-Waste" onError={(e) => {e.currentTarget.src = 'https://placehold.co/90x90/f1f5f9/64748b?text=No+Image'; 
    }}style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: '12px', border: '1px solid #cbd5e1' }} />
                      )}
                      
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <h4 style={{ margin: 0, color: '#0f172a', fontSize: '16px', fontWeight: '700' }}>{item?.itemName || sub.category || 'E-Waste Item'}</h4>
                          <span style={{ fontSize: '11px', background: '#f1f5f9', color: '#64748b', padding: '3px 8px', borderRadius: '6px', fontFamily: 'monospace' }}>ID: {sub.id?.substring(0, 8)}...</span>
                        </div>
                        <p style={{ margin: '0 0 8px 0', color: '#475569', fontSize: '13px' }}>"{item?.description}"</p>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px', fontSize: '13px' }}>
                          <span style={{ color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <MapPin size={13} color="#2d6a4f" /> <strong>Pickup:</strong> {sub.pickupAddress || 'Not Provided'}
                          </span>
                          <span style={{ color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Phone size={13} color="#2563eb" /> <strong>Phone:</strong> {sub.phoneNumber || 'Not Provided'}
                          </span>
                        </div>
                        
                        {ai ? (
                          <div style={{ fontSize: '12px', background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', display: 'flex', gap: '15px', border: '1px solid #e2e8f0' }}>
                            <span><strong>Category:</strong> <span style={{ color: '#334155' }}>{ai.wasteCategory}</span></span>
                            <span><strong>Hazard:</strong> <span style={{ color: ai.hazardLevel === 'High' || ai.hazardLevel === 'Critical' ? '#c2410c' : '#166534', fontWeight: '700' }}>{ai.hazardLevel}</span></span>
                            <span><strong>Value:</strong> <span style={{ color: '#166534' }}>${ai.estimatedValueUsd}</span></span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#d97706' }}>Pending AI Analysis...</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end', minWidth: '120px' }}>
                        <span style={{ 
                          fontWeight: '700', 
                          padding: '5px 12px', 
                          borderRadius: '20px', 
                          fontSize: '11px',
                          letterSpacing: '0.5px',
                          background: sub.status === 'Approved' ? '#dcfce7' : sub.status === 'Rejected' ? '#fee2e2' : '#fef3c7',
                          color: sub.status === 'Approved' ? '#166534' : sub.status === 'Rejected' ? '#991b1b' : '#92400e',
                          border: `1px solid ${sub.status === 'Approved' ? '#86efac' : sub.status === 'Rejected' ? '#fca5a5' : '#fcd34d'}`
                        }}>
                          {sub.status}
                        </span>

                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button 
                            onClick={() => handleAdminDecision(sub.id, 'Approved')}
                            style={{ background: '#059669', color: '#fff', border: 'none', padding: '7px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '600' }}
                          >
                            <Check size={13} /> Approve
                          </button>
                          <button 
                            onClick={() => handleAdminDecision(sub.id, 'Rejected')}
                            style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '7px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '600' }}
                          >
                            <XCircle size={13} /> Reject
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
    </div>
  );
};

export default App;