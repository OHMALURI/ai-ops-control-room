import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';
import api from '../api.js';

const BENCHMARKS = [
  { key: 'graphwalks', label: 'Graphwalks', color: '#3b82f6' },
  { key: 'alpacaeval', label: 'AlpacaEval', color: '#ec4899' },
  { key: 'cruxeval',   label: 'CRUXEval', color: '#f97316' },
  { key: 'agentharm',  label: 'AgentHarm', color: '#ef4444' },
  { key: 'videomme',   label: 'Video-MME', color: '#a855f7' },
  { key: 'colbench',   label: 'ColBench', color: '#14b8a6' },
];

const METRICS = [
  { key: 'quality_score', label: 'Quality Score', color: '#4f46e5', unit: '%' },
  { key: 'accuracy', label: 'Accuracy', color: '#6366f1', unit: '%' },
  { key: 'relevance_score', label: 'Relevance', color: '#0891b2', unit: '%' },
  { key: 'factuality_score', label: 'Factuality', color: '#16a34a', unit: '%' },
  { key: 'toxicity_score', label: 'Safety', color: '#ef4444', unit: '%' },
  { key: 'instruction_following', label: 'Instruction Following', color: '#9333ea', unit: '%' },
  { key: 'latency_ms', label: 'Latency', color: '#f59e0b', unit: 'ms' },
];

function StatusBadge({ score }) {
  if (score == null) return null;
  if (score >= 80) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">Good</span>;
  if (score >= 50) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">Warn</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">Poor</span>;
}

export default function PerformanceLogs() {
  const [services, setServices]       = useState([]);
  const [selected, setSelected]       = useState(null);
  const [logs, setLogs]               = useState([]);
  const [loading, setLoading]         = useState(false);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [viewMode, setViewMode]       = useState('by_benchmark'); // 'by_benchmark' | 'by_metric'
  const [activeBenchmark, setActiveBenchmark] = useState('alpacaeval');
  const [activeMetric, setActiveMetric] = useState('quality_score');
  const [visibleLines, setVisibleLines] = useState({});
  const [search, setSearch]           = useState('');
  const [tableBenchmarkFilter, setTableBenchmarkFilter] = useState('all');
  const [activeTab, setActiveTab]     = useState('evals');   // 'evals' | 'judge'
  const [judgeHistory, setJudgeHistory] = useState([]);
  const [judgeLoading, setJudgeLoading] = useState(false);
  const [expandedRaw, setExpandedRaw] = useState(null);
  const [expandedEval, setExpandedEval] = useState(null);

  // Fetch all services on mount
  useEffect(() => {
    api.get('/services/')
      .then(r => {
        setServices(r.data);
        if (r.data.length > 0) setSelected(r.data[0]);
      })
      .catch(console.error)
      .finally(() => setServicesLoading(false));
  }, []);

  // Fetch evaluations whenever selected service changes
  useEffect(() => {
    if (!selected) return;
    const fetchSelectedData = async () => {
      setLoading(true);
      try {
        const r = await api.get(`/evaluations/${selected.id}`);
        setLogs(r.data || []);
      } catch {
        setLogs([]);
      } finally {
        setLoading(false);
      }

      setJudgeLoading(true);
      try {
        const r2 = await api.get(`/drift-judge/${selected.id}`);
        setJudgeHistory(r2.data || []);
      } catch {
        setJudgeHistory([]);
      } finally {
        setJudgeLoading(false);
      }
    };
    fetchSelectedData();
  }, [selected]);

  // Initialize visible lines when mode changes
  useEffect(() => {
    const keys = viewMode === 'by_benchmark' ? METRICS.map(m => m.key) : BENCHMARKS.map(b => b.key);
    const initialVisible = {};
    keys.forEach(k => initialVisible[k] = true);
    setTimeout(() => setVisibleLines(initialVisible), 0);
  }, [viewMode]);

  const toggleLine = (key) => setVisibleLines(p => ({ ...p, [key]: !p[key] }));

  const activeLegendItems = viewMode === 'by_benchmark' ? METRICS : BENCHMARKS;
  const isAllSelected = activeLegendItems.every(i => visibleLines[i.key]);

  const toggleAllLines = () => {
    const newVisible = { ...visibleLines };
    activeLegendItems.forEach(i => newVisible[i.key] = !isAllSelected);
    setVisibleLines(newVisible);
  };

  // Chart data — reverse to chronological order
  const chartData = [...logs].reverse().map(e => {
    const base = {
      time: new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      fullDate: new Date(e.timestamp).toLocaleString(),
    };
    
    if (viewMode === 'by_benchmark') {
      if ((e.dataset_type || 'alpacaeval') === activeBenchmark) {
         METRICS.forEach(m => base[m.key] = m.key === 'latency_ms' ? e[m.key] : parseFloat((e[m.key] || 0).toFixed(1)));
         return base;
      }
      return null;
    } else {
      base[e.dataset_type || 'alpacaeval'] = activeMetric === 'latency_ms' ? e[activeMetric] : parseFloat((e[activeMetric] || 0).toFixed(1));
      return base;
    }
  }).filter(Boolean);

  // Filtered table rows
  const filteredLogs = logs.filter(e => {
    const ts = new Date(e.timestamp).toLocaleString().toLowerCase();
    const searchMatch = ts.includes(search.toLowerCase()) || String(e.quality_score).includes(search);
    const bmMatch = tableBenchmarkFilter === 'all' || (e.dataset_type || 'alpacaeval') === tableBenchmarkFilter;
    return searchMatch && bmMatch;
  });


  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Performance Logs</h1>
          <p className="text-slate-500 mt-1 text-base">Evaluation history, quality scores, and latency trends per service.</p>
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

            {/* Service Metadata */}
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

            {/* Chart */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              
              {/* Controls Header */}
              <div className="flex flex-col gap-4 mb-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-gray-700">
                    {selected ? `${selected.name} — Trends` : 'Select a service'}
                  </h2>
                  <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button
                      onClick={() => setViewMode('by_benchmark')}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'by_benchmark' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      View by Benchmark
                    </button>
                    <button
                      onClick={() => setViewMode('by_metric')}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'by_metric' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      View by Metric
                    </button>
                  </div>
                </div>
                
                <div className="flex gap-3 items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {viewMode === 'by_benchmark' ? 'Select Benchmark:' : 'Select Metric:'}
                  </span>
                  <div className="flex gap-2 flex-wrap">
                    {(viewMode === 'by_benchmark' ? BENCHMARKS : METRICS).map((item) => (
                      <button
                        key={item.key}
                        onClick={() => viewMode === 'by_benchmark' ? setActiveBenchmark(item.key) : setActiveMetric(item.key)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors border ${
                          (viewMode === 'by_benchmark' ? activeBenchmark : activeMetric) === item.key
                            ? 'text-white border-transparent shadow-sm'
                            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                        }`}
                        style={(viewMode === 'by_benchmark' ? activeBenchmark : activeMetric) === item.key ? { backgroundColor: item.color, borderColor: item.color } : {}}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="h-64 flex items-center justify-center text-gray-400 animate-pulse text-sm">
                  Loading chart…
                </div>
              ) : chartData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-gray-400 text-sm border-2 border-dashed rounded-lg">
                  No evaluation data matched for this view.
                </div>
              ) : (
                <>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 5, right: 16, bottom: 5, left: -10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis
                          dataKey="time"
                          stroke="#94a3b8"
                          fontSize={11}
                          tick={{ fill: '#475569', fontWeight: 500 }}
                          tickLine={false}
                          axisLine={{ stroke: '#e2e8f0' }}
                          dy={8}
                        />
                        <YAxis
                          stroke="#94a3b8"
                          fontSize={11}
                          tick={{ fill: '#475569' }}
                          tickLine={false}
                          axisLine={false}
                          domain={['auto', 'auto']}
                        />
                        <Tooltip
                          contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.07)' }}
                          labelStyle={{ fontWeight: 700, color: '#1e293b', marginBottom: 4 }}
                          labelFormatter={(label, payload) => payload?.[0]?.payload?.fullDate || label}
                          formatter={(val, name) => {
                            if (viewMode === 'by_benchmark') {
                              const m = METRICS.find(x => x.key === name || x.label === name);
                              return [`${val != null ? val : '—'}${m ? m.unit : ''}`, m ? m.label : name];
                            } else {
                              const metric = METRICS.find(x => x.key === activeMetric);
                              const b = BENCHMARKS.find(x => x.key === name || x.label === name);
                              return [`${val != null ? val : '—'}${metric ? metric.unit : ''}`, b ? b.label : name];
                            }
                          }}
                        />
                        {(viewMode === 'by_benchmark' ? METRICS : BENCHMARKS).filter(item => visibleLines[item.key]).map(item => (
                          <Line
                            key={item.key}
                            type="monotone"
                            dataKey={item.key}
                            name={item.label}
                            stroke={item.color}
                            strokeWidth={2.5}
                            dot={{ r: 3, fill: item.color, strokeWidth: 2, stroke: '#fff' }}
                            activeDot={{ r: 6 }}
                            animationDuration={800}
                            connectNulls
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Checklist Legend */}
                  <div className="mt-6 pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Visible Lines</p>
                      <button 
                        onClick={toggleAllLines}
                        className="text-[11px] font-bold text-indigo-500 hover:text-indigo-700 uppercase tracking-widest transition-colors px-2 py-1 rounded hover:bg-indigo-50"
                      >
                        {isAllSelected ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-3 px-2">
                      {(viewMode === 'by_benchmark' ? METRICS : BENCHMARKS).map(item => (
                        <label key={item.key} className="flex items-center gap-2.5 text-sm cursor-pointer select-none group">
                          <div className="relative flex items-center justify-center">
                            <input 
                              type="checkbox"
                              checked={!!visibleLines[item.key]}
                              onChange={() => toggleLine(item.key)}
                              className="w-4 h-4 rounded border-gray-300 transition-colors cursor-pointer appearance-none checked:border-transparent"
                              style={{ 
                                backgroundColor: visibleLines[item.key] ? item.color : '#fff',
                                borderColor: visibleLines[item.key] ? item.color : '#d1d5db'
                              }}
                            />
                            {visibleLines[item.key] && (
                              <svg className="w-3 h-3 absolute text-white pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className={`font-semibold transition-colors ${visibleLines[item.key] ? 'text-gray-700' : 'text-gray-400'}`}>
                            {item.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-gray-200 mb-1">
              {[{ key: 'evals', label: 'Evaluation History' }, { key: 'judge', label: 'Drift Judge History' }].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-indigo-600 text-indigo-700'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                  {tab.key === 'judge' && judgeHistory.length > 0 && (
                    <span className="ml-1.5 bg-indigo-100 text-indigo-700 text-xs font-bold px-1.5 py-0.5 rounded-full">{judgeHistory.length}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Evaluation History Tab */}
            {activeTab === 'evals' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-bold text-gray-700">
                  Evaluation History {selected ? `— ${selected.name}` : ''}
                  {logs.length > 0 && <span className="ml-2 text-xs font-normal text-gray-400">({logs.length} records)</span>}
                </h2>
                <div className="flex gap-3">
                  <select
                    value={tableBenchmarkFilter}
                    onChange={e => setTableBenchmarkFilter(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-700 font-semibold"
                  >
                    <option value="all">All Benchmarks</option>
                    {BENCHMARKS.map(b => (
                      <option key={b.key} value={b.key}>{b.label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Search…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 w-48"
                  />
                </div>
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
                        <th className="px-5 py-3 text-left font-semibold">Benchmark</th>
                        <th className="px-5 py-3 text-left font-semibold">Quality Score</th>
                        <th className="px-5 py-3 text-left font-semibold">Latency</th>
                        <th className="px-5 py-3 text-left font-semibold">Drift</th>
                        <th className="px-5 py-3 text-left font-semibold">Status</th>
                        <th className="px-5 py-3 text-right font-semibold">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 object-top">
                      {filteredLogs.map((e) => {
                        const isExp = expandedEval === e.id;
                        let samples = [];
                        try {
                          const parsed = JSON.parse(e.check_results);
                          if (parsed && parsed.per_sample_scores) {
                            samples = parsed.per_sample_scores;
                          }
                        } catch {
                          // ignore json parse error
                        }
                        const btype = e.dataset_type || 'alpacaeval';
                        const benchmark = BENCHMARKS.find(x => x.key === btype);

                        return (
                          <React.Fragment key={e.id}>
                            <tr className="hover:bg-slate-50 transition-colors">
                              <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{new Date(e.timestamp).toLocaleString()}</td>
                              <td className="px-5 py-3">
                                {benchmark ? (
                                  <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ backgroundColor: `${benchmark.color}15`, color: benchmark.color }}>
                                    {benchmark.label}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">{btype}</span>
                                )}
                              </td>
                              <td className="px-5 py-3 font-semibold text-indigo-700 tabular-nums">{e.quality_score != null ? `${e.quality_score.toFixed(1)}%` : '—'}</td>
                              <td className="px-5 py-3 text-emerald-700 tabular-nums">{e.latency_ms ? `${e.latency_ms}ms` : '—'}</td>
                              <td className="px-5 py-3">
                                {e.drift_triggered
                                  ? <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-600 animate-pulse">Drift</span>
                                  : <span className="text-gray-300 text-xs">—</span>}
                              </td>
                              <td className="px-5 py-3"><StatusBadge score={e.quality_score} /></td>
                              <td className="px-5 py-3 text-right">
                                <button 
                                  onClick={() => setExpandedEval(isExp ? null : e.id)}
                                  className="text-xs px-3 py-1 font-semibold rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                                >
                                  {isExp ? 'Hide Logs' : 'View Logs'}
                                </button>
                              </td>
                            </tr>
                            {isExp && (
                              <tr>
                                <td colSpan={7} className="bg-slate-50 p-6 border-b border-gray-200">
                                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden flex flex-col gap-4 p-4">
                                    <h4 className="font-bold text-sm text-gray-700 mb-2 border-b pb-2">Sample Evaluation Details</h4>
                                    {samples.length === 0 ? (
                                      <p className="text-xs text-gray-500">No sample details available.</p>
                                    ) : (
                                      samples.map((s, idx) => (
                                        <div key={idx} className="bg-gray-50 p-4 rounded border border-gray-100 flex flex-col gap-2">
                                          <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Input</span>
                                              <p className="text-xs font-mono text-gray-700 mt-1 whitespace-pre-wrap">{s.input}</p>
                                            </div>
                                          </div>
                                          <div className="flex gap-4 mt-2">
                                            <div className="flex-1 bg-green-50 p-2 rounded border border-green-100">
                                              <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Desired Output</span>
                                              <p className="text-xs font-mono text-green-800 mt-1 break-words">{s.expected_output}</p>
                                            </div>
                                            <div className="flex-1 bg-blue-50 p-2 rounded border border-blue-100">
                                              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Actual Output</span>
                                              <p className="text-xs font-mono text-blue-800 mt-1 break-words">{s.actual_output || '—'}</p>
                                            </div>
                                          </div>
                                          <div className="mt-2 flex flex-wrap gap-2">
                                            {['accuracy', 'relevance_score', 'factuality_score', 'toxicity_score', 'instruction_following'].map(mkey => (
                                              s[mkey] != null && (
                                                <div key={mkey} className="flex flex-col bg-white border border-gray-200 px-2 py-1 rounded">
                                                  <span className="text-[9px] uppercase tracking-wider text-gray-400 font-bold">
                                                    {METRICS.find(x => x.key === mkey)?.label || mkey.replace('_', ' ')}
                                                  </span>
                                                  <span className={`text-xs font-bold ${s[mkey] >= 80 ? 'text-green-600' : s[mkey] >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                    {s[mkey]}%
                                                  </span>
                                                </div>
                                              )
                                            ))}
                                          </div>
                                        </div>
                                      ))
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
            )}

            {/* Drift Judge History Tab */}
            {activeTab === 'judge' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-bold text-gray-700">
                  Drift Judge History {selected ? `— ${selected.name}` : ''}
                  {judgeHistory.length > 0 && <span className="ml-2 text-xs font-normal text-gray-400">({judgeHistory.length} runs)</span>}
                </h2>
              </div>
              {judgeLoading ? (
                <p className="text-sm text-gray-400 animate-pulse px-5 py-6">Loading…</p>
              ) : judgeHistory.length === 0 ? (
                <p className="text-sm text-gray-400 px-5 py-6">No drift judge runs yet. Use the LLM Drift Judge panel on the Dashboard.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-xs tracking-wide">
                      <tr>
                        {['Timestamp', 'Judge', 'Drift', 'Shift Type', 'Severity', 'Keyword', 'Reason', 'Raw'].map(h => (
                          <th key={h} className="px-4 py-3 text-left font-semibold whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {judgeHistory.map(r => (
                        <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{new Date(r.timestamp).toLocaleString()}</td>
                          <td className="px-4 py-3 text-gray-700 font-medium whitespace-nowrap text-xs">{r.judge_model}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              r.drift_detected === 'Major' ? 'bg-red-100 text-red-700' :
                              r.drift_detected === 'Minor' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-green-100 text-green-700'
                            }`}>{r.drift_detected}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs">{r.shift_type}</td>
                          <td className="px-4 py-3 font-bold text-center tabular-nums">
                            <span className={`${
                              r.severity_score >= 7 ? 'text-red-600' :
                              r.severity_score >= 4 ? 'text-yellow-600' : 'text-green-600'
                            }`}>{r.severity_score}/10</span>
                          </td>
                          <td className="px-4 py-3 font-mono text-indigo-700 text-xs">{r.top_new_keyword || '—'}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate" title={r.short_reason}>{r.short_reason || '—'}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setExpandedRaw(expandedRaw === r.id ? null : r.id)}
                              className="text-xs text-indigo-600 hover:underline"
                            >
                              {expandedRaw === r.id ? 'Hide' : 'View'}
                            </button>
                            {expandedRaw === r.id && (
                              <pre className="mt-2 text-xs bg-gray-900 text-green-300 rounded p-2 whitespace-pre-wrap max-w-xs overflow-auto max-h-40">{r.raw_response}</pre>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
