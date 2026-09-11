/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './features/auth/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';

import LoginPage from './features/auth/LoginPage';
import SubmitPage from './features/submissions/SubmitPage';
import AdminReviewPage from './features/submissions/AdminReviewPage';

import BuyersListPage from './features/sales/Buyers/BuyersListPage';

import RegisterPage from './features/auth/RegisterPage';
import RegisterBuyerPage from './features/auth/RegisterBuyerPage';

const App: React.FC = () => (
  <AuthProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/register/buyer" element={<RegisterBuyerPage />} />

        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/submissions/new" replace />} />
          <Route path="/submissions/new" element={<SubmitPage />} />
          <Route
            path="/submissions/review"
            element={
              <ProtectedRoute roles={['admin']}>
                <AdminReviewPage />
              </ProtectedRoute>
            }
          />

          {/* Component D */}
          <Route
            path="/buyers"
            element={
              <ProtectedRoute roles={['staff', 'admin']}>
                <BuyersListPage />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </AuthProvider>
);

export default App;