import { BrowserRouter, Route, Routes } from 'react-router-dom';
import NavBar from './components/NavBar';
import Dashboard from './pages/Dashboard';
import ServiceRegistry from './pages/ServiceRegistry';
import Incidents from './pages/Incidents';
import MaintenancePlanner from './pages/MaintenancePlanner';
import AuditLog from './pages/AuditLog';
import DataPolicy from './pages/DataPolicy';
import UserManager from './pages/UserManager';
import Login from './pages/Login';

export default function App() {
  return (
    <BrowserRouter>
      <NavBar />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/registry" element={<ServiceRegistry />} />
        <Route path="/incidents" element={<Incidents />} />
        <Route path="/maintenance" element={<MaintenancePlanner />} />
        <Route path="/audit" element={<AuditLog />} />
        <Route path="/policy" element={<DataPolicy />} />
        <Route path="/users" element={<UserManager />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </BrowserRouter>
  );
}