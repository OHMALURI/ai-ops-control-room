import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '../api.js';
import { useEvaluation } from '../contexts/EvaluationContext.jsx';

// ── Progress step helpers ─────────────────────────────────────────────────────
function fmtDuration(ms) {
  if (ms == null) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function StepIcon({ status }) {
  if (status === 'running') {
    return (
      <svg className="w-4 h-4 text-indigo-500 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    );
  }
  if (status === 'done') {
    return (
      <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (status === 'error') {
    return (
      <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }
  if (status === 'stopped') {
    return (
      <svg className="w-4 h-4 text-orange-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <rect x="6" y="6" width="12" height="12" rx="1" strokeLinecap="round" />
      </svg>
    );
  }
  return <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />;
}

function ScorePill({ score }) {
  if (score == null) return null;
  const color = score >= 80 ? 'bg-green-100 text-green-700'
    : score >= 55 ? 'bg-yellow-100 text-yellow-700'
    : 'bg-red-100 text-red-700';
  return (
    <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold ${color}`}>
      {score.toFixed(1)}%
    </span>
  );
}


// ── Main ServiceCard ──────────────────────────────────────────────────────────
const ServiceCard = ({ service }) => {
  const effectiveRole = localStorage.getItem("effectiveRole") || localStorage.getItem("role") || "user";
  const canRunEval    = effectiveRole === "admin" || effectiveRole === "maintainer";
  const [latestEval, setLatestEval]               = useState(null);
  const [allEvals, setAllEvals]                   = useState([]);
  const [isFetchingInitial, setIsFetchingInitial] = useState(true);

  const progressEndRef = useRef(null);
  const { startEval, stopEval, clearProgress, getState } = useEvaluation();
  const { steps: progressSteps, isLoading, finished: evalFinished } = getState(service.id);

  const fetchEvaluations = async () => {
    try {
      try {
        const latestRes = await api.get(`/evaluations/latest/${service.id}`);
        setLatestEval(latestRes.data);
      } catch (err) {
        if (err.response?.status === 404) setLatestEval(null);
      }
      try {
        const allRes = await api.get(`/evaluations/${service.id}`);
        setAllEvals(allRes.data || []);
      } catch (err) {
        if (err.response?.status === 404) setAllEvals([]);
      }
    } finally {
      setIsFetchingInitial(false);
    }
  };

  useEffect(() => {
    fetchEvaluations();
  }, [service.id]);

  const handleRunEvaluation = () => {
    startEval(service.id, fetchEvaluations);
  };

  const handleStop = () => stopEval(service.id);

  // Auto-scroll progress list
  useEffect(() => {
    if (progressEndRef.current) {
      progressEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [progressSteps]);

  const latency      = latestEval?.latency_ms ? `${(latestEval.latency_ms / 1000).toFixed(1)}s` : 'No data';
  const driftDetected = latestEval?.drift_triggered === true;

  const serviceStatus = (() => {
    if (!latestEval) return null;
    const q = latestEval.quality_score;
    if (driftDetected || q < 50) return 'drift';
    if (q < 70) return 'warn';
    return 'good';
  })();

  const { sampleDetails, categoryScores } = (() => {
    try {
      if (!latestEval?.check_results) return { sampleDetails: [], categoryScores: {} };
      const parsed = JSON.parse(latestEval.check_results);
      return {
        sampleDetails:  parsed.per_sample_scores || [],
        categoryScores: parsed.category_scores   || {},
      };
    } catch { return { sampleDetails: [], categoryScores: {} }; }
  })();

  const envText  = service.environment || 'DEV';
  const isProd   = envText.toLowerCase().includes('prod');
  const badgeColor = isProd
    ? 'bg-red-100 text-red-800 border-red-200'
    : 'bg-blue-100 text-blue-800 border-blue-200';

  const METRICS = [
    { key: 'quality_score',   label: 'Avg Quality Score', color: '#7c3aed', desc: 'Average quality score across all categories' },
    { key: 'accuracy',        label: 'Math',         color: '#4f46e5', desc: 'Deterministic exact-match score on math questions' },
    { key: 'relevance_score', label: 'Reasoning',    color: '#0891b2', desc: 'Step-wise logic check (Gemini rubric) on reasoning questions' },
    { key: 'factuality_score', label: 'Knowledge',   color: '#16a34a', desc: 'Factuality score (Gemini rubric) on knowledge questions' },
    { key: 'toxicity_score',  label: 'Security',     color: '#d97706', desc: 'Security knowledge score (Gemini rubric) on cybersecurity questions' },
  ];

  const [activeMetric, setActiveMetric] = useState('all');

  const METRIC_TO_CATEGORY = {
    accuracy:         'math',
    relevance_score:  'reasoning',
    factuality_score: 'knowledge',
    toxicity_score:   'security',
    // quality_score and latency_ms have no category → show all
  };
  const activeCat = METRIC_TO_CATEGORY[activeMetric] ?? null;
  const visibleSamples = activeCat
    ? sampleDetails.filter(s => s.category === activeCat)
    : sampleDetails;

  const chartData = [...allEvals].reverse().map(e => {
    const dateObj = new Date(e.timestamp);
    const row = {
      timestamp: e.timestamp,
      time: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      fullDate: dateObj.toLocaleString(),
      latency_ms: e.latency_ms ?? null,
    };
    METRICS.forEach(m => { row[m.key] = e[m.key] ?? null; });
    return row;
  });

  const showProgress = isLoading || progressSteps.length > 0;

  const doneCount  = progressSteps.filter(s => s.status === 'done').length;
  const totalSteps = progressSteps.filter(s => !['qa_pair'].includes(s.status)).length;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col transition-shadow hover:shadow-md">

      {/* ── Header ── */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex justify-between items-start mb-2">
          <div className="flex flex-col">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-xl font-bold text-gray-900 truncate" title={service.name}>
                {service.name}
              </h3>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeColor}`}>
                {envText.toUpperCase()}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                service.data_sensitivity === 'confidential' ? 'bg-red-100 text-red-700'
                : service.data_sensitivity === 'internal' ? 'bg-yellow-100 text-yellow-700'
                : 'bg-green-100 text-green-700'
              }`}>
                {service.data_sensitivity?.toUpperCase() || '—'}
              </span>
              {serviceStatus && (
                serviceStatus === 'drift' ? (
                  <span className="flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-black bg-red-600 text-white shadow-lg shadow-red-500/60 animate-pulse border border-red-400">
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-200 opacity-80" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
                    </span>
                    DRIFT
                  </span>
                ) : serviceStatus === 'warn' ? (
                  <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-yellow-50 text-yellow-700 border border-yellow-300">
                    <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 animate-pulse shrink-0" />
                    ⚠ Warn
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500 shrink-0" />
                    Good
                  </span>
                )
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
              <span className="flex items-center gap-1.5 break-normal select-all">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {service.owner || '—'}
              </span>
              <span className="flex items-center gap-1.5 break-normal font-mono select-all">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
                {service.model_name || '—'}
              </span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col items-end gap-2">
            {canRunEval ? (
              <div className="flex gap-2">
                {isLoading && (
                  <button
                    onClick={handleStop}
                    className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="6" width="12" height="12" rx="1" />
                    </svg>
                    Stop
                  </button>
                )}
                <button
                  onClick={handleRunEvaluation}
                  disabled={isLoading || isFetchingInitial}
                  className="flex-shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center min-w-[150px]"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Evaluating…
                    </>
                  ) : 'Run Evaluation'}
                </button>
              </div>
            ) : (
              <span className="text-xs text-gray-500 italic">View only — run evals requires maintainer+</span>
            )}
            {isLoading && totalSteps > 0 && (
              <span className="text-[10px] text-gray-400">
                {doneCount} / {totalSteps} steps
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Metrics Row ── */}
      <div className="px-6 pt-6 pb-2">
        <div className="flex flex-wrap gap-3 mb-6">
          {METRICS.map(m => {
            const val = latestEval?.[m.key];
            const isActive = activeMetric === m.key;
            const color = val == null ? 'text-gray-400'
              : val >= 80 ? 'text-green-600'
              : val >= 55 ? 'text-yellow-600'
              : 'text-red-600';
            return (
              <button
                key={m.key}
                onClick={() => setActiveMetric(isActive ? 'all' : m.key)}
                onMouseEnter={() => setActiveMetric(m.key)}
                onMouseLeave={() => setActiveMetric('all')}
                title={m.desc}
                className={`flex-1 min-w-[140px] p-3 rounded-lg flex flex-col justify-center border text-left transition-all cursor-pointer ${
                  isActive
                    ? 'border-indigo-400 bg-indigo-50 shadow-md ring-2 ring-indigo-300'
                    : 'bg-gray-50 border-gray-100 shadow-sm hover:border-indigo-200 hover:bg-indigo-50/40'
                }`}
              >
                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-1 leading-tight">{m.label}</p>
                <p className={`text-lg font-bold ${color}`}>
                  {val != null ? `${val.toFixed(1)}%` : 'No data'}
                </p>
              </button>
            );
          })}
          <button
            onClick={() => setActiveMetric(activeMetric === 'latency_ms' ? 'all' : 'latency_ms')}
            onMouseEnter={() => setActiveMetric('latency_ms')}
            onMouseLeave={() => setActiveMetric('all')}
            className={`flex-1 min-w-[120px] p-3 rounded-lg flex flex-col justify-center border text-left transition-all cursor-pointer ${
              activeMetric === 'latency_ms'
                ? 'border-indigo-400 bg-indigo-50 shadow-md ring-2 ring-indigo-300'
                : 'bg-gray-50 border-gray-100 shadow-sm hover:border-indigo-200 hover:bg-indigo-50/40'
            }`}
          >
            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-1 leading-tight">Runtime</p>
            <p className="text-md font-medium text-gray-700 mt-0.5">{latency}</p>
          </button>
        </div>
      </div>

      {/* ── Chart + Sample Details (always side by side) ── */}
      <div className="px-6 pb-6 flex gap-6" style={{ minHeight: '320px' }}>

        {/* Left: Chart */}
        <div style={{ flex: '0 0 52%', minWidth: 0 }} className="flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700">
              {activeMetric === 'all' ? 'All Metrics Over Time'
                : activeMetric === 'latency_ms' ? 'Runtime Over Time'
                : `${METRICS.find(m => m.key === activeMetric)?.label} Over Time`}
            </h4>
            {activeMetric !== 'all' && (
              <button onClick={() => setActiveMetric('all')} className="text-xs text-indigo-600 hover:underline">
                Show all
              </button>
            )}
          </div>
          {allEvals.length > 0 ? (
            <div className="flex-1">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 30, left: -20 }}>
                  <XAxis
                    dataKey="timestamp" stroke="#6b7280" fontSize={11} fontWeight={500}
                    tickLine={false} axisLine={{ stroke: '#e5e7eb' }} dy={8} tick={{ fill: '#374151' }}
                    tickFormatter={(val) => new Date(val).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  />
                  <YAxis
                    domain={activeMetric === 'latency_ms' ? ['auto', 'auto'] : [0, 100]}
                    stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                    labelStyle={{ fontWeight: 'bold', color: '#374151', marginBottom: '4px' }}
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.fullDate || label}
                    formatter={(value, name) =>
                      activeMetric === 'latency_ms'
                        ? [`${value != null ? (value / 1000).toFixed(1) : '—'}s`, name]
                        : [`${value != null ? value.toFixed(1) : '—'}%`, name]
                    }
                  />
                  {activeMetric === 'all' && (
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} iconType="line" iconSize={12} />
                  )}
                  {activeMetric === 'latency_ms' ? (
                    <Line type="monotone" dataKey="latency_ms" name="Runtime" stroke="#f59e0b"
                      strokeWidth={4} dot={{ r: 4, fill: '#f59e0b', strokeWidth: 2, stroke: '#ffffff' }}
                      activeDot={{ r: 5 }} animationDuration={1000} connectNulls />
                  ) : (
                    [
                      ...METRICS.filter(m => activeMetric !== 'all' && m.key !== activeMetric),
                      ...METRICS.filter(m => activeMetric === 'all' || m.key === activeMetric),
                    ].map(m => {
                      const isHighlighted  = activeMetric === m.key;
                      const isOthersDimmed = activeMetric !== 'all' && !isHighlighted;
                      return (
                        <Line key={m.key} type="monotone" dataKey={m.key} name={m.label}
                          stroke={m.color} strokeWidth={isHighlighted ? 4 : 2}
                          strokeOpacity={isOthersDimmed ? 0.3 : 1}
                          dot={{ r: isHighlighted ? 4 : 2, fill: m.color, strokeWidth: 2, stroke: '#ffffff' }}
                          activeDot={{ r: 6, fill: m.color, stroke: '#ffffff', strokeWidth: 2 }}
                          animationDuration={500} connectNulls />
                      );
                    })
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-lg text-gray-400 bg-gray-50">
              <svg className="w-8 h-8 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              <span className="text-sm font-medium">No evaluation data available</span>
            </div>
          )}
        </div>

        {/* Right: Sample Details — always visible */}
        <div style={{ flex: '0 0 48%', minWidth: 0 }} className="border-l border-gray-100 pl-6 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h4 className="text-sm font-semibold text-gray-700">Sample Details</h4>
            {activeCat && (
              <span className="ml-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 uppercase tracking-wide">
                {activeCat}
              </span>
            )}
          </div>

          {visibleSamples.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center border-2 border-dashed border-gray-200 rounded-lg bg-gray-50 py-8 px-4">
              <svg className="w-8 h-8 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm font-medium text-gray-400">No sample data yet</p>
              <p className="text-xs text-gray-400 mt-1">Run evaluation to see Q / Expected / Actual</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-2 pr-1" style={{ maxHeight: 260 }}>
              {visibleSamples.map((s, i) => {
                const scorePct = s.score_pct ?? (s.si != null ? s.si * 100 : null);
                const methodColor = s.method?.startsWith('exact') ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700';
                return (
                  <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 overflow-hidden">
                    <div className="px-3 py-1.5 bg-indigo-50 border-b border-indigo-100 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">
                        {s.category ?? 'Q'} #{i + 1}
                      </span>
                      {s.method && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${methodColor}`}>{s.method}</span>
                      )}
                      {scorePct != null && (
                        <span className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          scorePct >= 80 ? 'bg-green-100 text-green-700'
                          : scorePct >= 55 ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                        }`}>{scorePct.toFixed(0)}%</span>
                      )}
                    </div>
                    <div className="px-3 py-2 space-y-1.5">
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Question</span>
                        <p className="text-xs text-gray-700 mt-0.5 leading-relaxed">{s.input || '—'}</p>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-500">Expected</span>
                        <p className="text-xs text-emerald-700 mt-0.5 font-medium">{s.expected_output || '—'}</p>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-indigo-400">Actual</span>
                        <p className="text-xs text-indigo-700 mt-0.5">{s.actual_output || '(none)'}</p>
                      </div>
                      {s.explanation && (
                        <div className="bg-white rounded border border-gray-200 px-2 py-1">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Gemini Note</span>
                          <p className="text-[11px] text-gray-500 italic mt-0.5">{s.explanation}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Progress Panel (collapsible, below chart) ── */}
      {showProgress && (
        <div className="px-6 pb-6 border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h4 className="text-sm font-semibold text-gray-700">Evaluation Progress</h4>
              {isLoading && totalSteps > 0 && (
                <span className="text-[10px] text-gray-400">{doneCount}/{totalSteps} steps</span>
              )}
            </div>
            {evalFinished && (
              <button onClick={() => clearProgress(service.id)} className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
            )}
          </div>

          <div className="overflow-y-auto space-y-0.5" style={{ maxHeight: 200 }}>
            {progressSteps.map((step, idx) => {
              if (step.status === 'qa_pair') {
                return (
                  <div key={`qa-${idx}`} className="mx-1 my-1 rounded-lg border border-indigo-100 bg-indigo-50 overflow-hidden">
                    <div className="px-2 py-1 bg-indigo-100 flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider flex-1">{step.label}</span>
                      {step.model && <span className="text-[9px] bg-white text-indigo-500 border border-indigo-200 rounded px-1 font-mono">{step.model}</span>}
                    </div>
                    <div className="px-2 py-1.5 space-y-1">
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Q</span>
                        <p className="text-[11px] text-gray-700 mt-0.5 leading-snug">{step.question}</p>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-indigo-400">A</span>
                        <p className="text-[11px] text-indigo-700 mt-0.5 leading-snug">{step.answer}</p>
                      </div>
                    </div>
                  </div>
                );
              }
              const isRunning = step.status === 'running';
              const isJudgeStep = /judge/i.test(step.step);
              return (
                <div key={step.step} className={`flex items-center gap-2 px-2 py-1.5 rounded transition-colors ${isRunning ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
                  <StepIcon status={step.status} />
                  <span className={`text-xs flex-1 leading-tight ${
                    isRunning ? 'text-indigo-700 font-medium'
                    : step.status === 'done' ? 'text-gray-700'
                    : step.status === 'error' ? 'text-red-500'
                    : step.status === 'stopped' ? 'text-orange-500 font-medium'
                    : 'text-gray-500'
                  }`}>{step.label}</span>
                  {isJudgeStep && (step.status === 'running' || step.status === 'done') && (
                    <span className="text-[9px] bg-green-50 text-green-600 border border-green-200 rounded px-1 shrink-0">gemini</span>
                  )}
                  {step.score != null && <ScorePill score={step.score} />}
                  {step.duration_ms != null && <span className="text-[10px] text-gray-400 font-mono shrink-0 ml-1">{fmtDuration(step.duration_ms)}</span>}
                </div>
              );
            })}
            {isLoading && progressSteps.length === 0 && (
              <div className="flex items-center gap-2 px-2 py-2 text-xs text-gray-400 animate-pulse">
                <svg className="w-4 h-4 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Connecting to evaluation engine…
              </div>
            )}
            <div ref={progressEndRef} />
          </div>

          {evalFinished && (
            <div className={`mt-2 px-2 py-1.5 rounded text-[11px] font-semibold text-center ${
              progressSteps.some(s => s.status === 'stopped') ? 'bg-orange-50 text-orange-600'
              : progressSteps.some(s => s.step === 'conn_error') ? 'bg-red-50 text-red-500'
              : progressSteps.some(s => s.status === 'error') ? 'bg-red-50 text-red-600'
              : 'bg-green-50 text-green-600'
            }`}>
              {progressSteps.some(s => s.status === 'stopped') ? 'Evaluation stopped'
               : progressSteps.some(s => s.step === 'conn_error') ? 'Connection lost'
               : progressSteps.some(s => s.status === 'error') ? 'Completed with errors'
               : 'Evaluation complete'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};


export default function EvaluationDashboard({ service }) {
  if (!service) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-16 text-center">
        <svg className="mx-auto h-16 w-16 text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
        </svg>
        <h3 className="text-xl font-medium text-slate-900 mb-2">Select a Service</h3>
        <p className="text-slate-500 max-w-md mx-auto">
          Choose a service from the sidebar to view its evaluation dashboard.
        </p>
      </div>
    );
  }

  return <ServiceCard service={service} />;
}
