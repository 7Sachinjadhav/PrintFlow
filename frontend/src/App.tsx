import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { UploadedFileItem, CalculatedOrderPrice } from './types';

// Customer Pages
import { HomePage } from './pages/customer/HomePage';
import { UploadPage } from './pages/customer/UploadPage';
import { SettingsPage } from './pages/customer/SettingsPage';
import { ReviewPage } from './pages/customer/ReviewPage';
import { PaymentPage } from './pages/customer/PaymentPage';
import { TokenSuccessPage } from './pages/customer/TokenSuccessPage';
import { TrackingPage } from './pages/customer/TrackingPage';

// Admin Pages
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { DashboardPage } from './pages/admin/DashboardPage';
import { LiveQueuePage } from './pages/admin/LiveQueuePage';
import { AllOrdersPage } from './pages/admin/AllOrdersPage';
import { PrintersPage } from './pages/admin/PrintersPage';
import { PricingPage } from './pages/admin/PricingPage';
import { PaymentsPage } from './pages/admin/PaymentsPage';
import { CustomersPage } from './pages/admin/CustomersPage';
import { ReportsPage } from './pages/admin/ReportsPage';
import { StaffPage } from './pages/admin/StaffPage';
import { SettingsPage as AdminSettingsPage } from './pages/admin/SettingsPage';

function ProtectedAdminRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('printflow_admin_token');
  if (!token) {
    return <Navigate to="/admin/login" replace />;
  }
  return <>{children}</>;
}

export const App: React.FC = () => {
  // Shared customer order creation state
  const [files, setFiles] = useState<UploadedFileItem[]>([]);
  const [priceCalculation, setPriceCalculation] = useState<CalculatedOrderPrice | null>(null);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  return (
    <Routes>
      {/* Customer Routes */}
      <Route path="/" element={<HomePage />} />
      <Route
        path="/upload"
        element={<UploadPage files={files} setFiles={setFiles} />}
      />
      <Route
        path="/settings"
        element={
          <SettingsPage
            files={files}
            setFiles={setFiles}
            priceCalculation={priceCalculation}
            setPriceCalculation={setPriceCalculation}
          />
        }
      />
      <Route
        path="/review"
        element={
          <ReviewPage
            files={files}
            priceCalculation={priceCalculation}
            customerPhone={customerPhone}
            setCustomerPhone={setCustomerPhone}
            customerName={customerName}
            setCustomerName={setCustomerName}
            orderNotes={orderNotes}
            setOrderNotes={setOrderNotes}
          />
        }
      />
      <Route
        path="/payment"
        element={
          <PaymentPage
            files={files}
            priceCalculation={priceCalculation}
            customerPhone={customerPhone}
            customerName={customerName}
            orderNotes={orderNotes}
            setFiles={setFiles}
          />
        }
      />
      <Route path="/token/:orderId" element={<TokenSuccessPage />} />
      <Route path="/track" element={<TrackingPage />} />
      <Route path="/track/:orderId" element={<TrackingPage />} />

      {/* Admin Routes */}
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route
        path="/admin"
        element={
          <ProtectedAdminRoute>
            <AdminLayout />
          </ProtectedAdminRoute>
        }
      >
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="queue" element={<LiveQueuePage />} />
        <Route path="orders" element={<AllOrdersPage />} />
        <Route path="printers" element={<PrintersPage />} />
        <Route path="pricing" element={<PricingPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="staff" element={<StaffPage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
