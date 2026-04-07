import React, { useState, useEffect } from 'react';
import api from '../api.js';

export default function MaintenancePlanner() {
  const [incidents, setIncidents] = useState([]);
  const [plans, setPlans] = useState([]);
  
  // Dashboard Form Context
  const [formData, setFormData] = useState({
    incident_id: '',
    risk_level: 'low',
    rollback_plan: '',
    validation_steps: '',
    next_eval_date: '',
    approvalChecked: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);

  const fetchData = async () => {
    try {
      const [incidentsRes, plansRes] = await Promise.all([
        api.get('/incidents'),
        api.get('/maintenance')
      ]);
      setIncidents(incidentsRes.data);
      setPlans(plansRes.data);
    } catch (err) {
      console.error("Error fetching Maintenance parameters:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreatePlan = async (e) => {
    e.preventDefault();
    if (!formData.approvalChecked) return;
    
    setIsSubmitting(true);
    try {
      // Step 1: Initialize Database Model
      const createPayload = {
        incident_id: parseInt(formData.incident_id),
        risk_level: formData.risk_level,
        rollback_plan: formData.rollback_plan,
        validation_steps: formData.validation_steps,
        approved: false  // Standard explicit creation mapping defaults false
      };

      const createRes = await api.post('/maintenance/', createPayload);
      console.log('[MaintenancePlanner] POST /maintenance/ response:', createRes.data);

      // Safely extract id — backend may return the object directly or wrapped in an array
      const planId = createRes.data?.id ?? createRes.data?.[0]?.id;

      // Step 2: Inject Date Schedule mapping (only when we have a valid id)
      if (formData.next_eval_date && planId) {
        // Enforce ISO string to strictly map Python datetime.fromisoformat requirements
        const formattedDate = new Date(formData.next_eval_date).toISOString();
        try {
          await api.put(`/maintenance/${planId}/schedule`, {
            next_eval_date: formattedDate
          });
          await api.put(`/maintenance/${planId}/approve`);
        } catch (scheduleErr) {
          console.error('[MaintenancePlanner] Schedule/approve step failed:', scheduleErr);
        }
      } else if (formData.next_eval_date && !planId) {
        console.warn('[MaintenancePlanner] Skipping schedule — planId is missing:', planId);
      }

      // Empty mapping variables
      setFormData({
        incident_id: '',
        risk_level: 'low',
        rollback_plan: '',
        validation_steps: '',
        next_eval_date: '',
        approvalChecked: false
      });
      setSelectedIncident(null);
    } catch (err) {
      console.error('[MaintenancePlanner] Error initializing plan workflow:', err);
    } finally {
      // Always refresh the list regardless of schedule success/failure
      await fetchData();
      setIsSubmitting(false);
    }
  };

  const executeApprovalAction = async (planId) => {
    try {
      await api.put(`/maintenance/${planId}/approve`);
      await fetchData();
    } catch (err) {
      console.error("Error bypassing approval:", err);
      alert("Failed to record formal approval variable");
    }
  };

  const getRiskColoring = (risk) => {
    switch(risk?.toLowerCase()) {
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getSeverityColor = (sev) => {
    switch(sev?.toLowerCase()) {
      case 'low':      return 'bg-green-100 text-green-800 border-green-200';
      case 'medium':   return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'high':     return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      default:         return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <div className="mb-4">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Maintenance Planner</h1>
          <p className="text-slate-500 mt-2 text-md">Configure incident rollout cycles, validate model fixes, and confirm deployment evaluation checkpoints.</p>
        </div>

        {/* --- Creation Root Node Form --- */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8">
          <h2 className="text-xl font-bold text-slate-800 mb-6 border-b border-slate-100 pb-3 flex items-center">
             <svg className="w-5 h-5 mr-2 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
             Create Maintenance Plan
          </h2>
          <form onSubmit={handleCreatePlan} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Target Incident</label>
                <select 
                  required
                  className="w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3 border"
                  value={formData.incident_id}
                  onChange={e => {
                    const id = e.target.value;
                    setFormData({...formData, incident_id: id});
                    setSelectedIncident(incidents.find(inc => inc.id === parseInt(id)) || null);
                  }}
                >
                  <option value="" disabled>Select an incident parameter...</option>
                  {incidents.map(inc => (
                    <option key={inc.id} value={inc.id}>
                      Incident #{inc.id} (Severity: {inc.severity.toUpperCase()}, Service ID: {inc.service_id})
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Expected Risk Level</label>
                <select 
                  required
                  className="w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3 border"
                  value={formData.risk_level}
                  onChange={e => setFormData({...formData, risk_level: e.target.value})}
                >
                  <option value="low">Low Risk</option>
                  <option value="medium">Medium Risk</option>
                  <option value="high">High Risk</option>
                </select>
              </div>
            </div>

            {/* Incident Preview Panel — read-only */}
            {selectedIncident && (
              <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-4">
                <h3 className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  Incident Preview (read-only)
                </h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Incident ID</p>
                    <p className="font-mono font-bold text-slate-800">#{selectedIncident.id}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Severity</p>
                    <span className={`inline-block px-2 py-0.5 rounded border text-xs font-bold uppercase ${getSeverityColor(selectedIncident.severity)}`}>
                      {selectedIncident.severity}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Service ID</p>
                    <p className="text-slate-700">#{selectedIncident.service_id}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Status</p>
                    <span className={`inline-block px-2 py-0.5 rounded-full border text-xs font-bold ${
                      selectedIncident.approved ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'
                    }`}>
                      {selectedIncident.approved ? 'RESOLVED' : 'INVESTIGATING'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Symptoms</p>
                    <p className="text-slate-700 bg-white border border-slate-200 rounded p-2 text-xs leading-relaxed">{selectedIncident.symptoms || '—'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Timeline</p>
                    <p className="text-slate-700 bg-white border border-slate-200 rounded p-2 text-xs leading-relaxed">{selectedIncident.timeline || '—'}</p>
                  </div>
                  {selectedIncident.checklist_json && (
                    <div className="col-span-2">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Checklist</p>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(JSON.parse(selectedIncident.checklist_json)).map(([key, val]) => (
                          <span key={key} className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                            val ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                          }`}>
                            {key.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedIncident.llm_summary && (
                    <div className="col-span-2">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Post-Mortem Summary</p>
                      <p className="text-slate-600 bg-white border border-slate-200 rounded p-2 text-xs italic leading-relaxed">{selectedIncident.llm_summary}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Rollback Plan Constraint</label>
              <textarea 
                required
                rows={2}
                placeholder="Declare precise steps to revert models to steady state parameter weights if safety failures erupt during post-deployment validation..."
                className="w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3 border"
                value={formData.rollback_plan}
                onChange={e => setFormData({...formData, rollback_plan: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Validation Sandbox Steps</label>
              <textarea 
                required
                rows={2}
                placeholder="1. Re-query evaluation metrics loop. 2. Verify dataset logic against standard vectors. 3. Monitor unhandled token deviations..."
                className="w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3 border"
                value={formData.validation_steps}
                onChange={e => setFormData({...formData, validation_steps: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Next Evaluation Date Checkpoint</label>
              <input 
                type="date"
                required
                className="w-full md:w-1/2 rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3 border"
                value={formData.next_eval_date}
                onChange={e => setFormData({...formData, next_eval_date: e.target.value})}
              />
            </div>

            {/* Checkbox Constraints */}
            <div className="flex items-center pt-3 pb-1">
              <input 
                id="approval-check"
                type="checkbox" 
                className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                checked={formData.approvalChecked}
                onChange={e => setFormData({...formData, approvalChecked: e.target.checked})}
              />
              <label htmlFor="approval-check" className="ml-3 block text-sm font-semibold text-slate-800 cursor-pointer select-none">
                I have reviewed this plan and approve it for execution
              </label>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button 
                type="submit" 
                disabled={!formData.approvalChecked || isSubmitting}
                className={`inline-flex justify-center rounded-lg border border-transparent py-2.5 px-6 text-sm font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all 
                  ${!formData.approvalChecked || isSubmitting 
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
              >
                {isSubmitting ? 'Finalizing Configuration...' : 'Initialize Approved Plan'}
              </button>
            </div>
          </form>
        </div>

        {/* --- Tracked Operational Plans --- */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-8">
          <h2 className="text-xl font-bold text-slate-800 p-6 border-b border-slate-100 bg-slate-50 flex items-center">
             Operational Rollouts Directory
          </h2>
          
          {plans.length === 0 ? (
           <div className="p-10 flex flex-col items-center text-slate-400">
             <span className="text-sm font-medium">No plans allocated in memory structure.</span>
           </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {plans.map(plan => {
                const isApproved = plan.approved;
                const formattedDate = plan.next_eval_date 
                  ? new Date(plan.next_eval_date).toLocaleDateString() 
                  : "Unscheduled";
                
                return (
                  <li key={plan.id} className="p-5 sm:px-6 hover:bg-indigo-50/10 flex flex-col md:flex-row md:items-center justify-between transition-colors gap-4">
                    {/* Data Payload Left Component */}
                    <div className="flex flex-col md:flex-row md:items-center space-y-3 md:space-y-0 md:space-x-6">
                      <div className="flex items-center space-x-3">
                        <span className="font-mono font-bold text-slate-500 text-sm bg-slate-100 px-2 py-1 rounded">
                          INCIDENT #{plan.incident_id}
                        </span>
                        <div className={`px-2.5 py-1 rounded border text-xs font-bold uppercase ${getRiskColoring(plan.risk_level)} shadow-sm tracking-wide text-center`}>
                          {plan.risk_level} Risk
                        </div>
                      </div>
                      
                      <div className="flex flex-col ml-0 md:ml-4 text-sm">
                        <p className="font-semibold text-slate-800 mb-0.5 border-l-2 border-indigo-200 pl-2">
                           Next Evaluation: <span className="font-normal font-mono text-indigo-700">{formattedDate}</span>
                        </p>
                      </div>
                    </div>
                    
                    {/* Status State Parameters Right Component */}
                    <div className="flex items-center justify-between md:justify-end space-x-4 border-t border-slate-100 md:border-0 pt-3 md:pt-0">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${isApproved ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                        {isApproved ? 'APPROVED' : 'PENDING'}
                      </span>
                      
                      {!isApproved && (
                        <button
                          onClick={() => executeApprovalAction(plan.id)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-1.5 px-4 rounded shadow-sm transition-colors"
                        >
                          Approve
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

      </div>
    </div>
  );
}
