import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import OrgSetup from './pages/OrgSetup';
import AssetDirectory from './pages/AssetDirectory';
import AssetAllocation from './pages/AssetAllocation';
import ResourceBooking from './pages/ResourceBooking';
import Maintenance from './pages/Maintenance';
import AssetAudit from './pages/AssetAudit';
import Reports from './pages/Reports';
import ActivityLogs from './pages/ActivityLogs';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* Protected app routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Layout><Dashboard /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/org-setup" element={
        <ProtectedRoute roles={['Admin']}>
          <Layout><OrgSetup /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/assets" element={
        <ProtectedRoute>
          <Layout><AssetDirectory /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/allocations" element={
        <ProtectedRoute>
          <Layout><AssetAllocation /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/bookings" element={
        <ProtectedRoute>
          <Layout><ResourceBooking /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/maintenance" element={
        <ProtectedRoute>
          <Layout><Maintenance /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/audits" element={
        <ProtectedRoute roles={['Admin', 'AssetManager']}>
          <Layout><AssetAudit /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/reports" element={
        <ProtectedRoute roles={['Admin', 'AssetManager', 'DepartmentHead']}>
          <Layout><Reports /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/activity" element={
        <ProtectedRoute>
          <Layout><ActivityLogs /></Layout>
        </ProtectedRoute>
      } />

      {/* Default redirects */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <AppRoutes />
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
