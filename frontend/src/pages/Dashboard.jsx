import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';

const FEATURES = [
  {
    title: 'Service Registry',
    desc: 'Register and manage AI/ML models with metadata like owner, environment, data sensitivity, and monitoring tools.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
      </svg>
    ),
    color: 'from-blue-500 to-blue-600',
    link: '/registry',
  },
  {
    title: 'Benchmark Evaluations',
    desc: 'Run evaluations across 7 benchmark datasets including Graphwalks, AlpacaEval, CRUXEval, and JudgeBench.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
      </svg>
    ),
    color: 'from-indigo-500 to-indigo-600',
    link: '/perf-logs',
  },
  {
    title: 'Drift Detection',
    desc: 'Detect model drift using LLM-as-a-Judge with Gemini, GPT-5, or Claude Sonnet as evaluators.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    ),
    color: 'from-amber-500 to-orange-500',
    link: '/perf-logs',
  },
  {
    title: 'Operations Center',
    desc: 'Unified incident and maintenance management — create, resolve, and track operational events in one place.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.1-5.1m0 0L11.42 4.97m-5.1 5.1H20" />
      </svg>
    ),
    color: 'from-rose-500 to-pink-600',
    link: '/operations',
  },
  {
    title: 'Audit Log',
    desc: 'Full audit trail of every action — service changes, evaluations, incident updates, and user activity.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    color: 'from-emerald-500 to-teal-600',
    link: '/audit',
  },
  {
    title: 'Data Policy & Users',
    desc: 'Manage data governance policies and user access controls with role-based permissions.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    color: 'from-violet-500 to-purple-600',
    link: '/policy',
  },
];

const TECH_STACK = [
  { name: 'React', desc: 'Frontend UI', color: '#61DAFB' },
  { name: 'FastAPI', desc: 'Backend API', color: '#009688' },
  { name: 'SQLite', desc: 'Database', color: '#003B57' },
  { name: 'Recharts', desc: 'Visualizations', color: '#8884d8' },
  { name: 'DeepEval', desc: 'LLM Evaluation', color: '#4f46e5' },
  { name: 'Ollama', desc: 'Local LLM Judge', color: '#1a1a2e' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ services: 0, evaluations: 0, users: 0 });
  const username = localStorage.getItem('username') || 'Operator';

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [svc, users] = await Promise.all([
          api.get('/services').catch(() => ({ data: [] })),
          api.get('/users/').catch(() => ({ data: [] })),
        ]);
        setStats({
          services: svc.data?.length || 0,
          users: users.data?.length || 0,
        });
      } catch { /* ignore */ }
    };
    fetchStats();
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Hero Section ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900">
        {/* Decorative blobs */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-purple-500/15 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-8 py-16">
          <p className="text-indigo-300 text-sm font-semibold tracking-widest uppercase mb-3 animate-pulse">
            {greeting}, {username}
          </p>
          <h1 className="text-5xl font-extrabold text-white tracking-tight leading-tight mb-4">
            AI Ops <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Control Room</span>
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl leading-relaxed mb-8">
            A centralized platform for monitoring, evaluating, and governing AI/ML models in production.
            Detect drift, run benchmarks, manage incidents, and enforce data policies — all in one place.
          </p>

          {/* Quick Stats */}
          <div className="flex gap-6 flex-wrap">
            {[
              { label: 'Registered Services', value: stats.services, icon: '🔧' },
              { label: 'Team Members', value: stats.users, icon: '👥' },
            ].map(s => (
              <div key={s.label} className="bg-white/10 backdrop-blur-md border border-white/10 rounded-xl px-6 py-4 min-w-[180px]">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">{s.icon} {s.label}</p>
                <p className="text-3xl font-extrabold text-white tabular-nums">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-12">

        {/* ── Features Grid ── */}
        <div className="mb-16">
          <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Platform Capabilities</h2>
          <p className="text-slate-500 mb-8">Everything you need to operate AI models safely and reliably.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(f => (
              <button
                key={f.title}
                onClick={() => navigate(f.link)}
                className="group text-left bg-white rounded-xl border border-gray-200 shadow-sm p-6 hover:shadow-lg hover:border-indigo-200 transition-all duration-300 hover:-translate-y-0.5"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center text-white mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  {f.icon}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-indigo-700 transition-colors">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* ── Tech Stack ── */}
        <div className="mb-16">
          <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Tech Stack</h2>
          <p className="text-slate-500 mb-6">Built with modern, production-grade technologies.</p>

          <div className="flex flex-wrap gap-4">
            {TECH_STACK.map(t => (
              <div
                key={t.name}
                className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex items-center gap-3 hover:shadow-md transition-shadow"
              >
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                <div>
                  <p className="text-sm font-bold text-slate-800">{t.name}</p>
                  <p className="text-xs text-slate-400">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="border-t border-gray-200 pt-8 pb-4 text-center">
          <p className="text-sm text-slate-400">
            AI Ops Control Room &middot; Built for enterprise AI governance
          </p>
        </div>
      </div>
    </div>
  );
}
