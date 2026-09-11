import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';

interface Props {
  roles?: string[];
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<Props> = ({ roles, children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <div style={{ padding: 40 }}>Loading…</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (roles && !roles.map((r) => r.toLowerCase()).includes(user.role.toLowerCase())) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};