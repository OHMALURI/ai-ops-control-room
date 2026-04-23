import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';
import api from '../api.js';
import EvaluationDashboard from '../components/EvaluationDashboard.jsx';

const METRICS = [
  { key: 'quality_score',       label: 'Quality Score',        color: '#4f46e5', unit: '%' },
  { key: 'accuracy',            label: 'Accuracy',             color: '#6366f1', unit: '%' },
  { key: 'relevance_score',     label: 'Relevance',            color: '#0891b2', unit: '%' },
  { key: 'factuality_score',    label: 'Factuality',           color: '#16a34a', unit: '%' },
  { key: 'toxicity_score',      label: 'Safety',               color: '#ef4444', unit: '%' },
  { key: 'instruction_following', label: 'Instruction Following', color: '#9333ea', unit: '%' },
  { key: 'latency_ms',          label: 'Runtime',              color: '#f59e0b', unit: 'ms' },
];

function StatusBadge({ score, prevScore }) {
  if (score == null) return <span className="text-gray-300 text-xs">—</span>;

  // Rule 3: below 50 is always drift
  if (score < 50) return (
    <span className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-red-600 text-white shadow-md shadow-red-500/50 animate-pulse">
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-200 opacity-80" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
      </span>
      DRIFT
    </span>
  );

  // Rule 2: first run thresholds
  if (prevScore == null) {
    if (score < 70) return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700"><span className="inline-block w-2 h-2 rounded-full bg-yellow-400 animate-pulse shrink-0" />⚠ Warn</span>;
    return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700"><span className="inline-block w-2 h-2 rounded-full bg-green-500 shrink-0" />Good</span>;
  }

  // Subsequent runs: dropped from previous → warn, else good
  if (score < prevScore) return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700"><span className="inline-block w-2 h-2 rounded-full bg-yellow-400 animate-pulse shrink-0" />⚠ Warn</span>;
  return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700"><span className="inline-block w-2 h-2 rounded-full bg-green-500 shrink-0" />Good</span>;
}

export default function PerformanceLogs() {
  const [pageView, setPageView]       = useState('logs');  // 'logs' | 'eval_dashboard'
  const [services, setServices]       = useState([]);
  const [selected, setSelected]       = useState(null);
  const [logs, setLogs]               = useState([]);
  const [loading, setLoading]         = useState(false);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [activeMetric, setActiveMetric] = useState('quality_score');
  const [visibleLines, setVisibleLines] = useState({});
  const [search, setSearch]           = useState('');
  const [expandedEval, setExpandedEval] = useState(null);
  const [sampleFilter, setSampleFilter] = useState('all');

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
      .then(r => setLogs(r.data || []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [selected]);

  useEffect(() => {
    const initialVisible = {};
    METRICS.forEach(m => initialVisible[m.key] = true);
    setTimeout(() => setVisibleLines(initialVisible), 0);
  }, []);

  const toggleLine = (key) => setVisibleLines(p => ({ ...p, [key]: !p[key] }));
  const isAllSelected = METRICS.every(m => visibleLines[m.key]);
  const toggleAllLines = () => {
    const newVisible = {};
    METRICS.forEach(m => newVisible[m.key] = !isAllSelected);
    setVisibleLines(newVisible);
  };

  const chartData = [...logs].reverse().map(e => {
    const row = {
      time: new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      fullDate: new Date(e.timestamp).toLocaleString(),
    };
    METRICS.forEach(m => {
      row[m.key] = m.key === 'latency_ms' ? e[m.key] : parseFloat((e[m.key] || 0).toFixed(1));
    });
    return row;
  });

  const filteredLogs = logs.filter(e => {
    const ts = new Date(e.timestamp).toLocaleString().toLowerCase();
    return ts.includes(search.toLowerCase()) || String(e.quality_score).includes(search);
  });

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
          {[{ key: 'eval_dashboard', label: '📊 Evaluation Dashboard' }, { key: 'logs', label: '📋 Performance Logs' }].map(tab => (
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

          {/* Sidebar — service picker */}
          <aside className="w-56 shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <p className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">Services</p>
              {servicesLoading ? (
                <p className="px-4 py-4 text-sm text-gray-400 animate-pulse">Loading…</p>
              ) : services.length === 0 ? (
                <p className="px-4 py-4 text-sm text-gray-400">No services found.</p>
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

          {/* Main content */}
          <div className="flex-1 min-w-0 flex flex-col gap-5">

            {/* Evaluation Dashboard Tab */}
            {pageView === 'eval_dashboard' && <EvaluationDashboard service={selected} />}

            {/* Performance Logs Tab */}
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

            {/* Evaluation History */}
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
                              <td className="px-5 py-3 text-emerald-700 tabular-nums">{e.latency_ms ? `${e.latency_ms}ms` : '—'}</td>
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
                                        {['all', 'math', 'reasoning', 'knowledge', 'security'].map(cat => {
                                          const active = sampleFilter === cat;
                                          const colors = {
                                            all:       active ? 'bg-slate-800 text-white border-slate-800'       : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400',
                                            math:      active ? 'bg-indigo-600 text-white border-indigo-600'     : 'bg-white text-indigo-500 border-indigo-200 hover:border-indigo-400',
                                            reasoning: active ? 'bg-cyan-600 text-white border-cyan-600'         : 'bg-white text-cyan-600 border-cyan-200 hover:border-cyan-400',
                                            knowledge: active ? 'bg-green-600 text-white border-green-600'       : 'bg-white text-green-600 border-green-200 hover:border-green-400',
                                            security:  active ? 'bg-amber-500 text-white border-amber-500'       : 'bg-white text-amber-600 border-amber-200 hover:border-amber-400',
                                          };
                                          const count = cat === 'all' ? samples.length : samples.filter(s => s.category === cat).length;
                                          return (
                                            <button
                                              key={cat}
                                              onClick={() => setSampleFilter(cat)}
                                              className={`px-3 py-1 rounded-full text-[11px] font-bold border capitalize transition-all ${colors[cat]}`}
                                            >
                                              {cat} ({count})
                                            </button>
                                          );
                                        })}
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
