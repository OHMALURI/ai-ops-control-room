import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import IncidentModal from '../components/IncidentModal';
import MaintenancePlanModal from '../components/MaintenancePlanModal';

// --- Static Helpers ---
const checkboxLabels = {
  data_issue: "Data issue",
  prompt_change: "Prompt change",
  model_update: "Model update",
  infrastructure: "Infrastructure problem",
  safety_failure: "Safety/policy failure"
};

const getSeverityStyle = (severity) => {
  switch (severity?.toLowerCase()) {
    case 'low': return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'medium': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'critical': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getStatusBadge = (status) => {
  switch (status?.toLowerCase()) {
    case 'pending': return 'bg-slate-100 text-slate-500 border-slate-200';
    case 'open': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    case 'closed': return 'bg-green-100 text-green-700 border-green-200';
    default: return 'bg-gray-100 text-gray-600 border-gray-200';
  }
};

const getRiskStyle = (risk) => {
  switch (risk?.toLowerCase()) {
    case 'low': return 'bg-green-100 text-green-700 border-green-200';
    case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'high': return 'bg-red-100 text-red-700 border-red-200';
    default: return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

const getServiceName = (serviceId, services) => {
  const srv = services.find(s => s.id === serviceId);
  return srv ? srv.name : `SRV-${serviceId}`;
};

// --- Sub-Components ---

const IncidentCard = ({
  incident,
  services,
  expandedId,
  toggleExpandPanel,
  canConfigure,
  isAdmin,
  checklist,
  handleChecklistChange,
  executeDraftSummaryGeneration,
  isGenerating,
  draftSummary,
  setDraftSummary,
  handleOpenTicket,
  isOpeningTicket,
  handleTogglePlanDone,
  finishSummaryApproval,
  isApproving,
  handleReopenTicket,
  isReopening,
  navigate,
  openPlanModal
}) => {
  const isActive = expandedId === incident.id;
  const hasPlan = incident.maintenance_records && incident.maintenance_records.length > 0;
  const allPlansApprovedStatus = hasPlan && incident.maintenance_records.every(p => p.approved);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-4 transition-all hover:shadow-md">
      <div
        onClick={() => toggleExpandPanel(incident)}
        className="p-5 flex items-center justify-between cursor-pointer"
      >
        <div className="flex items-center gap-6">
          <div className={`px-3 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-widest ${getSeverityStyle(incident.severity)}`}>
            {incident.severity}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-slate-400">INC-{incident.id}</span>
              <p className="text-sm font-bold text-slate-900">{getServiceName(incident.service_id, services)}</p>
            </div>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">{new Date(incident.created_at).toLocaleString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${getStatusBadge(incident.status)}`}>
            {incident.status.toUpperCase()}
          </span>
          <svg className={`h-5 w-5 text-slate-400 transition-transform ${isActive ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
      </div>

      {isActive && (
        <div className="p-6 bg-slate-50 border-t border-slate-100">

          {/* ─── PENDING ─── */}
          {incident.status === 'pending' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description & Timeline</h4>
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Symptoms</p>
                    <p className="text-sm text-slate-700 mt-1">{incident.symptoms}</p>
                  </div>
                  <div className="pt-3 border-t border-slate-50">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Timeline</p>
                    <p className="text-sm text-slate-700 mt-1 italic">"{incident.timeline}"</p>
                  </div>
                </div>
              </div>

              {canConfigure && (
                <>
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Diagnosis Checklist</h4>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                      {Object.entries(checklist).map(([key, val]) => (
                        <label key={key} className="flex items-center p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            checked={val}
                            onChange={() => handleChecklistChange(key)}
                          />
                          <span className="ml-3 text-xs font-medium text-slate-700">{checkboxLabels[key]}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">AI Incident Summary</h4>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">AI Draft</span>
                        <button
                          onClick={() => executeDraftSummaryGeneration(incident.id)}
                          disabled={isGenerating}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 disabled:opacity-30 px-3 py-1 bg-indigo-50 rounded-lg border border-indigo-100 transition-all"
                        >
                          {isGenerating ? 'Generating...' : 'Generate'}
                        </button>
                      </div>
                      <textarea
                        className="w-full text-xs p-3 bg-slate-50 border border-slate-100 rounded-lg min-h-[80px] text-slate-600 leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        value={draftSummary}
                        onChange={(e) => setDraftSummary(e.target.value)}
                        placeholder="Click 'Generate' to create an AI-drafted summary, or write one manually..."
                      />
                      <button
                        onClick={() => handleOpenTicket(incident.id)}
                        disabled={isOpeningTicket || !draftSummary.trim()}
                        className={`w-full py-2.5 rounded-lg text-xs font-bold transition-all ${
                          !draftSummary.trim()
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20'
                        }`}
                      >
                        {isOpeningTicket ? 'Opening...' : 'OK — Submit & Open Ticket'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ─── OPEN ─── */}
          {incident.status === 'open' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description & Timeline</h4>
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Symptoms</p>
                    <p className="text-sm text-slate-700 mt-1">{incident.symptoms}</p>
                  </div>
                  <div className="pt-3 border-t border-slate-50">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Timeline</p>
                    <p className="text-sm text-slate-700 mt-1 italic">"{incident.timeline}"</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Incident Summary</h4>
                <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                  {incident.llm_summary
                    ? <p className="text-sm text-indigo-900 leading-relaxed">{incident.llm_summary}</p>
                    : <p className="text-xs text-indigo-400 italic">No summary recorded for this incident.</p>
                  }
                </div>
              </div>

              {canConfigure && (
                <>
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Maintenance Plans</h4>
                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                      {hasPlan ? (
                        <div className="space-y-2">
                          {incident.maintenance_records.map(plan => (
                            <div key={plan.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500 cursor-pointer flex-shrink-0"
                                checked={plan.approved}
                                onChange={(e) => { e.stopPropagation(); handleTogglePlanDone(plan.id, plan.approved); }}
                              />
                              <button
                                onClick={() => openPlanModal(plan)}
                                className="flex-1 text-left min-w-0"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-700 group-hover:text-indigo-700 transition-colors">Plan #{plan.id}</span>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getRiskStyle(plan.risk_level)}`}>{plan.risk_level}</span>
                                  <span className="text-[10px] text-slate-400 underline decoration-dotted">click to view</span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-0.5 truncate">{plan.rollback_plan}</p>
                              </button>
                              {plan.approved
                                ? <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                : <svg className="w-4 h-4 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              }
                            </div>
                          ))}
                          {!allPlansApprovedStatus && (
                            <p className="text-[10px] text-amber-600 font-medium mt-2 px-1">
                              Mark all plans as done to enable ticket closure.
                            </p>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => navigate('/maintenance')}
                          className="w-full py-2.5 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-all"
                        >
                          + Create Maintenance Plan
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Post-Mortem Summary</h4>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Narrative</span>
                        <button
                          onClick={() => executeDraftSummaryGeneration(incident.id)}
                          disabled={isGenerating}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 disabled:opacity-30 px-3 py-1 bg-indigo-50 rounded-lg border border-indigo-100 transition-all"
                        >
                          {isGenerating ? 'Generating...' : 'AI Rewrite'}
                        </button>
                      </div>
                      <textarea
                        className="w-full text-xs p-3 bg-slate-50 border border-slate-100 rounded-lg min-h-[80px] text-slate-600 leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        value={draftSummary}
                        onChange={(e) => setDraftSummary(e.target.value)}
                        placeholder="Write the post-mortem summary or click 'AI Rewrite' to generate one..."
                      />
                      <button
                        onClick={() => finishSummaryApproval(incident)}
                        disabled={isApproving || !draftSummary.trim() || !allPlansApprovedStatus}
                        className={`w-full py-2.5 rounded-lg text-xs font-bold transition-all ${
                          (!allPlansApprovedStatus || !draftSummary.trim())
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20'
                        }`}
                      >
                        {isApproving ? 'Closing...' : !allPlansApprovedStatus ? 'Complete All Plans to Close' : 'Close Ticket'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ─── CLOSED ─── */}
          {incident.status === 'closed' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description & Timeline</h4>
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Symptoms</p>
                    <p className="text-sm text-slate-700 mt-1">{incident.symptoms}</p>
                  </div>
                  <div className="pt-3 border-t border-slate-50">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Timeline</p>
                    <p className="text-sm text-slate-700 mt-1 italic">"{incident.timeline}"</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Incident Summary</h4>
                <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                  {incident.llm_summary
                    ? <p className="text-sm text-indigo-900 leading-relaxed">{incident.llm_summary}</p>
                    : <p className="text-xs text-indigo-400 italic">No incident summary was recorded.</p>
                  }
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Post-Mortem Summary</h4>
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                  {incident.post_mortem
                    ? <p className="text-sm text-slate-700 leading-relaxed">{incident.post_mortem}</p>
                    : <p className="text-xs text-slate-400 italic">No post-mortem summary was recorded.</p>
                  }
                </div>
              </div>

              {incident.maintenance_records && incident.maintenance_records.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Maintenance Plans</h4>
                  <div className="space-y-2">
                    {incident.maintenance_records.map(plan => (
                      <div key={plan.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100">
                        <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                        <button onClick={() => openPlanModal(plan)} className="flex-1 text-left min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-600">Plan #{plan.id}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getRiskStyle(plan.risk_level)}`}>{plan.risk_level}</span>
                            <span className="text-[10px] text-slate-400 underline decoration-dotted">view</span>
                          </div>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {canConfigure && (
                <button
                  onClick={() => handleReopenTicket(incident.id)}
                  disabled={isReopening}
                  className="w-full py-2.5 bg-amber-50 text-amber-700 text-xs font-bold rounded-lg border border-amber-200 hover:bg-amber-100 transition-all disabled:opacity-40"
                >
                  {isReopening ? 'Reopening...' : 'Reopen Ticket'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Section = ({ title, items, emptyMsg, ...incidentCardProps }) => (
  <div className="mb-10">
    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-3">
      {title}
      <span className="h-px flex-grow bg-slate-200"></span>
      <span className="text-slate-500 tabular-nums">{items.length}</span>
    </h3>
    {items.length === 0 ? (
      <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 italic text-xs">
        {emptyMsg}
      </div>
    ) : (
      items.map(i => <IncidentCard key={i.id} incident={i} {...incidentCardProps} />)
    )}
  </div>
);

// --- Main Page Component ---

export default function Incidents() {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState([]);
  const [services, setServices] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const effectiveRole = localStorage.getItem("effectiveRole") || localStorage.getItem("role") || "user";
  const isAdmin = effectiveRole === "admin";
  const canConfigure = effectiveRole === "admin" || effectiveRole === "maintainer";

  const [formData, setFormData] = useState({
    service_id: '',
    severity: 'low',
    symptoms: '',
    timeline: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [checklist, setChecklist] = useState({
    data_issue: false,
    prompt_change: false,
    model_update: false,
    infrastructure: false,
    safety_failure: false
  });

  const [draftSummary, setDraftSummary] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [isApproving, setIsApproving] = useState(false);
  const [isOpeningTicket, setIsOpeningTicket] = useState(false);
  const [isReopening, setIsReopening] = useState(false);

  const fetchData = async () => {
    try {
      const [servicesRes, incidentsRes] = await Promise.all([
        api.get('/services'),
        api.get('/incidents')
      ]);
      setServices(servicesRes.data);
      setIncidents(incidentsRes.data);
    } catch (err) {
      console.error("Fetch failure:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateIncident = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = { ...formData, service_id: parseInt(formData.service_id) };
      await api.post('/incidents', payload);
      setFormData({ service_id: '', severity: 'low', symptoms: '', timeline: '' });
      setIsModalOpen(false);
      await fetchData();
    } catch (err) {
      console.error("Creation mismatch:", err);
      alert("Failed to initialize new incident");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReopenTicket = async (incidentId) => {
    if (isReopening) return;
    setIsReopening(true);
    try {
      await api.put(`/incidents/${incidentId}/reopen`);
      setExpandedId(null);
      await fetchData();
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to reopen ticket.";
      console.error("Reopen failed:", err);
      alert(msg);
    } finally {
      setIsReopening(false);
    }
  };

  const toggleExpandPanel = (incident) => {
    if (expandedId === incident.id) {
      setExpandedId(null);
    } else {
      setExpandedId(incident.id);
      setChecklist({ data_issue: false, prompt_change: false, model_update: false, infrastructure: false, safety_failure: false });
      setDraftSummary('');
    }
  };

  const handleChecklistChange = (fieldKey) => {
    if (!canConfigure) return;
    setChecklist(prev => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
  };

  const executeDraftSummaryGeneration = async (incidentId) => {
    setIsGenerating(true);
    try {
      const response = await api.post(`/incidents/${incidentId}/generate-summary`);
      setDraftSummary(response.data.draft || response.data);
    } catch (err) {
      console.error("LLM failure:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenTicket = async (incidentId) => {
    if (!draftSummary.trim() || isOpeningTicket) return;
    setIsOpeningTicket(true);
    try {
      await api.put(`/incidents/${incidentId}/open-ticket`, { summary_text: draftSummary });
      await fetchData();
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to open ticket.";
      console.error("Open ticket error:", err);
      alert(msg);
    } finally {
      setIsOpeningTicket(false);
    }
  };

  const handleTogglePlanDone = async (planId, currentApproved) => {
    try {
      await api.put(`/maintenance/${planId}`, { approved: !currentApproved });
      await fetchData();
    } catch (err) {
      console.error("Plan toggle failed:", err);
    }
  };

  const finishSummaryApproval = async (incident) => {
    if (!incident || isApproving) return;
    setIsApproving(true);
    try {
      await api.put(`/incidents/${incident.id}/approve-summary`, { summary_text: draftSummary });
      await fetchData();
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to close ticket. Ensure all maintenance plans are marked done and a summary is filled.";
      console.error("Closure error:", err);
      alert(msg);
    } finally {
      setIsApproving(false);
    }
  };

  const openPlanModal = (plan) => {
    setSelectedPlan(plan);
    setIsPlanModalOpen(true);
  };

  const pendingIncidents = incidents.filter(i => i.status === "pending");
  const openIncidents = incidents.filter(i => i.status === "open");
  const closedIncidents = incidents.filter(i => i.status === "closed");

  const incidentCardProps = {
    services,
    expandedId,
    toggleExpandPanel,
    canConfigure,
    isAdmin,
    checklist,
    handleChecklistChange,
    executeDraftSummaryGeneration,
    isGenerating,
    draftSummary,
    setDraftSummary,
    handleOpenTicket,
    isOpeningTicket,
    handleTogglePlanDone,
    finishSummaryApproval,
    isApproving,
    handleReopenTicket,
    isReopening,
    navigate,
    openPlanModal
  };

  return (
    <div className="max-w-6xl mx-auto">
      <IncidentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        formData={formData}
        setFormData={setFormData}
        services={services}
        isSubmitting={isSubmitting}
        onSubmit={handleCreateIncident}
      />

      <div className="flex items-center justify-between mb-10">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Incidents</h2>
          <p className="text-slate-500 mt-1 font-medium">Enforcing standard operational procedures for model recovery and safety failures.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-2xl shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Report New Incident
        </button>
      </div>

      <Section
        title="Unconfirmed Alerts (Pending)"
        items={pendingIncidents}
        emptyMsg="Secure state: All reported anomalies have been diagnosed."
        {...incidentCardProps}
      />

      <Section
        title="Active Investigations (Open)"
        items={openIncidents}
        emptyMsg="Operational state: No active investigations requiring resolution plans."
        {...incidentCardProps}
      />

      <Section
        title="Resolution History (Closed)"
        items={closedIncidents}
        emptyMsg="System state: Baseline operational history is empty."
        {...incidentCardProps}
      />

      <MaintenancePlanModal
        isOpen={isPlanModalOpen}
        onClose={() => { setIsPlanModalOpen(false); fetchData(); }}
        plan={selectedPlan}
        onUpdate={() => fetchData()}
      />
    </div>
  );
}
