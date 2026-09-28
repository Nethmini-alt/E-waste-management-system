import React from 'react';
import { useAuth } from '../auth/AuthContext';
import DashboardPage from '../sales/Dashboard/DashboardPage';
import CustomerHomePage from './CustomerHomePage';

// The index route ("/") is shared by every role. Staff/admin get the
// commercial dashboard (buyers, pricing, revenue); household/corporate
// get a simple home with their own submissions and quick actions instead —
// they don't have access to the commercial endpoints the dashboard calls.
const HomePage: React.FC = () => {
  const { user } = useAuth() as unknown as { user: { role: string } | null };
  const isStaff = user && ['staff', 'admin'].includes(user.role.toLowerCase());
  return isStaff ? <DashboardPage /> : <CustomerHomePage />;
};

export default HomePage;
