import { BrowserRouter, Route, Routes, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import api from './api';
import NavBar from './components/NavBar';
import PageTransition from './components/PageTransition';
import { EvaluationProvider } from './contexts/EvaluationContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Dashboard from './pages/Dashboard';
import ServiceRegistry from './pages/ServiceRegistry';
import Operations from './pages/Operations';
import AuditLog from './pages/AuditLog';
import DataPolicy from './pages/DataPolicy';
import UserManager from './pages/UserManager';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import PerformanceLogs from './pages/PerformanceLogs';

// Which transition variant each route gets
const ROUTE_VARIANTS = {
  "/":           "fade-up",     // Dashboard  — stats/cards rise in
  "/dashboard":  "fade-up",
  "/registry":   "slide-left",  // Services   — card list sweeps from left
  "/operations": "drop",        // Operations — alerts drop from top
  "/maintenance":"drop",
  "/audit":      "stream",      // Audit log  — log rows stream from top edge
  "/policy":     "slide-right", // Policy     — document slides in from right
  "/users":      "scale-fade",  // Users      — profiles scale up from center
  "/perf-logs":  "rise",        // Perf logs  — chart/data rises from bottom
};

function AnimatedOutlet() {
  const location = useLocation();
  const variant  = ROUTE_VARIANTS[location.pathname] ?? "fade-up";
  return (
    <PageTransition key={location.pathname} variant={variant}>
      <Outlet />
    </PageTransition>
  );
}

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
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [token]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <NavBar />
      <AnimatedOutlet />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
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
      </ThemeProvider>
    </BrowserRouter>
  );
}