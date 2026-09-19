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
import MaterialPricingListPage from './features/sales/Pricing/MaterialPricingListPage';
import DashboardPage from './features/sales/Dashboard/DashboardPage';
import MaterialsListPage from './features/sales/Materials/MaterialsListPage';
import SalesOrdersListPage from './features/sales/SalesOrders/SalesOrdersListPage';
import ExportOrdersListPage from './features/sales/ExportOrders/ExportOrdersListPage';
import RevenuePage from './features/sales/Revenue/RevenuePage';

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
          <Route index element={<DashboardPage />} />
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

        <Route
          path="/pricing"
          element={
            <ProtectedRoute roles={['staff', 'admin']}>
              <MaterialPricingListPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/materials"
          element={
            <ProtectedRoute roles={['staff', 'admin']}>
              <MaterialsListPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/sales-orders"
          element={
            <ProtectedRoute roles={['staff', 'admin']}>
              <SalesOrdersListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/export-orders"
          element={
            <ProtectedRoute roles={['staff', 'admin']}>
              <ExportOrdersListPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/revenue"
          element={
            <ProtectedRoute roles={['staff', 'admin']}>
              <RevenuePage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </AuthProvider>
);

export default App;