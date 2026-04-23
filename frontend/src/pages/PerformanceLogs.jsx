import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine
} from 'recharts';
import api from '../api.js';
import EvaluationDashboard from '../components/EvaluationDashboard.jsx';

const METRICS = [
  { key: 'quality_score',       label: 'Quality Score',           color: '#4f46e5', unit: '%' },
  { key: 'accuracy',            label: 'Accuracy',                color: '#6366f1', unit: '%' },
  { key: 'relevance_score',     label: 'Relevance',               color: '#0891b2', unit: '%' },
  { key: 'factuality_score',    label: 'Factuality',              color: '#16a34a', unit: '%' },
  { key: 'toxicity_score',      label: 'Safety',                  color: '#ef4444', unit: '%' },
  { key: 'instruction_following', label: 'Instruction Following', color: '#9333ea', unit: '%' },
  { key: 'latency_ms',          label: 'Runtime',                 color: '#f59e0b', unit: 'ms' },
];

const COMPARE_METRICS = [
  { key: 'quality_score',    label: 'Avg Quality Score' },
  { key: 'accuracy',         label: 'Math'              },
  { key: 'relevance_score',  label: 'Reasoning'         },
  { key: 'factuality_score', label: 'Knowledge'         },
  { key: 'toxicity_score',   label: 'Security'          },
];

const SVC_COLORS = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b'];

function buildCompareChartData(ids, dataMap, metric) {
  const reversed = ids.map(id => [...(dataMap[id] || [])].reverse());
  const maxLen = Math.max(...reversed.map(a => a.length), 0);
  return Array.from({ length: maxLen }, (_, i) => {
    const pt = { run: `#${i + 1}` };
    ids.forEach((id, idx) => { pt[id] = reversed[idx][i]?.[metric] ?? null; });
    return pt;
  });
}

function StatusBadge({ score, prevScore }) {
  if (score == null) return <span className="text-gray-300 text-xs">—</span>;
  if (score < 50) return (
    <span className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-red-600 text-white shadow-md shadow-red-500/50 animate-pulse">
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-200 opacity-80" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
      </span>
      DRIFT
    </span>
  );
  if (prevScore == null) {
    if (score < 70) return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700"><span className="inline-block w-2 h-2 rounded-full bg-yellow-400 animate-pulse shrink-0" />⚠ Warn</span>;
    return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700"><span className="inline-block w-2 h-2 rounded-full bg-green-500 shrink-0" />Good</span>;
  }
  if (score < prevScore) return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700"><span className="inline-block w-2 h-2 rounded-full bg-yellow-400 animate-pulse shrink-0" />⚠ Warn</span>;
  return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700"><span className="inline-block w-2 h-2 rounded-full bg-green-500 shrink-0" />Good</span>;
}

/* ── Compare tooltip ─────────────────────────────────────────── */
function CompareTooltip({ active, payload, label, services, compareIds }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.10)', minWidth: 160 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 6 }}>Run {label}</p>
      {payload.map(p => {
        const svc = services.find(s => String(s.id) === String(p.dataKey));
        return (
          <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.stroke, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: '#374151', flex: 1 }}>{svc?.name ?? p.dataKey}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: p.stroke }}>
              {p.value != null ? `${p.value.toFixed(1)}%` : '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function PerformanceLogs() {
  const [pageView, setPageView]       = useState('logs');
  const [services, setServices]       = useState([]);
  const [selected, setSelected]       = useState(null);
  const [logs, setLogs]               = useState([]);
  const [loading, setLoading]         = useState(false);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [search, setSearch]           = useState('');
  const [expandedEval, setExpandedEval] = useState(null);
  const [sampleFilter, setSampleFilter] = useState('all');

  /* ── Compare state ── */
  const [compareIds,    setCompareIds]    = useState([]);
  const [compareData,   setCompareData]   = useState({});
  const [compareLoading, setCompareLoading] = useState(new Set());
  const [compareMetric, setCompareMetric] = useState('quality_score');

  useEffect(() => {
    api.get('/services/')
      .then(r => {
        setServices(r.data);
        if (r.data.length > 0) setSelected(r.data[0]);
      })
      .catch(console.error)
      .finally(() => setServicesLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    api.get(`/evaluations/${selected.id}`)
      .then(r => setLogs(r.data.items || r.data || []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [selected]);

  useEffect(() => {
    const initialVisible = {};
    METRICS.forEach(m => initialVisible[m.key] = true);
    setTimeout(() => setVisibleLines(initialVisible), 0);
  }, []);

  /* fetch data for newly selected compare services */
  useEffect(() => {
    compareIds.forEach(id => {
      if (compareData[id] !== undefined || compareLoading.has(id)) return;
      setCompareLoading(prev => new Set([...prev, id]));
      api.get(`/evaluations/${id}`)
        .then(r => setCompareData(prev => ({ ...prev, [id]: r.data.items || r.data || [] })))
        .catch(() => setCompareData(prev => ({ ...prev, [id]: [] })))
        .finally(() => setCompareLoading(prev => { const s = new Set(prev); s.delete(id); return s; }));
    });
  }, [compareIds]);

  const filteredLogs = logs.filter(e => {
    const ts = new Date(e.timestamp).toLocaleString().toLowerCase();
    return ts.includes(search.toLowerCase()) || String(e.quality_score).includes(search);
  });

  /* ── Compare helpers ── */
  function toggleCompareService(id) {
    if (compareIds.includes(id)) {
      setCompareIds(prev => prev.filter(x => x !== id));
      setCompareData(prev => { const d = { ...prev }; delete d[id]; return d; });
    } else if (compareIds.length < 4) {
      setCompareIds(prev => [...prev, id]);
    }
  }

  const compareChartData = buildCompareChartData(compareIds, compareData, compareMetric);
  const activeMetricLabel = COMPARE_METRICS.find(m => m.key === compareMetric)?.label ?? '';
  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Performance & Evaluations</h1>
          <p className="text-slate-500 mt-1 text-base">Run evaluations, view logs, and monitor model performance.</p>
        </div>

        {/* Page tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {[
            { key: 'eval_dashboard', label: '📊 Evaluation Dashboard' },
            { key: 'logs',           label: '📋 Performance Logs'     },
            { key: 'compare',        label: '⚖️ Compare'              },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setPageView(tab.key)}
              className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                pageView === tab.key
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex gap-6">

          {/* Sidebar */}
          <aside className="w-56 shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Services</p>
                {pageView === 'compare' && (
                  <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                    {compareIds.length}/4
                  </span>
                )}
              </div>
              {servicesLoading ? (
                <p className="px-4 py-4 text-sm text-gray-400 animate-pulse">Loading…</p>
              ) : services.length === 0 ? (
                <p className="px-4 py-4 text-sm text-gray-400">No services found.</p>
              ) : pageView === 'compare' ? (
                <ul>
                  {services.map(s => {
                    const isChecked  = compareIds.includes(s.id);
                    const colorIdx   = compareIds.indexOf(s.id);
                    const isDisabled = !isChecked && compareIds.length >= 4;
                    return (
                      <li key={s.id}>
                        <button
                          onClick={() => toggleCompareService(s.id)}
                          disabled={isDisabled}
                          className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors border-l-4 ${
                            isChecked
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                              : isDisabled
                              ? 'border-transparent text-gray-300 cursor-not-allowed'
                              : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-0.5">
                            {isChecked ? (
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: SVC_COLORS[colorIdx] }} />
                            ) : (
                              <span className={`w-2.5 h-2.5 rounded-full shrink-0 border-2 ${isDisabled ? 'border-gray-200' : 'border-gray-300'}`} />
                            )}
                            <span className="block truncate flex-1">{s.name}</span>
                          </div>
                          <span className={`text-xs font-semibold ml-4 ${s.environment === 'prod' ? 'text-red-500' : 'text-blue-500'}`}>
                            {s.environment?.toUpperCase()}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <ul>
                  {services.map(s => (
                    <li key={s.id}>
                      <button
                        onClick={() => setSelected(s)}
                        className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors border-l-4 ${
                          selected?.id === s.id
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-800'
                            : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <span className="block truncate">{s.name}</span>
                        <span className={`text-xs font-semibold ${s.environment === 'prod' ? 'text-red-500' : 'text-blue-500'}`}>
                          {s.environment?.toUpperCase()}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>

          {/* ══ Main content ══ */}
          <div className="flex-1 min-w-0 flex flex-col gap-5">

            {/* ── Evaluation Dashboard tab ── */}
            {pageView === 'eval_dashboard' && <EvaluationDashboard service={selected} />}

            {/* ── Compare tab ── */}
            {pageView === 'compare' && (
              <>
                {/* Metric selector */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Metric to Compare</p>
                  <div className="flex flex-wrap gap-2">
                    {COMPARE_METRICS.map(m => (
                      <button
                        key={m.key}
                        onClick={() => setCompareMetric(m.key)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
                          compareMetric === m.key
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {compareIds.length === 0 ? (
                  /* Empty state */
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center py-20 text-center gap-3">
                    <svg className="w-12 h-12 text-gray-200" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <p className="text-gray-500 font-medium">Select up to 4 services from the sidebar</p>
                    <p className="text-xs text-gray-400">Each service's {activeMetricLabel} history will appear here</p>
                  </div>
                ) : (
                  <>
                    {/* Chart */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-sm font-bold text-gray-800">{activeMetricLabel} — Evaluation History</h3>
                          <p className="text-xs text-gray-400 mt-0.5">Oldest → newest run per service</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          {compareIds.map((id, idx) => {
                            const svc = services.find(s => s.id === id);
                            return (
                              <span key={id} className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: SVC_COLORS[idx] }} />
                                {svc?.name}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {compareLoading.size > 0 && compareChartData.length === 0 ? (
                        <div className="flex items-center justify-center h-56 text-gray-400 text-sm animate-pulse gap-2">
                          <svg className="w-4 h-4 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                          </svg>
                          Loading data…
                        </div>
                      ) : compareChartData.length === 0 ? (
                        <div className="flex items-center justify-center h-56 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
                          No evaluation data for selected services
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height={280}>
                          <LineChart data={compareChartData} margin={{ top: 5, right: 16, bottom: 20, left: -20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="run" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} dy={6} />
                            <YAxis domain={[0, 100]} stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false}
                              tickFormatter={v => `${v}%`} />
                            <ReferenceLine y={70} stroke="#fbbf24" strokeDasharray="4 3" strokeWidth={1} label={{ value: '70%', fill: '#d97706', fontSize: 9, position: 'right' }} />
                            <Tooltip content={<CompareTooltip services={services} compareIds={compareIds} />} />
                            {compareIds.map((id, idx) => (
                              <Line
                                key={id}
                                type="monotone"
                                dataKey={id}
                                name={services.find(s => s.id === id)?.name ?? id}
                                stroke={SVC_COLORS[idx]}
                                strokeWidth={2.5}
                                dot={{ r: 3.5, fill: SVC_COLORS[idx], stroke: '#fff', strokeWidth: 1.5 }}
                                activeDot={{ r: 5.5, fill: SVC_COLORS[idx], stroke: '#fff', strokeWidth: 2 }}
                                connectNulls
                                animationDuration={600}
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>

                    {/* Service comparison cards */}
                    <div className={`grid gap-4 ${compareIds.length <= 2 ? 'grid-cols-2' : 'grid-cols-2 xl:grid-cols-4'}`}>
                      {compareIds.map((id, idx) => {
                        const svc     = services.find(s => s.id === id);
                        const evals   = compareData[id] || [];
                        const latest  = evals[0]?.[compareMetric];
                        const prev    = evals[1]?.[compareMetric];
                        const isLoading = compareLoading.has(id);
                        const color   = SVC_COLORS[idx];
                        const delta   = latest != null && prev != null ? latest - prev : null;
                        const scoreColor = latest == null ? 'text-gray-400'
                          : latest >= 80 ? 'text-green-600'
                          : latest >= 55 ? 'text-yellow-600'
                          : 'text-red-600';

                        return (
                          <div
                            key={id}
                            className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 overflow-hidden"
                            style={{ borderTop: `3px solid ${color}` }}
                          >
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                                  <h4 className="font-bold text-gray-800 text-sm truncate">{svc?.name}</h4>
                                </div>
                                <span className={`text-[10px] font-bold ${svc?.environment === 'prod' ? 'text-red-500' : 'text-blue-500'}`}>
                                  {svc?.environment?.toUpperCase()}
                                </span>
                              </div>
                              <button
                                onClick={() => toggleCompareService(id)}
                                className="text-gray-300 hover:text-red-400 transition-colors shrink-0"
                                title="Remove from compare"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>

                            {isLoading ? (
                              <div className="animate-pulse">
                                <div className="h-7 w-20 bg-gray-100 rounded mb-1" />
                                <div className="h-3 w-28 bg-gray-100 rounded" />
                              </div>
                            ) : (
                              <>
                                <p className={`text-2xl font-extrabold tabular-nums ${scoreColor}`}>
                                  {latest != null ? `${latest.toFixed(1)}%` : '—'}
                                </p>
                                <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wider">{activeMetricLabel} · latest</p>
                                {delta != null && (
                                  <p className={`text-xs font-semibold mt-1.5 flex items-center gap-1 ${delta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                    {delta >= 0
                                      ? <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7"/></svg>
                                      : <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                                    }
                                    {Math.abs(delta).toFixed(1)}% vs prev run
                                  </p>
                                )}
                                <div className="mt-2.5 pt-2.5 border-t border-gray-100 text-[10px] text-gray-400">
                                  {evals.length} eval{evals.length !== 1 ? 's' : ''} total
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            )}

            {/* ── Performance Logs tab ── */}
            {pageView === 'logs' && (
            <>
            {selected && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center justify-between text-sm flex-wrap gap-4">
                <div>
                  <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px] block mb-0.5">Owner</span>
                  <span className="font-semibold text-gray-800">{selected.owner || '—'}</span>
                </div>
                <div>
                  <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px] block mb-0.5">Environment</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${selected.environment === 'prod' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                    {selected.environment?.toUpperCase() || '—'}
                  </span>
                </div>
                <div className="flex-1">
                  <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px] block mb-0.5">Model Name</span>
                  <span className="font-mono text-gray-700 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">{selected.model_name || '—'}</span>
                </div>
                <div>
                  <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px] block mb-0.5">Data Sensitivity</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${selected.data_sensitivity === 'confidential' ? 'bg-red-100 text-red-700' : selected.data_sensitivity === 'internal' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                    {selected.data_sensitivity?.toUpperCase() || '—'}
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-1 border-b border-gray-200 mb-1">
              <span className="px-4 py-2 text-sm font-semibold border-b-2 border-indigo-600 text-indigo-700">Evaluation History</span>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-bold text-gray-700">
                  Evaluation History {selected ? `— ${selected.name}` : ''}
                  {logs.length > 0 && <span className="ml-2 text-xs font-normal text-gray-400">({logs.length} records)</span>}
                </h2>
                <input
                  type="text"
                  placeholder="Search…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 w-48"
                />
              </div>
              {loading ? (
                <p className="text-sm text-gray-400 animate-pulse px-5 py-6">Loading logs…</p>
              ) : filteredLogs.length === 0 ? (
                <p className="text-sm text-gray-400 px-5 py-6">No records found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-xs tracking-wide">
                      <tr>
                        <th className="px-5 py-3 text-left font-semibold">Timestamp</th>
                        <th className="px-5 py-3 text-left font-semibold">Quality Score</th>
                        <th className="px-5 py-3 text-left font-semibold">Runtime</th>
                        <th className="px-5 py-3 text-left font-semibold">Status</th>
                        <th className="px-5 py-3 text-right font-semibold">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 object-top">
                      {filteredLogs.map((e, idx) => {
                        const isExp = expandedEval === e.id;
                        const prevScore = filteredLogs[idx + 1]?.quality_score ?? null;
                        let samples = [];
                        try {
                          const parsed = JSON.parse(e.check_results);
                          if (parsed?.per_sample_scores) samples = parsed.per_sample_scores;
                        } catch { /* ignore */ }

                        return (
                          <React.Fragment key={e.id}>
                            <tr className="hover:bg-slate-50 transition-colors">
                              <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{new Date(e.timestamp).toLocaleString()}</td>
                              <td className="px-5 py-3 font-semibold text-indigo-700 tabular-nums">{e.quality_score != null ? `${e.quality_score.toFixed(1)}%` : '—'}</td>
                              <td className="px-5 py-3 text-emerald-700 tabular-nums">{e.latency_ms ? `${(e.latency_ms / 1000).toFixed(1)}s` : '—'}</td>
                              <td className="px-5 py-3"><StatusBadge score={e.quality_score} prevScore={prevScore} /></td>
                              <td className="px-5 py-3 text-right">
                                <button
                                  onClick={() => { setExpandedEval(isExp ? null : e.id); setSampleFilter('all'); }}
                                  className="text-xs px-3 py-1 font-semibold rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                                >
                                  {isExp ? 'Hide Logs' : 'View Logs'}
                                </button>
                              </td>
                            </tr>
                            {isExp && (
                              <tr>
                                <td colSpan={5} className="bg-slate-50 p-6 border-b border-gray-200">
                                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden flex flex-col gap-4 p-4">
                                    <div className="flex items-center justify-between flex-wrap gap-3 border-b pb-3">
                                      <h4 className="font-bold text-sm text-gray-700">Sample Evaluation Details</h4>
                                      <div className="flex gap-1.5 flex-wrap">
                                        {(() => {
                                          const catAvg = (cat) => {
                                            const s = samples.filter(x => x.category === cat);
                                            if (!s.length) return null;
                                            const avg = s.reduce((sum, x) => sum + (x.score_pct ?? (x.si != null ? x.si * 100 : 0)), 0) / s.length;
                                            return avg;
                                          };
                                          const allAvg = samples.length
                                            ? samples.reduce((sum, x) => sum + (x.score_pct ?? (x.si != null ? x.si * 100 : 0)), 0) / samples.length
                                            : null;
                                          return ['all', 'math', 'reasoning', 'knowledge', 'security'].map(cat => {
                                            const active = sampleFilter === cat;
                                            const colors = {
                                              all:       active ? 'bg-slate-800 text-white border-slate-800'       : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400',
                                              math:      active ? 'bg-indigo-600 text-white border-indigo-600'     : 'bg-white text-indigo-500 border-indigo-200 hover:border-indigo-400',
                                              reasoning: active ? 'bg-cyan-600 text-white border-cyan-600'         : 'bg-white text-cyan-600 border-cyan-200 hover:border-cyan-400',
                                              knowledge: active ? 'bg-green-600 text-white border-green-600'       : 'bg-white text-green-600 border-green-200 hover:border-green-400',
                                              security:  active ? 'bg-amber-500 text-white border-amber-500'       : 'bg-white text-amber-600 border-amber-200 hover:border-amber-400',
                                            };
                                            const count = cat === 'all' ? samples.length : samples.filter(s => s.category === cat).length;
                                            const avg   = cat === 'all' ? allAvg : catAvg(cat);
                                            return (
                                              <button
                                                key={cat}
                                                onClick={() => setSampleFilter(cat)}
                                                className={`px-3 py-1 rounded-full text-[11px] font-bold border capitalize transition-all ${colors[cat]}`}
                                              >
                                                {cat} ({count}){avg != null ? ` · ${avg.toFixed(0)}%` : ''}
                                              </button>
                                            );
                                          });
                                        })()}
                                      </div>
                                    </div>
                                    {samples.length === 0 ? (
                                      <p className="text-xs text-gray-500">No sample details available.</p>
                                    ) : (
                                      samples.filter(s => sampleFilter === 'all' || s.category === sampleFilter).map((s, idx) => {
                                        const scorePct = s.score_pct ?? (s.si != null ? s.si * 100 : null);
                                        const methodColor = s.method?.startsWith('exact') ? 'bg-blue-100 text-blue-700'
                                          : s.method?.startsWith('safety') ? 'bg-orange-100 text-orange-700'
                                          : 'bg-purple-100 text-purple-700';
                                        return (
                                          <div key={idx} className="bg-gray-50 p-4 rounded border border-gray-100 flex flex-col gap-2">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              {s.category && (
                                                <span className="text-[10px] font-bold bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded uppercase tracking-wider">{s.category}</span>
                                              )}
                                              {s.expected_behavior && (
                                                <span className={`text-[9px] font-bold px-1 rounded ${s.expected_behavior === 'refuse' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                                  {s.expected_behavior}
                                                </span>
                                              )}
                                              {s.method && (
                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${methodColor}`}>{s.method}</span>
                                              )}
                                              {scorePct != null && (
                                                <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded ${scorePct >= 80 ? 'bg-green-100 text-green-700' : scorePct >= 55 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                                  Score: {scorePct.toFixed(0)}%
                                                </span>
                                              )}
                                            </div>
                                            <div>
                                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Input</span>
                                              <p className="text-xs font-mono text-gray-700 mt-1 whitespace-pre-wrap">{s.input}</p>
                                            </div>
                                            <div className="flex gap-4">
                                              <div className="flex-1 bg-green-50 p-2 rounded border border-green-100">
                                                <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Expected</span>
                                                <p className="text-xs font-mono text-green-800 mt-1 break-words">{s.expected_output}</p>
                                              </div>
                                              <div className="flex-1 bg-blue-50 p-2 rounded border border-blue-100">
                                                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Actual Output</span>
                                                <p className="text-xs font-mono text-blue-800 mt-1 break-words">{s.actual_output || '—'}</p>
                                              </div>
                                            </div>
                                            {s.explanation && (
                                              <div className="bg-white border border-gray-200 rounded px-3 py-1.5">
                                                <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Judge Note</span>
                                                <p className="text-xs italic text-gray-500 mt-0.5">{s.explanation}</p>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            </>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
