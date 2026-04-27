import { BrowserRouter, Route, Routes, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, Component } from 'react';

class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-950 p-8">
          <div className="max-w-xl w-full bg-red-950/40 border border-red-800/50 rounded-2xl p-8">
            <p className="text-red-400 font-black text-lg mb-2">Page crashed</p>
            <pre className="text-red-300 text-xs whitespace-pre-wrap break-all bg-red-950/60 rounded-xl p-4">
              {this.state.error?.message}
              {"\n\n"}
              {this.state.error?.stack?.split("\n").slice(0, 6).join("\n")}
            </pre>
            <button onClick={() => this.setState({ error: null })}
              className="mt-4 px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-sm font-bold rounded-lg">
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
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
          <Route path="/" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
          <Route path="/dashboard" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
          <Route path="/registry" element={<ErrorBoundary><ServiceRegistry /></ErrorBoundary>} />
          <Route path="/operations" element={<ErrorBoundary><Operations /></ErrorBoundary>} />
          <Route path="/maintenance" element={<ErrorBoundary><Operations /></ErrorBoundary>} />
          <Route path="/audit" element={<ErrorBoundary><AuditLog /></ErrorBoundary>} />
          <Route path="/policy" element={<ErrorBoundary><DataPolicy /></ErrorBoundary>} />
          <Route path="/users" element={<ErrorBoundary><UserManager /></ErrorBoundary>} />
          <Route path="/perf-logs" element={<ErrorBoundary><PerformanceLogs /></ErrorBoundary>} />
        </Route>
      </Routes>
      </EvaluationProvider>
    </BrowserRouter>
  );
}