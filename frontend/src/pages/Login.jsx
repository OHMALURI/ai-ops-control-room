import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api.js";

// Neural network node positions (% of container)
const NODES = [
  { cx: 12,  cy: 18,  r: 5,  delay: 0    },
  { cx: 35,  cy: 8,   r: 3,  delay: 0.6  },
  { cx: 58,  cy: 22,  r: 6,  delay: 1.2  },
  { cx: 80,  cy: 10,  r: 4,  delay: 0.3  },
  { cx: 92,  cy: 35,  r: 3,  delay: 1.8  },
  { cx: 20,  cy: 42,  r: 4,  delay: 0.9  },
  { cx: 48,  cy: 50,  r: 5,  delay: 0.4  },
  { cx: 72,  cy: 48,  r: 3,  delay: 1.5  },
  { cx: 88,  cy: 68,  r: 5,  delay: 0.7  },
  { cx: 8,   cy: 65,  r: 3,  delay: 1.1  },
  { cx: 30,  cy: 72,  r: 4,  delay: 0.2  },
  { cx: 55,  cy: 78,  r: 3,  delay: 1.6  },
  { cx: 75,  cy: 82,  r: 5,  delay: 0.5  },
  { cx: 18,  cy: 88,  r: 3,  delay: 1.3  },
  { cx: 44,  cy: 92,  r: 4,  delay: 0.8  },
];

const EDGES = [
  [0,1],[0,5],[1,2],[1,6],[2,3],[2,6],[3,4],[3,7],[4,7],[4,8],
  [5,6],[5,9],[5,10],[6,7],[6,10],[6,11],[7,8],[7,11],[7,12],
  [8,12],[9,10],[9,13],[10,11],[10,13],[10,14],[11,12],[11,14],[12,14],[13,14],
];

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { username, password });
      const effectiveRole = data.effective_role || data.role;
      const isTempAdmin   = data.role !== effectiveRole && effectiveRole === "admin";
      localStorage.setItem("token",        data.access_token);
      localStorage.setItem("role",         data.role);
      localStorage.setItem("effectiveRole",effectiveRole);
      localStorage.setItem("isTempAdmin",  isTempAdmin ? "true" : "false");
      localStorage.setItem("username",     data.username);
      navigate("/dashboard");
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex overflow-hidden">
      <style>{`
        @keyframes pulse-node {
          0%, 100% { opacity: 0.35; r: attr(r); }
          50%       { opacity: 0.9;  }
        }
        @keyframes dash-flow {
          from { stroke-dashoffset: 200; }
          to   { stroke-dashoffset: 0;   }
        }
        @keyframes float-up {
          0%,100% { transform: translateY(0px) translateX(0px);   opacity: 0.5; }
          33%     { transform: translateY(-18px) translateX(8px);  opacity: 0.9; }
          66%     { transform: translateY(-8px) translateX(-6px);  opacity: 0.7; }
        }
        @keyframes wave {
          0%   { d: path("M0,40 C30,10 60,70 90,40 C120,10 150,70 180,40 C210,10 240,70 270,40 C300,10 330,70 360,40"); }
          50%  { d: path("M0,40 C30,70 60,10 90,40 C120,70 150,10 180,40 C210,70 240,10 270,40 C300,70 330,10 360,40"); }
          100% { d: path("M0,40 C30,10 60,70 90,40 C120,10 150,70 180,40 C210,10 240,70 270,40 C300,10 330,70 360,40"); }
        }
        @keyframes scan-line {
          0%   { transform: translateY(-100%); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateY(500px); opacity: 0; }
        }
        @keyframes blink-cursor {
          0%,100% { opacity: 1; }
          50%     { opacity: 0; }
        }
        .node-pulse { animation: pulse-node 3s ease-in-out infinite; }
        .edge-flow  { animation: dash-flow 4s linear infinite; stroke-dasharray: 8 12; }
        .float-particle { animation: float-up 6s ease-in-out infinite; }
        .scan { animation: scan-line 8s linear infinite; }
      `}</style>

      {/* ── Left Panel: AI Animation ── */}
      <div className="hidden lg:flex flex-col flex-1 relative bg-gradient-to-br from-slate-50 via-indigo-50/60 to-blue-50 overflow-hidden">

        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-30"
          style={{ backgroundImage: "radial-gradient(circle, #6366f1 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

        {/* Neural network SVG */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
          {/* Edges */}
          {EDGES.map(([a, b], i) => (
            <line
              key={i}
              x1={NODES[a].cx} y1={NODES[a].cy}
              x2={NODES[b].cx} y2={NODES[b].cy}
              stroke="#6366f1"
              strokeWidth="0.15"
              strokeOpacity="0.25"
              className="edge-flow"
              style={{ animationDelay: `${(i * 0.3) % 4}s`, animationDuration: `${3 + (i % 3)}s` }}
            />
          ))}
          {/* Nodes */}
          {NODES.map((n, i) => (
            <g key={i}>
              {/* outer glow ring */}
              <circle
                cx={n.cx} cy={n.cy} r={n.r * 2.2}
                fill="#6366f1" fillOpacity="0.06"
                className="node-pulse"
                style={{ animationDelay: `${n.delay}s`, animationDuration: `${2.5 + n.delay * 0.4}s` }}
              />
              {/* main node */}
              <circle
                cx={n.cx} cy={n.cy} r={n.r * 0.6}
                fill="#6366f1"
                fillOpacity="0.5"
                className="node-pulse"
                style={{ animationDelay: `${n.delay}s`, animationDuration: `${2.5 + n.delay * 0.4}s` }}
              />
              {/* inner bright dot */}
              <circle cx={n.cx} cy={n.cy} r={n.r * 0.25} fill="#a5b4fc" fillOpacity="0.9" />
            </g>
          ))}
        </svg>

        {/* Scan line */}
        <div className="scan absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-400/40 to-transparent pointer-events-none"
          style={{ top: 0 }} />

        {/* Floating data chips */}
        {[
          { label: "Model Drift: None",       x: "10%",  y: "20%",  d: "0s"   },
          { label: "Eval Score: 94.2",        x: "60%",  y: "15%",  d: "1.5s" },
          { label: "Incident: 2 open",        x: "15%",  y: "55%",  d: "0.8s" },
          { label: "Services: Online",        x: "62%",  y: "60%",  d: "2.2s" },
          { label: "Latency: 142ms",          x: "35%",  y: "78%",  d: "1.1s" },
        ].map(({ label, x, y, d }) => (
          <div key={label} className="float-particle absolute pointer-events-none"
            style={{ left: x, top: y, animationDelay: d, animationDuration: `${5 + parseFloat(d) * 0.5}s` }}>
            <div className="bg-white/80 backdrop-blur-sm border border-indigo-100 shadow-sm rounded-lg px-3 py-1.5 flex items-center gap-2 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
              <span className="text-slate-600 text-xs font-semibold">{label}</span>
            </div>
          </div>
        ))}

        {/* Waveform at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-24 flex items-end overflow-hidden opacity-30">
          <svg viewBox="0 0 360 80" className="w-full" preserveAspectRatio="none">
            <path d="M0,40 C30,10 60,70 90,40 C120,10 150,70 180,40 C210,10 240,70 270,40 C300,10 330,70 360,40"
              stroke="#6366f1" strokeWidth="2" fill="none"
              style={{ animation: "wave 4s ease-in-out infinite" }} />
            <path d="M0,50 C40,20 80,80 120,50 C160,20 200,80 240,50 C280,20 320,80 360,50"
              stroke="#818cf8" strokeWidth="1.5" fill="none" opacity="0.5"
              style={{ animation: "wave 5s ease-in-out infinite reverse" }} />
          </svg>
        </div>

        {/* Brand text */}
        <div className="relative z-10 p-12 mt-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M3 12h3l2-7 4 14 3-10 2 3h4" />
              </svg>
            </div>
            <span className="text-2xl font-black text-slate-800"><span className="text-indigo-600">AI</span> Pulse</span>
          </div>
          <p className="text-slate-500 text-sm leading-relaxed max-w-xs">
            Monitor, evaluate, and govern your AI models in one place.
          </p>
          <div className="flex gap-3 mt-5 flex-wrap">
            {["Real-time Monitoring", "Drift Detection", "Incident Management"].map(t => (
              <span key={t} className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right Panel: Login Form ── */}
      <div className="w-full lg:w-[420px] xl:w-[460px] flex items-center justify-center bg-white px-8 py-12 relative shrink-0">

        {/* top accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-indigo-400 to-blue-400" />

        <div className="w-full max-w-sm">

          {/* Mobile brand */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M3 12h3l2-7 4 14 3-10 2 3h4" />
              </svg>
            </div>
            <span className="font-black text-slate-800"><span className="text-indigo-600">AI</span> Pulse</span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Welcome back</h1>
            <p className="text-slate-400 text-sm mt-1.5">Sign in to your account to continue</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoFocus
                placeholder="Enter your username"
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                <svg className="w-4 h-4 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl py-3 text-sm transition-all duration-150 shadow-lg shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-0.5 active:translate-y-0"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in…
                </span>
              ) : "Sign In"}
            </button>
          </form>

          <p className="text-slate-400 text-xs text-center mt-8">
            AI Pulse · Enterprise AI Governance Platform
          </p>
        </div>
      </div>
    </div>
  );
}
