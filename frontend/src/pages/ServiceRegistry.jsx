import { useEffect, useState } from 'react';
import api from '../api.js';

const EMPTY_FORM = {
  name: '',
  owner: '',
  environment: 'dev',
  model_name: '',
  data_sensitivity: 'internal',
};

export default function ServiceRegistry() {
  const effectiveRole = localStorage.getItem("effectiveRole") || localStorage.getItem("role") || "user";
  const canConfigure  = effectiveRole === "admin" || effectiveRole === "maintainer";

  const [services, setServices] = useState([]);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [editState, setEditState] = useState({}); // { [id]: formValues }
  const [testResults, setTestResults] = useState({}); // { [id]: { success, latency_ms } }
  const [loading, setLoading] = useState(true);
  const [availableModels, setAvailableModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [serviceToDelete, setServiceToDelete] = useState(null);

  // Gemini API test state
  const [geminiTest, setGeminiTest] = useState(null);   // null | 'loading' | result obj
  const [geminiExpanded, setGeminiExpanded] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchServices = async () => {
    try {
      const r = await api.get('/services/');
      setServices(r.data);
    } finally {
      setLoading(false);
    }
  };

  const fetchModels = async () => {
    try {
      setModelsLoading(true);
      const r = await api.get('/services/available-models');
      setAvailableModels(r.data);
    } catch (err) {
      console.error("Failed to fetch models", err);
    } finally {
      setModelsLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
    fetchModels();
  }, []);

  // ── Add ────────────────────────────────────────────────────────────────────
  const handleAdd = async (e) => {
    e.preventDefault();
    await api.post('/services/', addForm);
    setAddForm(EMPTY_FORM);
    await fetchServices();
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const requestDelete = (service) => {
    setServiceToDelete(service);
  };

  const confirmDelete = async () => {
    if (!serviceToDelete) return;
    try {
      await api.delete(`/services/${serviceToDelete.id}`);
      setTestResults(prev => { const n = { ...prev }; delete n[serviceToDelete.id]; return n; });
      await fetchServices();
    } catch (err) {
      console.error("Failed to delete service:", err);
    }
    setServiceToDelete(null);
  };

  const cancelDelete = () => {
    setServiceToDelete(null);
  };

  // ── Edit helpers ───────────────────────────────────────────────────────────
  const startEdit = (service) => {
    setEditState(prev => ({
      ...prev,
      [service.id]: {
        name: service.name,
        owner: service.owner,
        environment: service.environment,
        model_name: service.model_name,
        data_sensitivity: service.data_sensitivity,
      },
    }));
  };

  const cancelEdit = (id) => {
    setEditState(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const handleEditChange = (id, field, value) => {
    setEditState(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const handleSave = async (id) => {
    try {
      await api.put(`/services/${id}`, editState[id]);
      await fetchServices();
      cancelEdit(id);
    } catch (err) {
      console.error("Failed to save service:", err);
    }
  };

  // ── Gemini API Test ────────────────────────────────────────────────────────
  const handleGeminiTest = async () => {
    setGeminiTest('loading');
    setGeminiExpanded(false);
    try {
      const { data } = await api.get('/services/test-gemini');
      setGeminiTest(data);
      setGeminiExpanded(true);
    } catch (err) {
      setGeminiTest({ success: false, latency_ms: 0, model: null, response_snippet: null, error: 'Request failed' });
      setGeminiExpanded(true);
    }
  };

  // ── OpenAI Service Test ────────────────────────────────────────────────────
  const toggleAutoEval = async (id) => {
    try {
      const { data } = await api.patch(`/services/${id}/auto-eval`);
      setServices(prev => prev.map(s => s.id === id ? { ...s, auto_eval_enabled: data.auto_eval_enabled } : s));
    } catch (e) {
      console.error('Failed to toggle auto-eval', e);
    }
  };

  const handleTest = async (id) => {
    setTestResults(prev => ({ ...prev, [id]: 'loading' }));
    try {
      const { data } = await api.post(`/services/${id}/test`);
      setTestResults(prev => ({ ...prev, [id]: data }));
    } catch {
      setTestResults(prev => ({ ...prev, [id]: { success: false, latency_ms: 0 } }));
    }
  };

  const TestBadge = ({ result }) => {
    if (result === 'loading')
      return <span className="ml-2 text-xs text-gray-400 animate-pulse">Testing…</span>;
    if (!result) return null;
    return result.success
      ? <span className="ml-2 text-xs font-semibold text-green-600 bg-green-100 rounded-full px-2 py-0.5">Pass {result.latency_ms}ms</span>
      : <span className="ml-2 text-xs font-semibold text-red-600 bg-red-100 rounded-full px-2 py-0.5">Fail</span>;
  };

  // ── Shared input style ─────────────────────────────────────────────────────
  const inp = 'border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400';
  const btn = (color) =>
    `inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded transition-colors ${color}`;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Service Registry</h1>

      {/* ── Gemini API Test Card ─────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 mb-6 flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* Left: branding + status dot */}
          <div className="flex items-center gap-3">
            {/* Gemini colour blob */}
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #4285F4 0%, #9B72CB 50%, #D96570 100%)' }}>
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-4H7l5-8v4h4l-5 8z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">
                Gemini Judge API
                {geminiTest && geminiTest !== 'loading' && (
                  <span className={`ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    geminiTest.success
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${geminiTest.success ? 'bg-green-500' : 'bg-red-500'}`} />
                    {geminiTest.success ? 'Connected' : 'Failed'}
                  </span>
                )}
              </p>
              <p className="text-[11px] text-gray-400">
                {geminiTest && geminiTest !== 'loading' && geminiTest.model
                  ? `Model: ${geminiTest.model}`
                  : 'Used as the LLM judge for all non-deterministic evaluations'}
              </p>
            </div>
          </div>

          {/* Right: test button + latency */}
          <div className="flex items-center gap-3">
            {geminiTest && geminiTest !== 'loading' && geminiTest.latency_ms > 0 && (
              <span className="text-xs text-gray-400 font-mono">{geminiTest.latency_ms}ms</span>
            )}
            <button
              onClick={handleGeminiTest}
              disabled={geminiTest === 'loading'}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {geminiTest === 'loading' ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Testing…
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Test Gemini API
                </>
              )}
            </button>
            {geminiTest && geminiTest !== 'loading' && (
              <button
                onClick={() => setGeminiExpanded(v => !v)}
                className="text-[11px] text-gray-400 hover:text-gray-600 underline"
              >
                {geminiExpanded ? 'Hide' : 'Details'}
              </button>
            )}
          </div>
        </div>

        {/* Expanded result panel */}
        {geminiExpanded && geminiTest && geminiTest !== 'loading' && (
          <div className={`rounded-lg border px-4 py-3 text-xs font-mono ${
            geminiTest.success
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {geminiTest.success ? (
              <div className="flex flex-col gap-1">
                <div><span className="font-bold text-green-600">Status :</span> Connected successfully</div>
                <div><span className="font-bold text-green-600">Model  :</span> {geminiTest.model}</div>
                <div><span className="font-bold text-green-600">Latency:</span> {geminiTest.latency_ms}ms</div>
                <div className="mt-1 border-t border-green-200 pt-1">
                  <span className="font-bold text-green-600">Response:</span>
                  <span className="ml-2 text-green-700 not-italic">{geminiTest.response_snippet}</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <div><span className="font-bold text-red-600">Status:</span> Connection failed</div>
                {geminiTest.model && <div><span className="font-bold text-red-600">Model :</span> {geminiTest.model}</div>}
                <div className="mt-1 border-t border-red-200 pt-1">
                  <span className="font-bold text-red-600">Error:</span>
                  <span className="ml-2 text-red-700 break-all">{geminiTest.error}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Add Service Form ────────────────────────────────────────────────── */}
      {!canConfigure && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-5 py-3 mb-6 text-sm">
          <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          You have read-only access. Contact an admin or maintainer to add, edit, or delete services.
        </div>
      )}
      {canConfigure && <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 mb-8">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">Add Service</h2>
        <form onSubmit={handleAdd} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <input
              className={inp}
              placeholder="Name"
              value={addForm.name}
              onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))}
              required
            />
            <input
              className={inp}
              placeholder="Owner"
              value={addForm.owner}
              onChange={e => setAddForm(p => ({ ...p, owner: e.target.value }))}
              required
            />
            <select
              className={inp}
              value={addForm.environment}
              onChange={e => setAddForm(p => ({ ...p, environment: e.target.value }))}
            >
              <option value="dev">dev</option>
              <option value="prod">prod</option>
            </select>
            <select
              className={`${inp} ${modelsLoading ? 'bg-gray-100 animate-pulse' : ''}`}
              value={addForm.model_name}
              onChange={e => setAddForm(p => ({ ...p, model_name: e.target.value }))}
              required
              disabled={modelsLoading}
            >
              <option value="" disabled>
                {modelsLoading ? 'Loading models...' : 'Select a model'}
              </option>
              {availableModels.map(m => {
                const errTag = m.reason === 'invalid_key' ? ' ⚠ Invalid Key' : m.reason === 'no_key' ? ' ⚠ No Key' : '';
                return (
                  <option key={m.id} value={m.id}>
                    {m.id}{errTag}
                  </option>
                );
              })}
            </select>
            <select
              className={inp}
              value={addForm.data_sensitivity}
              onChange={e => setAddForm(p => ({ ...p, data_sensitivity: e.target.value }))}
            >
              <option value="public">public</option>
              <option value="internal">internal</option>
              <option value="confidential">confidential</option>
            </select>
          </div>
          <div>
            <button
              type="submit"
              className={btn('bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-1.5')}
            >
              + Add
            </button>
          </div>
        </form>
      </section>}

      {/* ── Services Table ──────────────────────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto">
        {loading ? (
          <p className="text-sm text-gray-400 p-6">Loading services…</p>
        ) : services.length === 0 ? (
          <p className="text-sm text-gray-400 p-6">No services registered yet.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 uppercase text-xs tracking-wide">
              <tr>
                {['Name', 'Owner', 'Env', 'Provider', 'Model', 'Sensitivity', 'Auto Eval', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {services.map(service => {
                const isEditing = Boolean(editState[service.id]);
                const ef = editState[service.id] || {};

                return (
                  <tr key={service.id} className="hover:bg-gray-50 transition-colors">
                    {isEditing ? (
                      <>
                        <td className="px-4 py-2">
                          <input className={inp} value={ef.name}
                            onChange={e => handleEditChange(service.id, 'name', e.target.value)} />
                        </td>
                        <td className="px-4 py-2">
                          <input className={inp} value={ef.owner}
                            onChange={e => handleEditChange(service.id, 'owner', e.target.value)} />
                        </td>
                        <td className="px-4 py-2">
                          <select className={inp} value={ef.environment}
                            onChange={e => handleEditChange(service.id, 'environment', e.target.value)}>
                            <option value="dev">dev</option>
                            <option value="prod">prod</option>
                          </select>
                        </td>
                        <td className="px-4 py-2" />
                        <td className="px-4 py-2">
                          <select
                            className={`${inp} min-w-[140px]`}
                            value={ef.model_name}
                            onChange={e => handleEditChange(service.id, 'model_name', e.target.value)}
                          >
                            <option value={ef.model_name}>{ef.model_name}</option>
                            {availableModels.filter(m => m.id !== ef.model_name).map(m => {
                              const errTag = m.reason === 'invalid_key' ? ' ⚠ Invalid Key' : '';
                              return (
                                <option key={m.id} value={m.id}>
                                  {m.id}{errTag}
                                </option>
                              );
                            })}
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <select className={inp} value={ef.data_sensitivity}
                            onChange={e => handleEditChange(service.id, 'data_sensitivity', e.target.value)}>
                            <option value="public">public</option>
                            <option value="internal">internal</option>
                            <option value="confidential">confidential</option>
                          </select>
                        </td>
                        <td className="px-4 py-2" />
                        <td className="px-4 py-2 flex gap-2">
                          <button onClick={() => handleSave(service.id)}
                            className={btn('bg-green-600 hover:bg-green-700 text-white')}>Save</button>
                          <button onClick={() => cancelEdit(service.id)}
                            className={btn('bg-gray-200 hover:bg-gray-300 text-gray-600')}>Cancel</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-medium text-gray-800">{service.name}</td>
                        <td className="px-4 py-3 text-gray-600">{service.owner}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${service.environment === 'prod'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-blue-100 text-blue-700'
                            }`}>{service.environment}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.843-3.369 2.02-1.168a.076.076 0 0 1 .071 0l4.83 2.781a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.402-.671zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/></svg>
                            <span className="text-xs font-medium text-gray-600">OpenAI</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{service.model_name}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${service.data_sensitivity === 'confidential'
                              ? 'bg-red-100 text-red-700'
                              : service.data_sensitivity === 'internal'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-green-100 text-green-700'
                            }`}>{service.data_sensitivity}</span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toggleAutoEval(service.id)}
                            title={service.auto_eval_enabled ? 'Disable hourly auto-evaluation' : 'Enable hourly auto-evaluation'}
                            className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                              service.auto_eval_enabled ? 'bg-indigo-600' : 'bg-gray-300'
                            }`}
                          >
                            <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform duration-200 ${
                              service.auto_eval_enabled ? 'translate-x-[13px]' : 'translate-x-[2px]'
                            }`} />
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            {canConfigure && (
                              <>
                                <button onClick={() => startEdit(service)} title="Edit"
                                  className={btn('bg-yellow-100 hover:bg-yellow-200 text-yellow-800')}>
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                                </button>
                                <button onClick={() => requestDelete(service)} title="Delete"
                                  className={btn('bg-red-100 hover:bg-red-200 text-red-700')}>
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                                </button>
                              </>
                            )}
                            <button onClick={() => handleTest(service.id)} title="Test"
                              className={btn('bg-gray-100 hover:bg-gray-200 text-gray-700')}>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" /></svg>
                            </button>
                            <TestBadge result={testResults[service.id]} />
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* ── Delete Confirmation Modal ───────────────────────────────────────── */}
      {serviceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col transform transition-all">
            <div className="p-5 flex-1">
              <div className="flex items-center gap-3 text-red-600 mb-3">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 className="text-lg font-bold">Delete Service?</h3>
              </div>
              <p className="text-sm text-gray-600">
                Are you sure you want to delete <span className="font-semibold text-gray-800">{serviceToDelete.name}</span>? 
                This action cannot be undone and will remove all associated evaluation history.
              </p>
            </div>
            <div className="bg-gray-50 px-5 py-3 flex justify-end gap-2 border-t border-gray-100">
              <button 
                onClick={cancelDelete}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
