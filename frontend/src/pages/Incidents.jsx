import React, { useState, useEffect } from 'react';
import api from '../api.js';

export default function Incidents() {
  const [incidents, setIncidents] = useState([]);
  const [services, setServices] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  
  // Dashboard and Creation Form Root State
  const [formData, setFormData] = useState({
    service_id: '',
    severity: 'low',
    symptoms: '',
    timeline: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamic Detail Panel States
  const [checklist, setChecklist] = useState({
    data_issue: false,
    prompt_change: false,
    model_update: false,
    infrastructure: false,
    safety_failure: false
  });
  
  const [draftSummary, setDraftSummary] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingChecklist, setIsSavingChecklist] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Label Map bridging JSON keys to user-friendly titles 
  const checkboxLabels = {
    data_issue: "Data issue",
    prompt_change: "Prompt change",
    model_update: "Model update",
    infrastructure: "Infrastructure problem",
    safety_failure: "Safety/policy failure"
  };

  const fetchData = async () => {
    try {
      const [servicesRes, incidentsRes] = await Promise.all([
        api.get('/services'),
        api.get('/incidents')
      ]);
      setServices(servicesRes.data);
      setIncidents(incidentsRes.data);
    } catch (err) {
      console.error("Error fetching dependencies:", err);
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
      // Reset the component logic on success
      setFormData({ service_id: '', severity: 'low', symptoms: '', timeline: '' });
      await fetchData();
    } catch (err) {
      console.error("Error creating incident payload:", err);
      alert("Failed to initialize new incident");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Maps DB enum mapping to Tailwind visually encoded badging
  const getSeverityStyle = (severity) => {
    switch(severity?.toLowerCase()) {
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getServiceName = (serviceId) => {
    const srv = services.find(s => s.id === serviceId);
    return srv ? srv.name : `Service Config #${serviceId}`;
  };

  // Toggle dropdown component and hydrate state depending on targeted item properties
  const toggleExpandPanel = (incident) => {
    if (expandedId === incident.id) {
      setExpandedId(null);
    } else {
      setExpandedId(incident.id);
      
      const loadedChecklist = incident.checklist_json 
        ? JSON.parse(incident.checklist_json) 
        : {
            data_issue: false,
            prompt_change: false,
            model_update: false,
            infrastructure: false,
            safety_failure: false
          };
      setChecklist(loadedChecklist);
      setDraftSummary(incident.llm_summary || '');
    }
  };

  const handleChecklistChange = (fieldKey) => {
    setChecklist(prev => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
  };

  const handleSaveChecklistState = async (incidentId) => {
    setIsSavingChecklist(true);
    try {
      await api.put(`/incidents/${incidentId}/checklist`, checklist);
      await fetchData();
      alert("Checklist constraints saved successfully");
    } catch (err) {
      console.error("API configuration error during checklist save:", err);
      alert("Failed to save checklist to database");
    } finally {
      setIsSavingChecklist(false);
    }
  };

  const executeDraftSummaryGeneration = async (incidentId) => {
    setIsGenerating(true);
    try {
      const response = await api.post(`/incidents/${incidentId}/generate-summary`);
      setDraftSummary(response.data.draft || response.data);
    } catch (err) {
      console.error("Language Model generation exception:", err);
      alert("Failed to build draft summary from AI service");
    } finally {
      setIsGenerating(false);
    }
  };

  const finishSummaryApproval = async (incident) => {
    if (!incident) return;
    
    if (window.confirm("Are you sure you want to approve and formally save this generated post-mortem narrative?")) {
      setIsApproving(true);
      try {
        await api.put(`/incidents/${incident.id}/approve-summary`, { summary_text: draftSummary });
        await fetchData(); 
        alert("Evaluation successfully appended and formally resolved.");
      } catch (err) {
        console.error("Failed executing post-mortem approval:", err);
        alert("Failed to log database approval parameters");
      } finally {
        setIsApproving(false);
      }
    }
  };

  return (
    <>
        
        <div className="mb-4">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Active Incidents</h1>
          <p className="text-slate-500 mt-2 text-md">Identify and configure resolution lifecycles strictly adhering to standard operation playbooks.</p>
        </div>

        {/* --- Incident Report Form Setup --- */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
            <svg className="w-5 h-5 mr-2 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            File New Incident
          </h2>
          <form onSubmit={handleCreateIncident} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Target Service Configuration</label>
                <select 
                  required
                  className="w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5 border"
                  value={formData.service_id}
                  onChange={e => setFormData({...formData, service_id: e.target.value})}
                >
                  <option value="" disabled>Select the impacted service block...</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.environment})</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Impact Severity Class</label>
                <select 
                  required
                  className="w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5 border"
                  value={formData.severity}
                  onChange={e => setFormData({...formData, severity: e.target.value})}
                >
                  <option value="low">Low (Standard Anomaly)</option>
                  <option value="medium">Medium (Operation Blocker)</option>
                  <option value="high">High (Production System Failure)</option>
                  <option value="critical">Critical (Safety/Integrity Drop)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Registered Symptoms</label>
              <textarea 
                required
                rows={3}
                placeholder="Qualify standard model inaccuracies, latency spikes, or broken structural parameters..."
                className="w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3 border"
                value={formData.symptoms}
                onChange={e => setFormData({...formData, symptoms: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Chronological Timeline</label>
              <textarea 
                required
                rows={2}
                placeholder="10:30 UTC - Data format mismatch discovered. 10:45 UTC - System flagged parameter divergence..."
                className="w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3 border"
                value={formData.timeline}
                onChange={e => setFormData({...formData, timeline: e.target.value})}
              />
            </div>

            <div className="flex justify-end pt-3">
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="inline-flex justify-center rounded-lg border border-transparent bg-indigo-600 py-2.5 px-6 text-sm font-medium text-white shadow hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all disabled:opacity-50"
              >
                {isSubmitting ? 'Transmitting Data...' : 'Submit Incident Ticket'}
              </button>
            </div>
          </form>
        </div>

        {/* --- Tracked Incident Feed Array --- */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <h2 className="text-xl font-bold text-slate-800 p-6 border-b border-slate-100 bg-slate-50">Documented Issues Configuration</h2>
          
          {incidents.length === 0 ? (
            <div className="p-12 flex flex-col items-center text-slate-400">
               <svg className="w-12 h-12 mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
               <span>All production servers exhibit completely clear resolution status variables.</span>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {incidents.map(incident => {
                const isActive = expandedId === incident.id;
                const dateOutputString = new Date(incident.created_at).toLocaleString();
                
                return (
                  <li key={incident.id} className="flex flex-col">
                    <div 
                      onClick={() => toggleExpandPanel(incident)}
                      className="p-5 sm:px-6 hover:bg-indigo-50/40 cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <div className="flex items-center space-x-6">
                        <div className={`px-3 py-1.5 rounded border text-xs font-bold uppercase ${getSeverityStyle(incident.severity)} w-28 text-center tracking-widest shadow-sm`}>
                          {incident.severity}
                        </div>
                        <div>
                          <p className="text-md font-bold text-slate-900">{getServiceName(incident.service_id)}</p>
                          <p className="text-xs text-slate-500 font-medium tracking-tight mt-0.5">{dateOutputString}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-5">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${incident.approved ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          {incident.status || (incident.approved ? 'RESOLVED' : 'INVESTIGATING')}
                        </span>
                        <svg className={`h-5 w-5 text-slate-400 transform transition-transform duration-300 ${isActive ? 'rotate-180 text-indigo-500' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>

                    {/* DYNAMIC POST-MORTEM ACTION CONFIGURE TABLE */}
                    {isActive && (
                      <div className="p-6 bg-slate-50 border-t border-slate-200 grid grid-cols-1 lg:grid-cols-2 gap-8 shadow-inner">
                        
                        {/* LEFT DOMAIN: Troubleshooting Root Components */}
                        <div className="bg-white p-6 rounded border border-slate-200 shadow-sm flex flex-col">
                          <h4 className="text-md font-bold text-slate-800 mb-5 flex items-center">
                            <svg className="w-5 h-5 mr-2 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                            Initial Operations Diagnosis Checklist
                          </h4>
                          <div className="flex-grow space-y-3 mt-1">
                            {Object.entries(checklist).map(([key, isChecked]) => (
                                <label key={key} className="flex items-center p-2.5 bg-slate-50 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-200">
                                  <input 
                                    type="checkbox" 
                                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    checked={isChecked}
                                    onChange={() => handleChecklistChange(key)}
                                    title={checkboxLabels[key]}
                                  />
                                  <span className="ml-3 text-sm font-medium text-slate-700">
                                    {checkboxLabels[key] || key}
                                  </span>
                                </label>
                            ))}
                          </div>
                          
                          <div className="mt-6 pt-4 border-t border-slate-100">
                            <button 
                              onClick={() => handleSaveChecklistState(incident.id)}
                              disabled={isSavingChecklist}
                              className="w-full bg-white text-indigo-600 border-2 border-indigo-100 hover:bg-indigo-50 hover:border-indigo-300 text-sm font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {isSavingChecklist ? 'Injecting Context...' : 'Save Configuration Context'}
                            </button>
                          </div>
                        </div>

                        {/* RIGHT DOMAIN: AI Generation Sequence Block */}
                        <div className="bg-white p-6 rounded border border-slate-200 shadow-sm flex flex-col">
                          <div className="flex justify-between items-center mb-5">
                             <h4 className="text-md font-bold text-slate-800 flex items-center">
                              <svg className="w-5 h-5 mr-2 text-indigo-500 shadow-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                              Automated Post-Mortem Compilation
                            </h4>
                            <button 
                              onClick={() => executeDraftSummaryGeneration(incident.id)}
                              disabled={isGenerating || incident.approved}
                              className="text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 py-1.5 px-3.5 rounded font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                            >
                              {isGenerating ? 'Compiling Parameters...' : 'Deploy AI Agent'}
                            </button>
                          </div>

                          <div className="bg-amber-50 border-l-4 border-amber-400 p-3.5 mb-5 rounded-r shadow-sm flex items-start">
                            <svg className="h-5 w-5 text-amber-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            <span className="text-xs text-amber-800 leading-tight">
                              <strong>Warning:</strong> This is an AI-generated draft. Review carefully before approving. False negatives may execute untested database permutations.
                            </span>
                          </div>

                          <textarea 
                            className="flex-grow w-full rounded-md border-slate-300 shadow-inner focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-4 border resize-none min-h-[160px] mb-5 text-slate-700 font-serif leading-relaxed"
                            value={draftSummary}
                            onChange={(e) => setDraftSummary(e.target.value)}
                            placeholder="Manually deploy the AI Agent to process the configuration context above into a cohesive post-mortem structural document that will map directly into the database output matrix..."
                            disabled={incident.approved}
                          />

                          <button 
                            onClick={() => finishSummaryApproval(incident)}
                            disabled={isApproving || incident.approved || !draftSummary.trim()}
                            className="w-full bg-slate-900 hover:bg-black text-white text-sm font-bold py-3 rounded-lg shadow-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {isApproving ? 'Verifying Validation Parameters...' : (incident.approved ? 'Formally Approved & Saved to Database' : 'Approve & Save Document')}
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

    </>
  );
}
