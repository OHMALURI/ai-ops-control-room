import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api.js';

export default function MaintenancePlanner() {
  const [incidents, setIncidents] = useState([]);
  const [plans, setPlans] = useState([]);
  const [services, setServices] = useState([]);

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
  const location = useLocation();

  const fetchData = async () => {
    try {
      const [incidentsRes, plansRes, servicesRes] = await Promise.all([
        api.get('/incidents'),
        api.get('/maintenance'),
        api.get('/services')
      ]);
      setIncidents(incidentsRes.data);
      setPlans(plansRes.data);
      setServices(servicesRes.data);
    } catch (err) {
      console.error("Error fetching Maintenance parameters:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle pre-selection from query params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const incId = params.get('incidentId');
    if (incId && incidents.length > 0) {
      const found = incidents.find(i => i.id === parseInt(incId));
      if (found) {
        setFormData(prev => ({ ...prev, incident_id: incId }));
        setSelectedIncident(found);
      }
    }
  }, [location.search, incidents]);

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
    switch (risk?.toLowerCase()) {
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getSeverityColor = (sev) => {
    switch (sev?.toLowerCase()) {
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getServiceName = (serviceId) => {
    return services.find(s => s.id === serviceId)?.name || `SRV-${serviceId}`;
  };

  return (
    <>
      <div className="mb-4">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Maintenance Planner</h1>
        <p className="text-slate-500 mt-2 text-md">Configure incident rollout cycles, validate model fixes, and confirm deployment evaluation checkpoints.</p>
      </div>

      {/* --- Step 1: Select Incident --- */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">1</div>
          <h2 className="text-xl font-bold text-slate-800">Select Target Incident</h2>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Choose an incident to create a maintenance plan for</label>
          <select
            required
            className="w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3 border"
            value={formData.incident_id}
            onChange={e => {
              const id = e.target.value;
              setFormData({ ...formData, incident_id: id });
              setSelectedIncident(incidents.find(inc => inc.id === parseInt(id)) || null);
            }}
          >
            <option value="" disabled>Select an incident...</option>
            {incidents.filter(inc => inc.status !== 'closed').map(inc => {
              const serviceName = getServiceName(inc.service_id);
              return (
                <option key={inc.id} value={inc.id}>
                  Incident #{inc.id} → {serviceName} ({inc.severity.toUpperCase()})
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* --- Step 2: Review Incident & Step 3: Create Plan --- */}
      {selectedIncident && (
        <>
          {/* Incident Preview */}
          <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wider">Incident Details (Read-Only)</h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-1">Incident ID</p>
                <p className="font-mono font-bold text-indigo-900">#{selectedIncident.id}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-1">Service</p>
                <p className="font-semibold text-indigo-900">{getServiceName(selectedIncident.service_id)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-1">Severity</p>
                <span className={`inline-block px-2 py-0.5 rounded border text-xs font-bold uppercase ${getSeverityColor(selectedIncident.severity)}`}>
                  {selectedIncident.severity}
                </span>
              </div>
              <div>
                <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-1">Status</p>
                <span className={`inline-block px-2 py-0.5 rounded-full border text-xs font-bold ${selectedIncident.approved ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                  {selectedIncident.approved ? 'RESOLVED' : 'INVESTIGATING'}
                </span>
              </div>
            </div>

            {selectedIncident.symptoms && (
              <div className="mt-4 pt-4 border-t border-indigo-200">
                <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-2">Symptoms</p>
                <p className="text-sm text-indigo-900 bg-white p-2 rounded border border-indigo-100">{selectedIncident.symptoms}</p>
              </div>
            )}

            {selectedIncident.llm_summary && (
              <div className="mt-4 pt-4 border-t border-indigo-200">
                <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-2">Incident Summary</p>
                <p className="text-sm text-indigo-900 bg-white p-3 rounded border border-indigo-100 leading-relaxed">{selectedIncident.llm_summary}</p>
              </div>
            )}
          </div>

          {/* Form to Create Plan */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">2</div>
              <h2 className="text-xl font-bold text-slate-800">Create Maintenance Plan</h2>
            </div>

            <form onSubmit={handleCreatePlan} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Expected Risk Level</label>
                  <select
                    required
                    className="w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3 border"
                    value={formData.risk_level}
                    onChange={e => setFormData({ ...formData, risk_level: e.target.value })}
                  >
                    <option value="low">Low Risk</option>
                    <option value="medium">Medium Risk</option>
                    <option value="high">High Risk</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Next Evaluation Date</label>
                  <input
                    type="date"
                    required
                    className="w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3 border"
                    value={formData.next_eval_date}
                    onChange={e => setFormData({ ...formData, next_eval_date: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Rollback Plan Constraint</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Declare precise steps to revert models to steady state parameter weights if safety failures erupt during post-deployment validation..."
                  className="w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3 border"
                  value={formData.rollback_plan}
                  onChange={e => setFormData({ ...formData, rollback_plan: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Validation Sandbox Steps</label>
                <textarea
                  required
                  rows={3}
                  placeholder="1. Re-query evaluation metrics loop. 2. Verify dataset logic against standard vectors. 3. Monitor unhandled token deviations..."
                  className="w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3 border"
                  value={formData.validation_steps}
                  onChange={e => setFormData({ ...formData, validation_steps: e.target.value })}
                />
              </div>

              {/* Approval Checkbox */}
              <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                <div className="flex items-start gap-3">
                  <input
                    id="approval-check"
                    type="checkbox"
                    className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer mt-0.5"
                    checked={formData.approvalChecked}
                    onChange={e => setFormData({ ...formData, approvalChecked: e.target.checked })}
                  />
                  <label htmlFor="approval-check" className="block text-sm font-semibold text-slate-800 cursor-pointer select-none">
                    I have reviewed this maintenance plan and approve it for execution
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIncident(null);
                    setFormData({
                      incident_id: '',
                      risk_level: 'low',
                      rollback_plan: '',
                      validation_steps: '',
                      next_eval_date: '',
                      approvalChecked: false
                    });
                  }}
                  className="px-6 py-2.5 rounded-lg border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!formData.approvalChecked || isSubmitting}
                  className={`inline-flex justify-center rounded-lg border border-transparent py-2.5 px-8 text-sm font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all
                      ${!formData.approvalChecked || isSubmitting
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                >
                  {isSubmitting ? 'Creating Plan...' : 'Create & Approve Plan'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* --- All Maintenance Plans Directory --- */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-8">
        <h2 className="text-xl font-bold text-slate-800 p-6 border-b border-slate-100 bg-slate-50 flex items-center">
          <svg className="w-5 h-5 mr-3 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          All Maintenance Plans
        </h2>

        {plans.length === 0 ? (
          <div className="p-10 flex flex-col items-center text-slate-400">
            <span className="text-sm font-medium">No maintenance plans created yet.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Incident</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Service</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Risk Level</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Next Evaluation</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {plans.map(plan => {
                  const incident = incidents.find(i => i.id === plan.incident_id);
                  const serviceName = incident ? getServiceName(incident.service_id) : 'Unknown';
                  const isApproved = plan.approved;
                  const formattedDate = plan.next_eval_date
                    ? new Date(plan.next_eval_date).toLocaleDateString()
                    : "Unscheduled";

                  return (
                    <tr key={plan.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-mono font-bold text-slate-700">INC-{plan.incident_id}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-slate-700">{serviceName}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2.5 py-1 rounded border text-xs font-bold uppercase ${getRiskColoring(plan.risk_level)}`}>
                          {plan.risk_level}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-700 font-mono">{formattedDate}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${isApproved ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                            {isApproved ? 'APPROVED' : 'PENDING'}
                          </span>
                          {!isApproved && (
                            <button
                              onClick={() => executeApprovalAction(plan.id)}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-1.5 px-3 rounded shadow-sm transition-colors"
                            >
                              Approve
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </>
  );
}
