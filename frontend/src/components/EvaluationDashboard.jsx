import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '../api.js';

const BASE_URL = 'http://localhost:8000/api';

const DATASET_TYPES = [
  { key: 'single_turn', label: 'Single-Turn', tag: 'RAG & output quality',  tagColor: 'bg-blue-100 text-blue-700' },
  { key: 'multi_turn',  label: 'Multi-Turn',  tag: 'conversational',        tagColor: 'bg-purple-100 text-purple-700' },
];

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
  // pending
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

const SECTION_LABELS = { single_turn: 'Single-Turn Metrics', multi_turn: 'Multi-Turn Metrics' };
const SECTION_COLORS = { single_turn: 'text-blue-600 bg-blue-50 border-blue-200', multi_turn: 'text-purple-600 bg-purple-50 border-purple-200' };


// ── Main ServiceCard ──────────────────────────────────────────────────────────
const ServiceCard = ({ service }) => {
  const effectiveRole = localStorage.getItem("effectiveRole") || localStorage.getItem("role") || "user";
  const canRunEval    = effectiveRole === "admin" || effectiveRole === "maintainer";
  const [latestEval, setLatestEval]         = useState(null);
  const [allEvals, setAllEvals]             = useState([]);
  const [isLoading, setIsLoading]           = useState(false);
  const [isFetchingInitial, setIsFetchingInitial] = useState(true);
  const [selectedDataset, setSelectedDataset]     = useState('single_turn');
  const [progressSteps, setProgressSteps]   = useState([]);   // [{step,label,status,section,duration_ms,score}]
  const [evalFinished, setEvalFinished]     = useState(false); // true once stream ends

  const eventSourceRef = useRef(null);
  const progressEndRef = useRef(null);

  const fetchEvaluations = async (dsType) => {
    const dtype = dsType || selectedDataset;
    try {
      try {
        const latestRes = await api.get(`/evaluations/latest/${service.id}?dataset_type=${dtype}`);
        setLatestEval(latestRes.data);
      } catch (err) {
        if (err.response?.status === 404) setLatestEval(null);
      }
      try {
        const allRes = await api.get(`/evaluations/${service.id}?dataset_type=${dtype}`);
        setAllEvals(allRes.data || []);
      } catch (err) {
        if (err.response?.status === 404) setAllEvals([]);
      }
    } finally {
      setIsFetchingInitial(false);
    }
  };

  useEffect(() => {
    fetchEvaluations(selectedDataset);
  }, [service.id, selectedDataset]);

  const handleDatasetChange = (key) => {
    setSelectedDataset(key);
    setLatestEval(null);
    setAllEvals([]);
  };

  const handleRunEvaluation = () => {
    // Close any existing stream
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setIsLoading(true);
    setEvalFinished(false);
    setProgressSteps([]);

    const es = new EventSource(`${BASE_URL}/evaluations/run-stream/${service.id}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.status === 'section') {
        // Section header marker — add as a special "section" item
        setProgressSteps(prev => [...prev, data]);
        return;
      }

      setProgressSteps(prev => {
        const idx = prev.findIndex(s => s.step === data.step);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = data;
          return updated;
        }
        return [...prev, data];
      });

      if (['complete', 'error', 'stopped'].includes(data.status)) {
        es.close();
        eventSourceRef.current = null;
        setIsLoading(false);
        setEvalFinished(true);
        // Refresh both tabs
        fetchEvaluations('single_turn');
        fetchEvaluations(selectedDataset);
      }
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      setIsLoading(false);
      setEvalFinished(true);
      setProgressSteps(prev => [
        ...prev,
        { step: 'conn_error', label: 'Connection lost', status: 'error', section: '' },
      ]);
    };
  };

  const handleStop = async () => {
    try {
      await api.post(`/evaluations/stop/${service.id}`);
    } catch (e) {
      console.error('Stop request failed', e);
    }
    // EventSource will receive the stopped event and close itself
  };

  // Auto-scroll progress list
  useEffect(() => {
    if (progressEndRef.current) {
      progressEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [progressSteps]);

  const latency      = latestEval?.latency_ms ? `${latestEval.latency_ms}ms` : 'No data';
  const driftDetected = latestEval?.drift_triggered === true;

  const sampleDetails = (() => {
    try {
      if (!latestEval?.check_results) return [];
      return JSON.parse(latestEval.check_results).per_sample_scores || [];
    } catch { return []; }
  })();

  const envText  = service.environment || 'DEV';
  const isProd   = envText.toLowerCase().includes('prod');
  const badgeColor = isProd
    ? 'bg-red-100 text-red-800 border-red-200'
    : 'bg-blue-100 text-blue-800 border-blue-200';

  const METRICS = [
    { key: 'accuracy',              label: 'Accuracy',             color: '#4f46e5', desc: 'GEval accuracy / conversation completeness' },
    { key: 'relevance_score',       label: 'Relevance',            color: '#0891b2', desc: 'Answer relevancy / turn relevancy' },
    { key: 'factuality_score',      label: 'Factuality',           color: '#16a34a', desc: 'Faithfulness / coherence' },
    { key: 'toxicity_score',        label: 'Safety',               color: '#d97706', desc: 'Safety score (inverted toxicity / role adherence)' },
    { key: 'instruction_following', label: 'Instruction Following',color: '#9333ea', desc: 'GEval instruction following / knowledge retention' },
  ];

  const [activeMetric, setActiveMetric] = useState('all');

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

  // ── Count completed steps for summary ──────────────────────────────────────
  const doneCount  = progressSteps.filter(s => s.status === 'done').length;
  const totalSteps = progressSteps.filter(s => s.status !== 'section').length;

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
              {driftDetected && (
                <div className="flex flex-col items-start gap-1">
                  <span className="bg-red-500 text-white px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-sm animate-pulse whitespace-nowrap">
                    {latestEval?.drift_type ? `⚠️ ${latestEval.drift_type.toUpperCase()}` : 'DRIFT DETECTED'}
                  </span>
                  {latestEval?.drift_reason && (
                    <span className="text-[10px] text-red-600 font-medium italic max-w-[200px] leading-tight">
                      {latestEval.drift_reason}
                    </span>
                  )}
                </div>
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
            {!isLoading && (
              <span className="text-[10px] text-gray-400">
                Runs: <strong className="text-gray-600">Single-Turn + Multi-Turn</strong>
              </span>
            )}
        </div>
      </div>
    </div>

      {/* ── Dataset Type Tabs ── */}
      <div className="px-6 pt-4 pb-0 border-b border-gray-100">
        <div className="flex gap-2 flex-wrap">
          {DATASET_TYPES.map(dt => {
            const isActive = selectedDataset === dt.key;
            return (
              <button
                key={dt.key}
                onClick={() => handleDatasetChange(dt.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-xs font-semibold transition-all border-b-2 ${
                  isActive
                    ? 'border-indigo-500 text-indigo-700 bg-indigo-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {dt.label}
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${dt.tagColor}`}>
                  {dt.tag}
                </span>
              </button>
            );
          })}
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
            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-1 leading-tight">Latency</p>
            <p className="text-md font-medium text-gray-700 mt-0.5">{latency}</p>
          </button>
        </div>
      </div>

      {/* ── Chart + Right Panel ── */}
      <div className="px-6 pb-6 flex gap-6" style={{ minHeight: '320px' }}>

        {/* Left: Chart */}
        <div style={{ flex: '0 0 55%', minWidth: 0 }} className="flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700">
              {activeMetric === 'all' ? 'All Metrics Over Time'
                : activeMetric === 'latency_ms' ? 'Latency Over Time'
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
                        ? [`${value != null ? value : '—'}ms`, name]
                        : [`${value != null ? value.toFixed(1) : '—'}%`, name]
                    }
                  />
                  {activeMetric === 'all' && (
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} iconType="line" iconSize={12} />
                  )}
                  {activeMetric === 'latency_ms' ? (
                    <Line type="monotone" dataKey="latency_ms" name="Latency (ms)" stroke="#f59e0b"
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

        {/* Right: Progress or Sample Details */}
        <div style={{ flex: '0 0 45%', minWidth: 0 }} className="border-l border-gray-100 pl-6 flex flex-col overflow-hidden">

          {showProgress ? (
            /* ── Progress Panel ── */
            <>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <h4 className="text-sm font-semibold text-gray-700">Evaluation Progress</h4>
                </div>
                {evalFinished && (
                  <button
                    onClick={() => setProgressSteps([])}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto pr-1 space-y-0.5" style={{ maxHeight: 290 }}>
                {progressSteps.map((step, idx) => {
                  // Section header
                  if (step.status === 'section') {
                    const sc = SECTION_COLORS[step.section] || 'text-gray-600 bg-gray-50 border-gray-200';
                    return (
                      <div key={`sec-${idx}`} className={`flex items-center gap-2 px-2 py-1 rounded border text-[10px] font-bold uppercase tracking-wider mt-2 mb-1 ${sc}`}>
                        {SECTION_LABELS[step.section] || step.label}
                      </div>
                    );
                  }

                  const isRunning = step.status === 'running';
                  return (
                    <div
                      key={step.step}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded transition-colors ${
                        isRunning ? 'bg-indigo-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <StepIcon status={step.status} />
                      <span className={`text-xs flex-1 leading-tight ${
                        isRunning ? 'text-indigo-700 font-medium'
                        : step.status === 'done' ? 'text-gray-700'
                        : step.status === 'error' ? 'text-red-500'
                        : step.status === 'stopped' ? 'text-orange-500 font-medium'
                        : 'text-gray-500'
                      }`}>
                        {step.label}
                      </span>
                      {step.score != null && <ScorePill score={step.score} />}
                      {step.duration_ms != null && (
                        <span className="text-[10px] text-gray-400 font-mono shrink-0 ml-1">
                          {fmtDuration(step.duration_ms)}
                        </span>
                      )}
                    </div>
                  );
                })}

                {/* Loading indicator when stream just started */}
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
                  progressSteps.some(s => s.status === 'stopped')
                    ? 'bg-orange-50 text-orange-600'
                    : progressSteps.some(s => s.status === 'error' && s.step !== 'conn_error')
                    ? 'bg-red-50 text-red-600'
                    : 'bg-green-50 text-green-600'
                }`}>
                  {progressSteps.some(s => s.status === 'stopped')
                    ? '⏹ Evaluation stopped'
                    : progressSteps.some(s => s.status === 'error' && s.step === 'complete')
                    ? '✓ Complete'
                    : progressSteps.some(s => s.status === 'error')
                    ? '⚠ Completed with errors'
                    : '✓ All evaluations complete'}
                </div>
              )}
            </>
          ) : (
            /* ── Sample Details Panel ── */
            <>
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <h4 className="text-sm font-semibold text-gray-700">
                  Sample Details
                  <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    DATASET_TYPES.find(d => d.key === selectedDataset)?.tagColor || 'bg-gray-100 text-gray-600'
                  }`}>
                    {DATASET_TYPES.find(d => d.key === selectedDataset)?.label}
                  </span>
                </h4>
              </div>

              {sampleDetails.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center border-2 border-dashed border-gray-200 rounded-lg bg-gray-50 py-8 px-4">
                  <svg className="w-8 h-8 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-sm font-medium text-gray-400">No sample data yet</p>
                  <p className="text-xs text-gray-400 mt-1">Run evaluation to see input / output details</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-3 pr-1" style={{ maxHeight: 290 }}>
                  {sampleDetails.map((s, i) => (
                    <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 overflow-hidden">
                      <div className="px-3 py-1.5 bg-indigo-50 border-b border-indigo-100 flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Sample {i + 1}</span>
                        {s.accuracy != null && (
                          <span className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            s.accuracy >= 80 ? 'bg-green-100 text-green-700'
                            : s.accuracy >= 55 ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                          }`}>
                            Accuracy: {s.accuracy.toFixed(0)}%
                          </span>
                        )}
                      </div>
                      <div className="px-3 py-2 space-y-1.5">
                        <div>
                          <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Input</span>
                          <p className="text-xs text-gray-700 mt-0.5 leading-relaxed">{s.input || '—'}</p>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-500">Expected Output</span>
                          <p className="text-xs text-emerald-700 mt-0.5 font-medium">{s.expected_output || '—'}</p>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold uppercase tracking-widest text-indigo-400">Actual Output</span>
                          <p className="text-xs text-indigo-700 mt-0.5">{s.actual_output || '(not yet evaluated)'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
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
