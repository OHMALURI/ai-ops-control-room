import { BrowserRouter, Route, Routes, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import api from './api';
import NavBar from './components/NavBar';
import { EvaluationProvider } from './contexts/EvaluationContext';
import Dashboard from './pages/Dashboard';
import ServiceRegistry from './pages/ServiceRegistry';
import Operations from './pages/Operations';
import AuditLog from './pages/AuditLog';
import DataPolicy from './pages/DataPolicy';
import UserManager from './pages/UserManager';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import PerformanceLogs from './pages/PerformanceLogs';

function ProtectedLayout() {
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token) return;
    const refresh = () => {
      api.get("/auth/me").then(({ data }) => {
        const eff = data.effective_role || data.role;
        const isTmp = data.is_temp_admin ? "true" : "false";
        localStorage.setItem("effectiveRole", eff);
        localStorage.setItem("isTempAdmin", isTmp);
      }).catch(() => {});
    };
    refresh();
    const id = setInterval(refresh, 30000); // re-check every 30s
    return () => clearInterval(id);
  }, [token]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <NavBar />
      <Outlet />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <EvaluationProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/registry" element={<ServiceRegistry />} />
          <Route path="/operations" element={<Operations />} />
          <Route path="/maintenance" element={<Operations />} />
          <Route path="/audit" element={<AuditLog />} />
          <Route path="/policy" element={<DataPolicy />} />
          <Route path="/users" element={<UserManager />} />
          <Route path="/perf-logs" element={<PerformanceLogs />} />
        </Route>
      </Routes>
      </EvaluationProvider>
    </BrowserRouter>
  );
}