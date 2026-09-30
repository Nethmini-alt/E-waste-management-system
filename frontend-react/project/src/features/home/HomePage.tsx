import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { HOME_DASHBOARD_KEY } from '../../components/navigation';
import CustomerHomePage from './CustomerHomePage';

const STAFF_DASHBOARDS = ['/processing', '/dashboard/sales'];

const preferredDashboard = () => {
  try {
    const saved = localStorage.getItem(HOME_DASHBOARD_KEY);
    if (saved && STAFF_DASHBOARDS.includes(saved)) return saved;
  } catch {
    // storage unavailable: use the default
  }
  return STAFF_DASHBOARDS[0];
};

// The index route ("/") is shared by every role. Staff/admin go to the dashboard they used last
// (processing or sales, switchable with the tabs at the top); household/corporate get a simple
// home with their own submissions — they don't have access to the staff dashboards' endpoints.
const HomePage: React.FC = () => {
  const { user } = useAuth() as unknown as { user: { role: string } | null };
  const isStaff = user && ['staff', 'admin'].includes(user.role.toLowerCase());
  return isStaff ? <Navigate to={preferredDashboard()} replace /> : <CustomerHomePage />;
};

export default HomePage;
