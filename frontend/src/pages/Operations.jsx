import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Incidents from './Incidents';
import MaintenancePlanner from './MaintenancePlanner';

export default function Operations() {
  const location = useLocation();
  const navigate = useNavigate();
  const [view, setView] = useState(location.pathname.includes('maintenance') ? 'maintenance' : 'incidents');

  // Sync internal state with URL changes
  useEffect(() => {
    const isMaintenance = location.pathname.includes('maintenance');
    setView(isMaintenance ? 'maintenance' : 'incidents');
  }, [location.pathname]);

  const handleTabChange = (newView) => {
    setView(newView);
    navigate(newView === 'maintenance' ? '/maintenance' : '/operations');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-slate-800">Operations Center</h1>
        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 w-full sm:w-auto self-start">
          <button
            onClick={() => handleTabChange('incidents')}
            className={`flex-1 sm:flex-none px-6 py-2 text-sm font-bold rounded-md transition-all duration-200 ${
              view === 'incidents' 
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/60' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
            }`}
          >
            Active Incidents
          </button>
          <button
            onClick={() => handleTabChange('maintenance')}
            className={`flex-1 sm:flex-none px-6 py-2 text-sm font-bold rounded-md transition-all duration-200 ${
              view === 'maintenance' 
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/60' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
            }`}
          >
            Maintenance Planner
          </button>
        </div>
      </div>
      <div className="p-6 md:p-8 flex-grow">
        <div className="max-w-6xl mx-auto space-y-8">
          {view === 'incidents' ? <Incidents /> : <MaintenancePlanner />}
        </div>
      </div>
    </div>
  );
}
