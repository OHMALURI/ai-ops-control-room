import { BrowserRouter, Route, Routes } from 'react-router-dom';
import ServiceRegistry from './pages/ServiceRegistry';
import Dashboard from './pages/Dashboard';
import Incidents from './pages/Incidents';
import MaintenancePlanner from './pages/MaintenancePlanner';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/registry" element={<ServiceRegistry />} />
        <Route path="/incidents" element={<Incidents />} />
        <Route path="/maintenance" element={<MaintenancePlanner />} />
        <Route path="/audit" element={<div className="p-6 text-gray-600">Audit Log — Coming Week 4</div>} />
        <Route path="/login" element={<div className="p-6 text-gray-600">Login — Coming Week 4</div>} />
      </Routes>
    </BrowserRouter>
  );
}