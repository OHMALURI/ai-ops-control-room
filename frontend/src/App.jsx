import { BrowserRouter, Route, Routes, Navigate, Outlet } from 'react-router-dom';
import NavBar from './components/NavBar';
import Dashboard from './pages/Dashboard';
import ServiceRegistry from './pages/ServiceRegistry';
import Operations from './pages/Operations';
import AuditLog from './pages/AuditLog';
import DataPolicy from './pages/DataPolicy';
import UserManager from './pages/UserManager';
import Login from './pages/Login';
import PerformanceLogs from './pages/PerformanceLogs';

function ProtectedLayout() {
  const token = localStorage.getItem("token");
  
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
      <Routes>
        <Route path="/login" element={<Login />} />
        
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
    </BrowserRouter>
  );
}