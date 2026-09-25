import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './features/auth/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';

import LandingPage from './features/landing/LandingPage';
import LoginPage from './features/auth/LoginPage';
import RegisterPage from './features/auth/RegisterPage';
import RegisterBuyerPage from './features/auth/RegisterBuyerPage';

import SubmitPage from './features/submissions/SubmitPage';
import AdminReviewPage from './features/submissions/AdminReviewPage';

import DashboardPage from './features/sales/Dashboard/DashboardPage';
import BuyersListPage from './features/sales/Buyers/BuyersListPage';
import MaterialPricingListPage from './features/sales/Pricing/MaterialPricingListPage';
import MaterialsListPage from './features/sales/Materials/MaterialsListPage';
import SalesOrdersListPage from './features/sales/SalesOrders/SalesOrdersListPage';
import ExportOrdersListPage from './features/sales/ExportOrders/ExportOrdersListPage';
import RevenuePage from './features/sales/Revenue/RevenuePage';
import PlansListPage from './features/sales/Approvals/PlansListPage';
import PlanDetailPage from './features/sales/Approvals/PlanDetailPage';
import ApprovalsPage from './features/sales/Approvals/ApprovalsPage';

import ProcessingRoutes from './features/processing/ProcessingRoutes';

const App: React.FC = () => (
  <AuthProvider>
    <BrowserRouter>
      <Routes>
        {/* Public marketing / auth pages */}
        <Route path="/welcome" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/register/buyer" element={<RegisterBuyerPage />} />

        {/* Authenticated app shell — everything below shares the sidebar */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />

          {/* Component C — Submission */}
          <Route path="/submissions/new" element={<SubmitPage />} />
          <Route
            path="/submissions/review"
            element={
              <ProtectedRoute roles={['admin']}>
                <AdminReviewPage />
              </ProtectedRoute>
            }
          />

          {/* Component D — Sales */}
          <Route
            path="/buyers"
            element={
              <ProtectedRoute roles={['staff', 'admin']}>
                <BuyersListPage />
              </ProtectedRoute>
            }
          />
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
          <Route
            path="/plans"
            element={
              <ProtectedRoute roles={['staff', 'admin']}>
                <PlansListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/plans/:id"
            element={
              <ProtectedRoute roles={['staff', 'admin']}>
                <PlanDetailPage />
              </ProtectedRoute>
            }
          />

          {/* Component B — Processing: dashboard, receive, inventory (+ item detail), payments */}
          <Route
            path="/processing/*"
            element={
              <ProtectedRoute roles={['staff', 'admin']}>
                <ProcessingRoutes />
              </ProtectedRoute>
            }
          />

          {/* Admin */}
          <Route
            path="/approvals"
            element={
              <ProtectedRoute roles={['admin']}>
                <ApprovalsPage />
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
