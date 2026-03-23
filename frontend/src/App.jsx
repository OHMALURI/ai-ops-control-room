import { BrowserRouter, Route, Routes } from 'react-router-dom';
import ServiceRegistry from './pages/ServiceRegistry';
import Dashboard from './pages/Dashboard';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/registry" element={<ServiceRegistry />} />
        <Route path="/incidents" element={<div className="p-6 text-gray-600">Incidents — Coming Week 3</div>} />
        <Route path="/maintenance" element={<div className="p-6 text-gray-600">Maintenance — Coming Week 3</div>} />
        <Route path="/audit" element={<div className="p-6 text-gray-600">Audit Log — Coming Week 4</div>} />
        <Route path="/login" element={<div className="p-6 text-gray-600">Login — Coming Week 4</div>} />
      </Routes>
    </BrowserRouter>
  );
}