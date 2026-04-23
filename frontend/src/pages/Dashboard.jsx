import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api.js";

function timeAgo(d) {
  if (!d) return "—";
  const m = Math.floor((Date.now() - new Date(d)) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const SEV = {
  critical: { pill:"bg-red-100 text-red-700",    dot:"bg-red-500",    bar:"bg-red-400",    label:"text-red-600"    },
  high:     { pill:"bg-orange-100 text-orange-700", dot:"bg-orange-500", bar:"bg-orange-400", label:"text-orange-600" },
  medium:   { pill:"bg-amber-100 text-amber-700",  dot:"bg-amber-400",  bar:"bg-amber-400",  label:"text-amber-600"  },
  low:      { pill:"bg-green-100 text-green-700",  dot:"bg-green-500",  bar:"bg-green-400",  label:"text-green-600"  },
};

const ENV = {
  prod:        "bg-indigo-100 text-indigo-700 border-indigo-200",
  production:  "bg-indigo-100 text-indigo-700 border-indigo-200",
  staging:     "bg-amber-100 text-amber-700 border-amber-200",
  dev:         "bg-slate-100 text-slate-600 border-slate-200",
  development: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function Dashboard() {
  const navigate      = useNavigate();
  const username      = localStorage.getItem("username") || "Operator";
  const effectiveRole = localStorage.getItem("effectiveRole") || "user";
  const isAdmin       = effectiveRole === "admin";

  const [services,    setServices]    = useState([]);
  const [incidents,   setIncidents]   = useState([]);
  const [users,       setUsers]       = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [sevFilter,   setSevFilter]   = useState("all");

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  useEffect(() => {
    (async () => {
      try {
        const calls = [
          api.get("/services/").catch(() => ({ data: [] })),
          api.get("/incidents").catch(() => ({ data: [] })),
          api.get("/maintenance").catch(() => ({ data: [] })),
        ];
        if (isAdmin) calls.push(api.get("/auth/users").catch(() => ({ data: [] })));
        const [s, i, m, u] = await Promise.all(calls);
        setServices(s.data || []);
        setIncidents(i.data || []);
        setMaintenance(m.data || []);
        if (u) setUsers(u.data || []);
      } finally { setLoading(false); }
    })();
  }, []);

  const openInc      = incidents.filter(i => i.status === "open" || i.status === "pending");
  const critical     = openInc.filter(i => i.severity === "critical").length;
  const pendingMaint = maintenance.filter(m => !m.approved).length;
  const svcMap       = Object.fromEntries(services.map(s => [s.id, s]));
  const sevCounts    = ["critical","high","medium","low"].reduce((a,s) => ({ ...a, [s]: openInc.filter(i=>i.severity===s).length }), {});
  const maxSev       = Math.max(...Object.values(sevCounts), 1);

  const envGroups = services.reduce((a, s) => {
    const k = s.environment?.toLowerCase() || "dev";
    a[k] = (a[k] || 0) + 1;
    return a;
  }, {});

  const filtered = sevFilter === "all" ? openInc : openInc.filter(i => i.severity === sevFilter);

  const svcWithInc = services.map(s => ({
    ...s,
    openCount: openInc.filter(i => i.service_id === s.id).length,
  }));

  return (
    <div className="min-h-screen bg-white">

      {/* ══════════════════════════ HERO ══════════════════════════ */}
      <div className="relative bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-800/30 via-transparent to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />

        <div className="relative max-w-7xl mx-auto px-10 pt-14 pb-20">
          <p className="text-indigo-400 text-sm font-bold tracking-[0.2em] uppercase mb-3">
            {greeting}, {username}
          </p>
          <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight leading-none mb-4">
            AI Pulse
            <span className="block text-2xl md:text-3xl font-semibold text-indigo-300 mt-2 tracking-normal">
              Operations Control Center
            </span>
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mt-4 leading-relaxed">
            Monitor, evaluate, and govern your AI models in one place. Real-time visibility into your entire fleet.
          </p>
        </div>
      </div>

      {/* ══════════════════════ STAT STRIP ════════════════════════ */}
      <div className="border-b border-slate-100 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-10">
          <div className={`grid divide-x divide-slate-100 ${isAdmin ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-3"}`}>
            {[
              {
                n: services.length,
                label: "Registered Services",
                sub: Object.entries(envGroups).map(([e,c])=>`${c} ${e}`).join("  ·  ") || "—",
                color: "text-indigo-600",
                to: "/registry",
              },
              {
                n: openInc.length,
                label: "Open Incidents",
                sub: critical > 0 ? `${critical} critical` : "None critical",
                color: openInc.length > 0 ? "text-orange-500" : "text-green-500",
                alert: critical > 0,
                to: "/operations",
              },
              {
                n: pendingMaint,
                label: "Pending Approvals",
                sub: "Maintenance plans",
                color: pendingMaint > 0 ? "text-amber-500" : "text-slate-400",
                to: "/operations",
              },
              ...(isAdmin ? [{
                n: users.length,
                label: "Team Members",
                sub: `${users.filter(u=>u.role==="admin").length} admin · ${users.filter(u=>u.role==="maintainer").length} maintainer`,
                color: "text-slate-700",
                to: "/users",
              }] : []),
            ].map(({ n, label, sub, color, alert, to }) => (
              <button key={label} onClick={() => navigate(to)}
                className="group py-8 px-8 text-left hover:bg-slate-50 transition-colors">
                <div className="flex items-start gap-2">
                  <span className={`text-5xl font-black tabular-nums ${color} leading-none`}>
                    {loading ? <span className="inline-block w-12 h-10 bg-slate-100 rounded-lg animate-pulse" /> : n}
                  </span>
                  {alert && !loading && (
                    <span className="mt-1 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                  )}
                </div>
                <p className="text-slate-800 font-bold text-base mt-3 group-hover:text-indigo-700 transition-colors">{label}</p>
                <p className="text-slate-400 text-sm mt-0.5">{loading ? "" : sub}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-10">

        {/* ══════════════════ INCIDENTS SECTION ═════════════════════ */}
        <section className="py-16 border-b border-slate-100">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-indigo-600 text-xs font-bold uppercase tracking-[0.15em] mb-2">Live Status</p>
              <h2 className="text-4xl font-black text-slate-900 leading-tight">What's Happening</h2>
              <p className="text-slate-400 text-base mt-2">Real-time view of open incidents across your AI fleet</p>
            </div>
            <button onClick={() => navigate("/operations")}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-colors shadow-sm shadow-indigo-200">
              All Operations
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Incidents list */}
            <div className="lg:col-span-2">
              {/* Filter tabs */}
              <div className="flex gap-2 flex-wrap mb-5">
                {["all","critical","high","medium","low"].map(s => {
                  const active = sevFilter === s;
                  const sc = SEV[s];
                  return (
                    <button key={s} onClick={() => setSevFilter(s)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold capitalize transition-all border ${
                        active
                          ? s === "all"
                            ? "bg-slate-900 text-white border-slate-900"
                            : `${sc.pill} border-current`
                          : "text-slate-400 border-slate-200 hover:border-slate-300 hover:text-slate-600"
                      }`}>
                      {s === "all" ? `All  (${openInc.length})` : `${s}  (${sevCounts[s]||0})`}
                    </button>
                  );
                })}
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                {loading ? (
                  <div className="divide-y divide-slate-100">
                    {Array.from({length:5}).map((_,i) => (
                      <div key={i} className="px-6 py-5 flex gap-4 animate-pulse">
                        <div className="w-3 h-3 rounded-full bg-slate-200 mt-1.5 shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-slate-100 rounded w-1/4" />
                          <div className="h-3 bg-slate-50 rounded w-3/4" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="py-20 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-slate-500 font-semibold">No {sevFilter !== "all" ? sevFilter : "open"} incidents</p>
                    <p className="text-slate-400 text-sm mt-1">Everything looks good</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                    {filtered.slice(0,10).map(inc => {
                      const svc = svcMap[inc.service_id];
                      const sc  = SEV[inc.severity] || SEV.low;
                      return (
                        <button key={inc.id} onClick={() => navigate("/operations")}
                          className="w-full px-6 py-5 flex items-center gap-5 hover:bg-slate-50 transition-colors text-left group">
                          <span className={`w-3 h-3 rounded-full ${sc.dot} shrink-0`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-1">
                              <span className={`text-xs font-black uppercase px-2.5 py-0.5 rounded-full ${sc.pill}`}>{inc.severity}</span>
                              {svc && <span className="text-slate-400 text-sm font-medium">{svc.name}</span>}
                            </div>
                            <p className="text-slate-700 text-sm font-medium truncate">{inc.symptoms || "No description"}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-slate-400 text-xs">{timeAgo(inc.created_at)}</p>
                            <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors mt-1 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Severity panel */}
            <div className="space-y-6">
              <div className="border border-slate-200 rounded-2xl p-7">
                <h3 className="text-lg font-black text-slate-800 mb-6">By Severity</h3>
                {loading ? (
                  <div className="space-y-5">{[1,2,3,4].map(i=><div key={i} className="h-8 bg-slate-100 rounded animate-pulse"/>)}</div>
                ) : (
                  <div className="space-y-5">
                    {["critical","high","medium","low"].map(s => {
                      const c  = sevCounts[s] || 0;
                      const sc = SEV[s];
                      return (
                        <div key={s}>
                          <div className="flex justify-between mb-2">
                            <span className={`text-sm font-bold capitalize ${sc.label}`}>{s}</span>
                            <span className="text-slate-800 font-black text-sm">{c}</span>
                          </div>
                          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full ${sc.bar} rounded-full transition-all duration-700`}
                              style={{ width: c===0 ? "0%" : `${Math.max(Math.round((c/maxSev)*100),5)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-7 pt-6 border-t border-slate-100 grid grid-cols-3 gap-3">
                  {[
                    { l:"Open",    n:incidents.filter(i=>i.status==="open").length,    c:"text-orange-500" },
                    { l:"Pending", n:incidents.filter(i=>i.status==="pending").length, c:"text-amber-500"  },
                    { l:"Closed",  n:incidents.filter(i=>i.status==="closed").length,  c:"text-green-500"  },
                  ].map(({l,n,c}) => (
                    <div key={l} className="text-center">
                      <p className={`text-2xl font-black ${c}`}>{n}</p>
                      <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mt-0.5">{l}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick actions */}
              <div className="border border-slate-200 rounded-2xl p-7">
                <h3 className="text-lg font-black text-slate-800 mb-4">Quick Actions</h3>
                <div className="space-y-2.5">
                  {[
                    { label:"Report Incident",    to:"/operations", bg:"bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200" },
                    { label:"Register Service",   to:"/registry",   bg:"bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200" },
                    { label:"View Performance",   to:"/perf-logs",  bg:"bg-violet-50 hover:bg-violet-100 text-violet-700 border-violet-200" },
                  ].map(({label,to,bg}) => (
                    <button key={label} onClick={() => navigate(to)}
                      className={`w-full px-4 py-3 rounded-xl text-sm font-bold border text-left transition-colors ${bg}`}>
                      {label} →
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════ SERVICES SECTION ══════════════════════ */}
        <section className="py-16 border-b border-slate-100">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-indigo-600 text-xs font-bold uppercase tracking-[0.15em] mb-2">Your Fleet</p>
              <h2 className="text-4xl font-black text-slate-900 leading-tight">Registered Services</h2>
              <p className="text-slate-400 text-base mt-2">Health overview of all your AI models</p>
            </div>
            <button onClick={() => navigate("/registry")}
              className="flex items-center gap-2 px-5 py-2.5 border border-slate-300 hover:border-slate-400 text-slate-700 text-sm font-bold rounded-xl transition-colors">
              Manage
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Environment breakdown bar */}
          {!loading && services.length > 0 && (
            <div className="flex gap-6 mb-8 flex-wrap">
              {Object.entries(envGroups).map(([env, count]) => {
                const style = ENV[env] || ENV.dev;
                return (
                  <div key={env} className="flex items-center gap-2.5">
                    <span className={`px-3 py-1 rounded-lg text-sm font-bold border ${style}`}>{env}</span>
                    <span className="text-slate-500 text-sm font-bold">{count} service{count > 1 ? "s" : ""}</span>
                  </div>
                );
              })}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1,2,3].map(i => <div key={i} className="h-44 bg-slate-100 rounded-2xl animate-pulse" />)}
            </div>
          ) : services.length === 0 ? (
            <div className="border-2 border-dashed border-slate-200 rounded-2xl py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <p className="text-slate-500 font-semibold text-lg">No services yet</p>
              <button onClick={() => navigate("/registry")} className="mt-3 text-indigo-600 font-bold hover:text-indigo-800">
                Register your first service →
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {svcWithInc.map(svc => {
                const envKey   = svc.environment?.toLowerCase() || "dev";
                const envStyle = ENV[envKey] || ENV.dev;
                const hasOpen  = svc.openCount > 0;
                return (
                  <button key={svc.id} onClick={() => navigate("/operations")}
                    className="group bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-xl rounded-2xl p-7 text-left transition-all duration-200 hover:-translate-y-1">
                    <div className="flex items-start justify-between mb-5">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center shrink-0">
                        <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                        </svg>
                      </div>
                      <span className={`text-xs font-bold uppercase px-3 py-1 rounded-lg border ${envStyle}`}>{svc.environment}</span>
                    </div>
                    <h3 className="text-slate-900 font-black text-lg group-hover:text-indigo-700 transition-colors">{svc.name}</h3>
                    <p className="text-slate-400 text-sm mt-1 mb-5">{svc.model_name} · {svc.owner}</p>
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                      <p className="text-slate-400 text-xs">{svc.data_sensitivity}</p>
                      {hasOpen ? (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1.5 rounded-xl border border-orange-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                          {svc.openCount} incident{svc.openCount > 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-xl border border-green-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          Healthy
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ══════════════════ EXPLORE SECTION ═══════════════════════ */}
        <section className="py-16">
          <div className="mb-10">
            <p className="text-indigo-600 text-xs font-bold uppercase tracking-[0.15em] mb-2">Platform</p>
            <h2 className="text-4xl font-black text-slate-900 leading-tight">Explore AI Pulse</h2>
            <p className="text-slate-400 text-base mt-2">Everything you need to operate AI safely and reliably</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title:"Service Registry",  desc:"Register and manage AI models with metadata, API references, and sensitivity labels.",  gradient:"from-blue-500 to-indigo-600",   to:"/registry",   icon:<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" /> },
              { title:"Performance Logs",  desc:"Benchmark evaluations and drift detection using LLM-as-a-Judge across your models.",    gradient:"from-violet-500 to-purple-600", to:"/perf-logs",  icon:<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /> },
              { title:"Operations Center", desc:"Unified incident and maintenance management — create, resolve, and track events.",        gradient:"from-rose-500 to-pink-600",     to:"/operations", icon:<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /> },
              { title:"Data Policy",       desc:"Review data handling, classification, and retention policies across the platform.",      gradient:"from-teal-500 to-cyan-600",     to:"/policy",     icon:<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /> },
              ...(isAdmin ? [
                { title:"Audit Log",     desc:"Complete audit trail of every system action, user change, and approval.",                   gradient:"from-emerald-500 to-green-600", to:"/audit",   icon:<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /> },
                { title:"User Manager",  desc:"Manage team accounts, roles, and temporary access elevation requests.",                     gradient:"from-amber-500 to-orange-500",  to:"/users",   icon:<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /> },
              ] : []),
            ].map(f => (
              <button key={f.title} onClick={() => navigate(f.to)}
                className="group bg-white border border-slate-200 hover:border-slate-300 hover:shadow-xl rounded-2xl p-7 text-left transition-all duration-200 hover:-translate-y-1">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${f.gradient} flex items-center justify-center text-white mb-6 shadow-lg group-hover:scale-110 transition-transform duration-200`}>
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">{f.icon}</svg>
                </div>
                <h3 className="text-slate-900 font-black text-lg mb-2 group-hover:text-indigo-700 transition-colors">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </button>
            ))}
          </div>
        </section>

      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 bg-slate-50 py-8 text-center">
        <p className="text-slate-400 text-sm">AI Pulse · Enterprise AI Governance Platform</p>
      </div>

    </div>
  );
}
