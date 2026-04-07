import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';
import api from '../api.js';

const METRIC_CONFIG = {
  quality_score: { label: 'Quality Score', color: '#4f46e5', unit: '%' },
  latency_ms:    { label: 'Latency (ms)',   color: '#10b981', unit: 'ms' },
};

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
  const [activeMetric, setActiveMetric] = useState('quality_score');
  const [search, setSearch]           = useState('');
  const [activeTab, setActiveTab]     = useState('evals');   // 'evals' | 'judge'
  const [judgeHistory, setJudgeHistory] = useState([]);
  const [judgeLoading, setJudgeLoading] = useState(false);
  const [expandedRaw, setExpandedRaw] = useState(null);

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
    setLoading(true);
    api.get(`/evaluations/${selected.id}`)
      .then(r => setLogs(r.data || []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));

    // Also fetch drift judge history
    setJudgeLoading(true);
    api.get(`/drift-judge/${selected.id}`)
      .then(r => setJudgeHistory(r.data || []))
      .catch(() => setJudgeHistory([]))
      .finally(() => setJudgeLoading(false));
  }, [selected]);

  // Chart data — reverse to chronological order
  const chartData = [...logs].reverse().map(e => ({
    time:    new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    fullDate: new Date(e.timestamp).toLocaleString(),
    quality_score: parseFloat((e.quality_score || 0).toFixed(1)),
    latency_ms:    e.latency_ms || 0,
  }));

  // Filtered table rows
  const filteredLogs = logs.filter(e => {
    const ts = new Date(e.timestamp).toLocaleString().toLowerCase();
    return ts.includes(search.toLowerCase()) || String(e.quality_score).includes(search);
  });

  const avg = arr => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : '—';
  const avgScore   = avg(logs.map(e => e.quality_score));
  const avgLatency = avg(logs.filter(e => e.latency_ms).map(e => e.latency_ms));
  const errorPct   = logs.length
    ? ((logs.filter(e => e.quality_score < 50).length / logs.length) * 100).toFixed(1)
    : '0.0';

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

            {/* Summary stats */}
            {selected && (
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Avg Quality Score', value: avgScore === '—' ? '—' : `${avgScore}%`, color: 'text-indigo-600' },
                  { label: 'Avg Latency',        value: avgLatency === '—' ? '—' : `${avgLatency}ms`, color: 'text-emerald-600' },
                  { label: 'Error Rate',          value: `${errorPct}%`, color: 'text-red-500' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">{label}</p>
                    <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Chart */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-700">
                  {selected ? `${selected.name} — Trends` : 'Select a service'}
                </h2>
                <div className="flex gap-2">
                  {Object.entries(METRIC_CONFIG).map(([key, { label, color }]) => (
                    <button
                      key={key}
                      onClick={() => setActiveMetric(key)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors border ${
                        activeMetric === key
                          ? 'text-white border-transparent'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                      }`}
                      style={activeMetric === key ? { backgroundColor: color, borderColor: color } : {}}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {loading ? (
                <div className="h-52 flex items-center justify-center text-gray-400 animate-pulse text-sm">
                  Loading chart…
                </div>
              ) : chartData.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-gray-400 text-sm border-2 border-dashed rounded-lg">
                  No evaluation data yet. Run an evaluation first.
                </div>
              ) : (
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 16, bottom: 30, left: -10 }}>
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
                        domain={activeMetric === 'quality_score' ? [0, 100] : ['auto', 'auto']}
                      />
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.07)' }}
                        labelStyle={{ fontWeight: 700, color: '#1e293b', marginBottom: 4 }}
                        labelFormatter={(label, payload) => payload?.[0]?.payload?.fullDate || label}
                        formatter={(val) => [`${val}${METRIC_CONFIG[activeMetric].unit}`, METRIC_CONFIG[activeMetric].label]}
                      />
                      <Line
                        type="monotone"
                        dataKey={activeMetric}
                        stroke={METRIC_CONFIG[activeMetric].color}
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: METRIC_CONFIG[activeMetric].color, strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 6 }}
                        animationDuration={800}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
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
                        {['#', 'Timestamp', 'Quality Score', 'Latency', 'Drift', 'Status'].map(h => (
                          <th key={h} className="px-5 py-3 text-left font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredLogs.map((e, i) => (
                        <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3 text-gray-400 tabular-nums">{i + 1}</td>
                          <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{new Date(e.timestamp).toLocaleString()}</td>
                          <td className="px-5 py-3 font-semibold text-indigo-700 tabular-nums">{e.quality_score != null ? `${e.quality_score.toFixed(1)}%` : '—'}</td>
                          <td className="px-5 py-3 text-emerald-700 tabular-nums">{e.latency_ms ? `${e.latency_ms}ms` : '—'}</td>
                          <td className="px-5 py-3">
                            {e.drift_triggered
                              ? <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-600 animate-pulse">Drift</span>
                              : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                          <td className="px-5 py-3"><StatusBadge score={e.quality_score} /></td>
                        </tr>
                      ))}
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
