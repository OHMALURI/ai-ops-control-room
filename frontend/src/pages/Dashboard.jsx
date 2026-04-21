import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '../api.js';

const TOOLS = ['Deepchecks', 'Alibi Detect', 'Frouros', 'Popmon', 'NannyML', 'Great Expectations'];
const JUDGES = [
  { key: 'gemini', label: 'Gemini AI Studio' },
  { key: 'gpt5', label: 'GPT-5 (OpenAI)' },
  { key: 'claude', label: 'Claude Sonnet' },
];

const DATASET_TYPES = [
  { key: 'graphwalks', label: 'Graphwalks',  tag: 'language & reasoning', tagColor: 'bg-blue-100 text-blue-700' },
  { key: 'alpacaeval', label: 'AlpacaEval',  tag: 'instruction-following', tagColor: 'bg-pink-100 text-pink-700' },
  { key: 'cruxeval',   label: 'CRUXEval',    tag: 'coding',              tagColor: 'bg-orange-100 text-orange-700' },
  { key: 'agentharm',  label: 'AgentHarm',   tag: 'safety',              tagColor: 'bg-red-100 text-red-700' },
  { key: 'videomme',   label: 'Video-MME',   tag: 'multimodal / video',  tagColor: 'bg-purple-100 text-purple-700' },
  { key: 'colbench',   label: 'ColBench',    tag: 'agents & tools',      tagColor: 'bg-teal-100 text-teal-700' },
  { key: 'judgebench', label: 'JudgeBench',  tag: 'llm judge evaluation',tagColor: 'bg-emerald-100 text-emerald-700' },
];


const JUDGEBENCH_METRICS = [
  { key: 'accuracy',              label: 'Accuracy',              color: '#059669' },
  { key: 'relevance_score',       label: 'Relevance',             color: '#0d9488' },
  { key: 'factuality_score',      label: 'Factuality',            color: '#0891b2' },
  { key: 'toxicity_score',        label: 'Safety',                color: '#d97706' },
  { key: 'instruction_following', label: 'Instruction Following', color: '#7c3aed' },
];

const JudgeBenchPanel = ({ serviceId }) => {
  const [jbLatest, setJbLatest] = useState(null);
  const [jbLoading, setJbLoading] = useState(false);
  const [jbFetching, setJbFetching] = useState(true);

  const fetchJudgeBench = React.useCallback(async () => {
    try {
      const res = await api.get(`/evaluations/latest/${serviceId}?dataset_type=judgebench`);
      setJbLatest(res.data);
    } catch {
      setJbLatest(null);
    } finally {
      setJbFetching(false);
    }
  }, [serviceId]);

  useEffect(() => {
    fetchJudgeBench(); 
  }, [fetchJudgeBench]);

  const handleRunJudgeBench = async () => {
    setJbLoading(true);
    try {
      await api.post(`/evaluations/run/${serviceId}?dataset_type=judgebench`);
      await fetchJudgeBench();
    } catch (err) {
      console.error('JudgeBench run failed', err);
      alert('Failed to run JudgeBench evaluation.');
    } finally {
      setJbLoading(false);
    }
  };

  const jbSamples = (() => {
    try {
      if (!jbLatest?.check_results) return [];
      return JSON.parse(jbLatest.check_results).per_sample_scores || [];
    } catch { return []; }
  })();

  const qualityScore = jbLatest?.quality_score;
  const latency = jbLatest?.latency_ms;

  return (
    <div className="border-t-2 border-emerald-200 bg-gradient-to-b from-emerald-50/60 to-white">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 flex justify-between items-start">
        <div>
          <h4 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Local Ollama Judge Evaluator
            <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">JudgeBench</span>
            <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full text-[10px] font-medium">qwen3.5</span>
          </h4>
          <p className="text-xs text-slate-500 mt-1">Evaluates the local LLM judge's ability to compare response pairs and pick the better answer.</p>
        </div>
        <button
          onClick={handleRunJudgeBench}
          disabled={jbLoading || jbFetching}
          className="flex-shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center min-w-[170px]"
        >
          {jbLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Running Judge...
            </>
          ) : (
            'Run JudgeBench'
          )}
        </button>
      </div>

      {/* Metrics Row */}
      <div className="px-6 pb-3">
        <div className="grid grid-cols-7 gap-2">
          {JUDGEBENCH_METRICS.map(m => {
            const val = jbLatest?.[m.key];
            const color = val == null ? 'text-gray-400'
              : val >= 80 ? 'text-emerald-600'
              : val >= 55 ? 'text-yellow-600'
              : 'text-red-600';
            return (
              <div key={m.key} className="p-2.5 rounded-lg bg-white border border-emerald-100 shadow-sm">
                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-0.5">{m.label}</p>
                <p className={`text-lg font-bold ${color}`}>{val != null ? `${val.toFixed(1)}%` : '—'}</p>
              </div>
            );
          })}
          <div className="p-2.5 rounded-lg bg-white border border-emerald-100 shadow-sm">
            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-0.5">Quality</p>
            <p className={`text-lg font-bold ${qualityScore == null ? 'text-gray-400' : qualityScore >= 80 ? 'text-emerald-600' : qualityScore >= 55 ? 'text-yellow-600' : 'text-red-600'}`}>
              {qualityScore != null ? `${qualityScore.toFixed(1)}%` : '—'}
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-white border border-emerald-100 shadow-sm">
            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-0.5">Latency</p>
            <p className="text-lg font-medium text-slate-700">{latency != null ? `${latency}ms` : '—'}</p>
          </div>
        </div>
      </div>

      {/* Per-Sample Results */}
      <div className="px-6 pb-5">
        {jbSamples.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center border-2 border-dashed border-emerald-200 rounded-lg bg-white py-8 px-4">
            <svg className="w-8 h-8 text-emerald-200 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <p className="text-sm font-medium text-slate-400">No JudgeBench results yet</p>
            <p className="text-xs text-slate-400 mt-1">Click "Run JudgeBench" to evaluate the local Ollama judge</p>
          </div>
        ) : (
          <div className="space-y-3">
            <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Per-Sample Judge Results</h5>
            {jbSamples.map((s, i) => {
              const isCorrect = s.actual_output && s.expected_output &&
                s.actual_output.trim().toLowerCase().replace(/[^a-z0-9>=<]/g, '') ===
                s.expected_output.trim().toLowerCase().replace(/[^a-z0-9>=<]/g, '');
              return (
                <div key={i} className="rounded-lg border border-emerald-100 bg-white overflow-hidden shadow-sm">
                  {/* Sample header */}
                  <div className={`px-4 py-2 flex items-center justify-between ${isCorrect ? 'bg-emerald-50 border-b border-emerald-100' : 'bg-red-50 border-b border-red-100'}`}>
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Sample {i + 1}</span>
                    <div className="flex items-center gap-2">
                      {s.accuracy != null && (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          s.accuracy >= 80 ? 'bg-emerald-100 text-emerald-700'
                          : s.accuracy >= 55 ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                        }`}>
                          Accuracy: {s.accuracy.toFixed(0)}%
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isCorrect ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                        {isCorrect ? '✓ CORRECT' : '✗ INCORRECT'}
                      </span>
                    </div>
                  </div>
                  <div className="px-4 py-3 space-y-2.5">
                    {/* Input */}
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Input (Response Pair)</span>
                      <p className="text-xs text-slate-700 mt-0.5 leading-relaxed whitespace-pre-line font-mono bg-slate-50 rounded p-2 border border-slate-100">{s.input || '—'}</p>
                    </div>
                    {/* Expected vs Actual side-by-side */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-emerald-50 rounded-lg p-2.5 border border-emerald-100">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-500">Expected Output</span>
                        <p className="text-sm text-emerald-800 mt-1 font-bold">{s.expected_output || '—'}</p>
                      </div>
                      <div className={`rounded-lg p-2.5 border ${isCorrect ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                        <span className={`text-[9px] font-bold uppercase tracking-widest ${isCorrect ? 'text-emerald-500' : 'text-red-400'}`}>Actual Output (Judge)</span>
                        <p className={`text-sm mt-1 font-bold ${isCorrect ? 'text-emerald-800' : 'text-red-700'}`}>{s.actual_output || '(not yet evaluated)'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};



const ServiceCard = ({ service }) => {
  const [latestEval, setLatestEval] = useState(null);
  const [allEvals, setAllEvals] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingInitial, setIsFetchingInitial] = useState(true);
  const [selectedDataset, setSelectedDataset] = useState('alpacaeval');

  // ── Progress Modal State ──
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressSteps, setProgressSteps] = useState([]);  // { key, label, status: 'pending'|'running'|'done'|'error', score, error }
  const [allStepsDone, setAllStepsDone] = useState(false);

  const BENCHMARK_STEPS = DATASET_TYPES.filter(dt => dt.key !== 'judgebench');

  const fetchEvaluations = React.useCallback(async (dtype) => {
    setIsFetchingInitial(true);
    try {
      const latestRes = await api.get(`/evaluations/latest/${service.id}?dataset_type=${dtype}`);
      setLatestEval(latestRes.data);
    } catch (err) {
      if (err.response && err.response.status === 404) {
        setLatestEval(null);
      } else {
        console.error("Failed to fetch latest evaluation", err);
      }
    }

    try {
      const allRes = await api.get(`/evaluations/${service.id}?dataset_type=${dtype}`);
      setAllEvals(allRes.data || []);
    } catch (err) {
      if (err.response && err.response.status === 404) {
        setAllEvals([]);
      } else {
        console.error("Failed to fetch all evaluations", err);
      }
    } finally {
      setIsFetchingInitial(false);
    }
  }, [service.id]);

  useEffect(() => {
    fetchEvaluations(selectedDataset);
  }, [selectedDataset, fetchEvaluations]);

  const handleDatasetChange = (key) => {
    setSelectedDataset(key);
    setLatestEval(null);
    setAllEvals([]);
  };

  const handleRunEvaluation = async () => {
    setIsLoading(true);
    setAllStepsDone(false);

    // Initialize all steps as pending
    const initialSteps = BENCHMARK_STEPS.map(dt => ({
      key: dt.key,
      label: dt.label,
      tag: dt.tag,
      tagColor: dt.tagColor,
      status: 'pending',
      score: null,
      latency: null,
      error: null,
    }));
    setProgressSteps(initialSteps);
    setShowProgressModal(true);

    // Run each benchmark sequentially
    for (let i = 0; i < BENCHMARK_STEPS.length; i++) {
      const dt = BENCHMARK_STEPS[i];

      // Mark current step as running
      setProgressSteps(prev => prev.map((s, idx) =>
        idx === i ? { ...s, status: 'running' } : s
      ));

      try {
        const res = await api.post(`/evaluations/run/${service.id}?dataset_type=${dt.key}`);
        const evalData = res.data;

        // Mark step as done with score
        setProgressSteps(prev => prev.map((s, idx) =>
          idx === i ? {
            ...s,
            status: 'done',
            score: evalData.quality_score,
            latency: evalData.latency_ms,
            accuracy: evalData.accuracy,
            drift: evalData.drift_triggered,
          } : s
        ));
      } catch (err) {
        // Mark step as error
        setProgressSteps(prev => prev.map((s, idx) =>
          idx === i ? { ...s, status: 'error', error: err.message || 'Failed' } : s
        ));
      }
    }

    // All done — refresh current view
    await fetchEvaluations(selectedDataset);
    setIsLoading(false);
    setAllStepsDone(true);

    // Auto-close modal after 3 seconds
    setTimeout(() => {
      setShowProgressModal(false);
      setAllStepsDone(false);
    }, 3000);
  };

  const latency = latestEval && latestEval.latency_ms ? `${latestEval.latency_ms}ms` : 'No data';
  const driftDetected = latestEval && latestEval.drift_triggered === true;

  // Parse per-sample details from the latest eval's check_results JSON
  const sampleDetails = (() => {
    try {
      if (!latestEval?.check_results) return [];
      const parsed = JSON.parse(latestEval.check_results);
      return parsed.per_sample_scores || [];
    } catch {
      return [];
    }
  })();

  const envText = service.environment || 'DEV';
  const isProd = envText.toLowerCase().includes('prod');
  const badgeColor = isProd ? 'bg-red-100 text-red-800 border-red-200' : 'bg-blue-100 text-blue-800 border-blue-200';

  // ── 5 DeepEval metrics config ──
  const METRICS = [
    { key: 'accuracy',              label: 'Accuracy',             color: '#4f46e5', desc: '% correct responses' },
    { key: 'relevance_score',       label: 'Relevance',            color: '#0891b2', desc: 'Semantic similarity' },
    { key: 'factuality_score',      label: 'Factuality',           color: '#16a34a', desc: 'Hallucination resistance' },
    { key: 'toxicity_score',        label: 'Safety',               color: '#d97706', desc: 'Toxicity / safety score' },
    { key: 'instruction_following', label: 'Instruction Following',color: '#9333ea', desc: 'Constraint adherence' },
  ];

  const [activeMetric, setActiveMetric] = useState('all'); // 'all' | one of METRICS.key

  const chartData = [...allEvals].reverse().map(e => {
    const dateObj = new Date(e.timestamp);
    const row = {
      timestamp: e.timestamp, // Unique key for Recharts
      time: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      fullDate: dateObj.toLocaleString(),
      latency_ms: e.latency_ms ?? null,
    };
    METRICS.forEach(m => { row[m.key] = e[m.key] ?? null; });
    return row;
  });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col transition-shadow hover:shadow-md relative">

      {/* ── Evaluation Progress Modal ── */}
      {showProgressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" style={{ animation: 'fadeIn 0.2s ease-out' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-gray-200" style={{ animation: 'slideUp 0.3s ease-out' }}>
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {!allStepsDone && (
                    <svg className="animate-spin h-5 w-5 text-white/80" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {allStepsDone && (
                    <svg className="h-5 w-5 text-emerald-300" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  <div>
                    <h3 className="text-base font-bold">
                      {allStepsDone ? 'All Benchmarks Complete!' : 'Running Benchmarks...'}
                    </h3>
                    <p className="text-xs text-indigo-100 mt-0.5">{service.name}</p>
                  </div>
                </div>
                {/* Progress counter */}
                <span className="text-sm font-mono bg-white/20 px-2.5 py-1 rounded-lg">
                  {progressSteps.filter(s => s.status === 'done' || s.status === 'error').length}/{progressSteps.length}
                </span>
              </div>
              {/* Progress bar */}
              <div className="mt-3 h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-300 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${(progressSteps.filter(s => s.status === 'done' || s.status === 'error').length / progressSteps.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Checklist */}
            <div className="px-6 py-4 max-h-[400px] overflow-y-auto space-y-2">
              {progressSteps.map((step) => (
                <div
                  key={step.key}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-300 ${
                    step.status === 'done' ? 'bg-emerald-50 border-emerald-200'
                    : step.status === 'running' ? 'bg-indigo-50 border-indigo-200 shadow-sm'
                    : step.status === 'error' ? 'bg-red-50 border-red-200'
                    : 'bg-gray-50 border-gray-100'
                  }`}
                >
                  {/* Status Icon */}
                  <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                    {step.status === 'pending' && (
                      <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                    )}
                    {step.status === 'running' && (
                      <svg className="animate-spin h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {step.status === 'done' && (
                      <svg className="h-5 w-5 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {step.status === 'error' && (
                      <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>

                  {/* Label + Tag */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${
                        step.status === 'done' ? 'text-emerald-700'
                        : step.status === 'running' ? 'text-indigo-700'
                        : step.status === 'error' ? 'text-red-700'
                        : 'text-gray-500'
                      }`}>
                        {step.label}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${step.tagColor}`}>{step.tag}</span>
                    </div>
                    {step.status === 'running' && (
                      <p className="text-[10px] text-indigo-400 mt-0.5 animate-pulse">Evaluating samples...</p>
                    )}
                    {step.status === 'error' && (
                      <p className="text-[10px] text-red-400 mt-0.5">{step.error}</p>
                    )}
                  </div>

                  {/* Score */}
                  {step.status === 'done' && step.score != null && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-sm font-bold ${
                        step.score >= 80 ? 'text-emerald-600'
                        : step.score >= 55 ? 'text-yellow-600'
                        : 'text-red-600'
                      }`}>
                        {step.score.toFixed(1)}%
                      </span>
                      {step.latency != null && (
                        <span className="text-[10px] text-gray-400 font-mono">{step.latency}ms</span>
                      )}
                      {step.drift && (
                        <span className="bg-red-500 text-white px-1.5 py-0.5 rounded text-[8px] font-bold">DRIFT</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <span className="text-[10px] text-gray-400">
                {allStepsDone ? 'Auto-closing in 3 seconds...' : 'Please wait while benchmarks are running...'}
              </span>
              <button
                onClick={() => { setShowProgressModal(false); setAllStepsDone(false); }}
                className="text-xs text-gray-500 hover:text-gray-700 font-medium px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {allStepsDone ? 'Close Now' : 'Run in Background'}
              </button>
            </div>
          </div>
        </div>
      )}

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
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${service.data_sensitivity === 'confidential' ? 'bg-red-100 text-red-700' : service.data_sensitivity === 'internal' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
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
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                {service.owner || '—'}
              </span>
              <span className="flex items-center gap-1.5 break-normal font-mono select-all">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                {service.model_name || '—'}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={handleRunEvaluation}
              disabled={isLoading || isFetchingInitial}
              className="flex-shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center min-w-[150px]"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Running...
                </>
              ) : (
                'Run Evaluation'
              )}
            </button>
            <span className="text-[10px] text-gray-400">
              Dataset: <strong className="text-gray-600">{DATASET_TYPES.find(d => d.key === selectedDataset)?.label}</strong>
            </span>
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

          {/* Latency card */}
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

      {/* ── Chart + Drift Judge side-by-side ── */}
      <div className="px-6 pb-6 flex gap-6" style={{ minHeight: '320px' }}>

        {/* Left: Chart */}
        <div style={{ flex: '0 0 55%', minWidth: 0 }} className="flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700">
              {activeMetric === 'all'
                ? 'All Metrics Over Time'
                : activeMetric === 'latency_ms'
                ? 'Latency Over Time'
                : `${METRICS.find(m => m.key === activeMetric)?.label} Over Time`}
            </h4>
            {activeMetric !== 'all' && (
              <button
                onClick={() => setActiveMetric('all')}
                className="text-xs text-indigo-600 hover:underline"
              >Show all</button>
            )}
          </div>
          {allEvals.length > 0 ? (
            <div className="flex-1">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 30, left: -20 }}>
                  <XAxis
                    dataKey="timestamp"
                    stroke="#6b7280" fontSize={11} fontWeight={500}
                    tickLine={false} axisLine={{ stroke: '#e5e7eb' }}
                    dy={8} tick={{ fill: '#374151' }}
                    tickFormatter={(val) => {
                      const d = new Date(val);
                      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    }}
                  />
                  <YAxis
                    domain={activeMetric === 'latency_ms' ? ['auto', 'auto'] : [0, 100]}
                    stroke="#9ca3af"
                    fontSize={12} tickLine={false} axisLine={false}
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
                    <Legend
                      wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                      iconType="line"
                      iconSize={12}
                    />
                  )}
                  {activeMetric === 'latency_ms' ? (
                    <Line
                      type="monotone"
                      dataKey="latency_ms"
                      name="Latency (ms)"
                      stroke="#f59e0b"
                      strokeWidth={4}
                      dot={{ r: 4, fill: '#f59e0b', strokeWidth: 2, stroke: '#ffffff' }}
                      activeDot={{ r: 5, fill: '#f59e0b', stroke: '#ffffff', strokeWidth: 2 }}
                      animationDuration={1000}
                      connectNulls
                    />
                  ) : (
                    // Render highlighted metric LAST so it appears on top
                    [
                      ...METRICS.filter(m => activeMetric !== 'all' && m.key !== activeMetric),
                      ...METRICS.filter(m => activeMetric === 'all' || m.key === activeMetric)
                    ].map(m => {
                      const isHighlighted = activeMetric === m.key;
                      const isOthersDimmed = activeMetric !== 'all' && !isHighlighted;
                      return (
                        <Line
                          key={m.key}
                          type="monotone"
                          dataKey={m.key}
                          name={m.label}
                          stroke={m.color}
                          strokeWidth={isHighlighted ? 4 : 2}
                          strokeOpacity={isOthersDimmed ? 0.3 : 1}
                          dot={{ r: isHighlighted ? 4 : 2, fill: m.color, strokeWidth: 2, stroke: '#ffffff' }}
                          activeDot={{ r: 6, fill: m.color, stroke: '#ffffff', strokeWidth: 2 }}
                          animationDuration={500}
                          connectNulls
                        />
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

        {/* Right: Description Panel */}
        <div style={{ flex: '0 0 45%', minWidth: 0 }} className="border-l border-gray-100 pl-6 flex flex-col overflow-hidden">
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
                  {/* Sample header */}
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
                    {/* Input */}
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Input</span>
                      <p className="text-xs text-gray-700 mt-0.5 leading-relaxed">{s.input || '—'}</p>
                    </div>
                    {/* Expected */}
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-500">Expected Output</span>
                      <p className="text-xs text-emerald-700 mt-0.5 font-medium">{s.expected_output || '—'}</p>
                    </div>
                    {/* Actual */}
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-indigo-400">Actual Output</span>
                      <p className="text-xs text-indigo-700 mt-0.5">{s.actual_output || '(not yet evaluated)'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>



      {/* ── JudgeBench Full Section at Bottom ── */}
      <JudgeBenchPanel serviceId={service.id} />

    </div>
  );
};


export default function Dashboard() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedModel, setSelectedModel] = useState('all');

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const response = await api.get('/services');
        setServices(response.data);
      } catch (err) {
        console.error("Failed to load services", err);
        setError("Failed to load operations data. Please ensure the backend is running.");
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, []);

  const filteredServices = selectedModel === 'all'
    ? services
    : services.filter(s => String(s.id) === String(selectedModel) || s.name === selectedModel);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 flex justify-center items-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-indigo-600 mb-4"></div>
          <p className="text-indigo-900 font-medium">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 flex justify-center items-start pt-20">
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-6 rounded-r-lg shadow-sm max-w-2xl w-full">
          <h3 className="font-bold text-lg mb-2">Connection Error</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto">

        {/* ── Dashboard Header ── */}
        <div className="mb-10 px-2 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">AI Operations Dashboard</h1>
            <p className="text-slate-500 mt-2 text-lg">Monitor model performance, detect drift, and manage service health.</p>
          </div>

          {/* Model Dropdown */}
          {services.length > 0 && (
            <div className="flex items-center gap-3">
              <label htmlFor="model-select" className="text-sm font-semibold text-slate-600 whitespace-nowrap">
                Filter Model:
              </label>
              <div className="relative">
                <select
                  id="model-select"
                  value={selectedModel}
                  onChange={e => setSelectedModel(e.target.value)}
                  className="appearance-none bg-white border border-slate-200 rounded-lg pl-4 pr-10 py-2.5 text-sm font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer hover:border-indigo-300 transition-colors min-w-[200px]"
                >
                  <option value="all">All Models</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {/* Custom chevron */}
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          )}
        </div>

        {services.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-16 text-center">
            <svg className="mx-auto h-16 w-16 text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
            </svg>
            <h3 className="text-xl font-medium text-slate-900 mb-2">No Services Configured</h3>
            <p className="text-slate-500 max-w-md mx-auto">
              You haven't added any services to the registry yet. Head over to the Service Registry to add your first AI model.
            </p>
          </div>
        ) : (
          /* Single-column layout */
          <div className="flex flex-col gap-8">
            {filteredServices.map(service => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
