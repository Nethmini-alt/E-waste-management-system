import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import {
  LayoutDashboard, Users, Tag, ShoppingCart, Ship, DollarSign,
  Bot, CheckSquare, Package, LogOut, Send,
} from 'lucide-react';

const linkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
  padding: '10px 14px',
  textDecoration: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  borderRadius: 6,
  marginBottom: 4,
  background: isActive ? '#1565c0' : 'transparent',
  color: isActive ? '#fff' : '#333',
  fontSize: 14,
});

export const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const isStaff = user && ['staff', 'admin'].includes(user.role.toLowerCase());
  const isAdmin = user?.role.toLowerCase() === 'admin';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      {/* Sidebar */}
      <aside style={{
        width: 240, background: '#f5f5f5', padding: 15,
        borderRight: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column',
      }}>
        <h3 style={{ marginTop: 0, marginBottom: 20 }}>E-Waste Mgmt</h3>

        <nav style={{ flex: 1 }}>
          <NavLink to="/" end style={linkStyle}>
            <LayoutDashboard size={16} /> Dashboard
          </NavLink>

          {/* Existing submissions pages */}
          <NavLink to="/submissions/new" style={linkStyle}>
            <Send size={16} /> Submit Item
          </NavLink>

          {isStaff && (
            <>
              <div style={sectionLabel}>Component D</div>
              <NavLink to="/materials" style={linkStyle}><Package size={16} /> Recovered Materials</NavLink>
              <NavLink to="/pricing" style={linkStyle}><Tag size={16} /> Pricing</NavLink>
              <NavLink to="/buyers" style={linkStyle}><Users size={16} /> Buyers</NavLink>
              <NavLink to="/sales-orders" style={linkStyle}><ShoppingCart size={16} /> Sales Orders</NavLink>
              <NavLink to="/export-orders" style={linkStyle}><Ship size={16} /> Export Orders</NavLink>
              <NavLink to="/revenue" style={linkStyle}><DollarSign size={16} /> Revenue</NavLink>
              <NavLink to="/plans" style={linkStyle}><Bot size={16} /> AI Plans</NavLink>
            </>
          )}

          {isAdmin && (
            <>
              <div style={sectionLabel}>Admin</div>
              <NavLink to="/submissions/review" style={linkStyle}>
                <CheckSquare size={16} /> Submissions Review
              </NavLink>
              <NavLink to="/approvals" style={linkStyle}>
                <CheckSquare size={16} /> Commercial Approvals
              </NavLink>
            </>
          )}
        </nav>

        {/* User footer */}
        <div style={{ borderTop: '1px solid #ddd', paddingTop: 12, marginTop: 12 }}>
          <div style={{ fontSize: 13, marginBottom: 8 }}>
            <strong>{user?.fullName}</strong>
            <div style={{ color: '#666', textTransform: 'capitalize' }}>{user?.role}</div>
          </div>
          <button
            onClick={logout}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',color:'black',
              cursor: 'pointer', background: 'transparent', border: '1px solid #0a0a0a',
              borderRadius: 6, fontSize: 13,
            }}
          >
            <LogOut size={14} /> Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, padding: 25, background: '#fafafa' }}>
        <Outlet />
      </main>
    </div>
  );
};

const sectionLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 'bold', color: '#888',
  marginTop: 15, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5,
};