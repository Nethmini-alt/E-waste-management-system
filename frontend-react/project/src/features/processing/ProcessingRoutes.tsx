import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import DashboardPage from './Dashboard/DashboardPage';
import ReceivePage from './Receive/ReceivePage';
import InventoryListPage from './Inventory/InventoryListPage';
import InventoryDetailPage from './Inventory/InventoryDetailPage';
import PaymentsPage from './Payments/PaymentsPage';
import AgenticReviewPage from './AgenticReview/AgenticReviewPage';
import RatePoliciesPage from './RatePolicies/RatePoliciesPage';

/**
 * All Processing screens, mounted once in App.tsx at `/processing/*`. Keeping the route table here
 * means the shared App.tsx only needs a single, role-guarded entry for the whole feature.
 */
const ProcessingRoutes: React.FC = () => (
  <Routes>
    <Route index element={<DashboardPage />} />
    <Route path="receive" element={<ReceivePage />} />
    <Route path="inventory" element={<InventoryListPage />} />
    <Route path="inventory/:id" element={<InventoryDetailPage />} />
    <Route path="payments" element={<PaymentsPage />} />
    <Route path="agentic-review" element={<AgenticReviewPage />} />
    <Route path="rate-policies" element={<RatePoliciesPage />} />
    <Route path="*" element={<Navigate to="/processing" replace />} />
  </Routes>
);

export default ProcessingRoutes;
