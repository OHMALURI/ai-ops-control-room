const COMPLIANCE_BADGES = [
  { label: "No PII Stored", color: "green" },
  { label: "Audit Logged", color: "indigo" },
  { label: "Local-First", color: "indigo" },
  { label: "Zero Prompt Retention", color: "green" },
];

const DATA_CLASSES = [
  { type: "Service Config", fields: "Name, owner, env, model, API key ref", sensitivity: "Internal", color: "indigo" },
  { type: "Evaluation Results", fields: "Scores, timestamps, dataset type", sensitivity: "Internal", color: "indigo" },
  { type: "Incidents", fields: "Symptoms, timeline, AI summaries", sensitivity: "Confidential", color: "amber" },
  { type: "Maintenance Plans", fields: "Risk level, rollback plan, approval", sensitivity: "Confidential", color: "amber" },
  { type: "Audit Logs", fields: "Action, resource, user, timestamp", sensitivity: "Restricted", color: "red" },
  { type: "User Accounts", fields: "Username, email, role (no plain passwords)", sensitivity: "Restricted", color: "red" },
];

const SECTIONS = [
  {
    id: "retention",
    label: "01",
    title: "Data Retention",
    color: "indigo",
    rules: [
      { text: "Evaluation results are stored indefinitely — only scores and metadata, never prompt text." },
      { text: "Incident summaries are generated once and stored; the originating prompt is not retained after the API call completes." },
      { text: "Audit log entries are immutable and permanently retained for compliance." },
      { text: "Drift judge results store model responses in full — treat this as internal data only." },
    ],
  },
  {
    id: "prompt",
    label: "02",
    title: "Prompt Logging Policy",
    color: "indigo",
    rules: [
      { text: "Test prompts sent to models during evaluation runs are not persisted to the database." },
      { text: "Only the evaluation output (score, pass/fail, metrics) is written to storage." },
      { text: "Incident text submitted to the LLM for post-mortem generation is not stored after the response is received." },
      { text: "Drift judge tool calls and raw LLM JSON are stored in drift_judge_results — do not include PII in sample sets." },
    ],
  },
  {
    id: "routing",
    label: "03",
    title: "Network & Data Routing",
    color: "indigo",
    rules: [
      { text: "The React frontend and FastAPI backend both run entirely on your local machine." },
      { text: "Cloud LLM APIs (OpenAI, Anthropic, etc.) are called by the backend only — the browser never contacts them directly." },
      { text: "API keys are referenced by name in the database, not stored in plaintext." },
      { text: "No telemetry, analytics, or usage data is transmitted to any third-party service outside the configured LLM providers." },
    ],
  },
  {
    id: "access",
    label: "04",
    title: "Role-Based Data Access",
    color: "indigo",
    rules: [
      { text: "Viewers can read services, evaluations, and incidents — no write access." },
      { text: "Maintainers can create and manage services, incidents, and maintenance plans." },
      { text: "Admins have full access including user management, audit logs, and governance controls." },
      { text: "Temporary admin elevation is time-bounded, audited, and cannot be self-approved." },
    ],
  },
];

const sensitivityStyle = (color) => {
  if (color === "green") return "bg-green-900/30 text-green-400 border-green-700/40";
  if (color === "amber") return "bg-amber-900/30 text-amber-400 border-amber-700/40";
  if (color === "red") return "bg-red-900/30 text-red-400 border-red-700/40";
  return "bg-indigo-900/30 text-indigo-400 border-indigo-700/40";
};

const badgeStyle = (color) => {
  if (color === "green") return "bg-green-900/20 text-green-400 border-green-700/30";
  return "bg-indigo-900/20 text-indigo-400 border-indigo-700/30";
};

export default function DataPolicy() {
  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* ── Header ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-600 via-indigo-400 to-transparent" />
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                  <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Governance Document</span>
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Data Handling Policy</h1>
              <p className="text-gray-400 text-sm mt-1.5 max-w-lg leading-relaxed">
                Defines how data is classified, stored, transmitted, and protected across the AI Ops Control Room platform.
              </p>
            </div>
            <div className="flex flex-col gap-2 shrink-0 text-right">
              <div className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Effective</div>
              <div className="text-sm font-bold text-gray-300">April 2026</div>
              <div className="text-[10px] text-gray-600">v1.2 · Internal Use Only</div>
            </div>
          </div>

          {/* Compliance badges */}
          <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-gray-800">
            {COMPLIANCE_BADGES.map(b => (
              <span key={b.label} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-bold ${badgeStyle(b.color)}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${b.color === "green" ? "bg-green-400" : "bg-indigo-400"}`} />
                {b.label}
              </span>
            ))}
          </div>
        </div>

        {/* ── Data Classification ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden">
          <div className="px-8 py-5 border-b border-gray-800 bg-gray-800/20">
            <h2 className="text-sm font-bold text-white uppercase tracking-widest">Data Classification Matrix</h2>
            <p className="text-gray-500 text-xs mt-0.5">All data categories stored by this system and their sensitivity level</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-800">
            {DATA_CLASSES.map(d => (
              <div key={d.type} className="bg-gray-900 p-6 hover:bg-gray-800/40 transition-colors">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <span className="text-white font-bold text-sm">{d.type}</span>
                  <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide ${sensitivityStyle(d.color)}`}>
                    {d.sensitivity}
                  </span>
                </div>
                <p className="text-gray-500 text-xs leading-relaxed">{d.fields}</p>
              </div>
            ))}
          </div>
          <div className="px-8 py-3 border-t border-gray-800 bg-gray-800/10 flex gap-4">
            {[["green","Internal"],["amber","Confidential"],["red","Restricted"]].map(([c, l]) => (
              <span key={l} className={`inline-flex items-center gap-1.5 text-[10px] font-bold ${sensitivityStyle(c)} px-2 py-0.5 rounded border`}>
                <span className={`w-1.5 h-1.5 rounded-full ${c === "green" ? "bg-green-400" : c === "amber" ? "bg-amber-400" : "bg-red-400"}`} />
                {l}
              </span>
            ))}
          </div>
        </div>

        {/* ── Data Flow ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8">
          <h2 className="text-sm font-bold text-white uppercase tracking-widest mb-6">Data Flow Boundary</h2>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Browser */}
            <div className="bg-gray-800 border border-gray-700 rounded-2xl px-5 py-4 text-center min-w-[110px]">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-2">
                <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </div>
              <p className="text-white text-xs font-bold">Browser</p>
              <p className="text-gray-500 text-[10px] mt-0.5">React UI</p>
            </div>

            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-1.5">
                <div className="w-12 h-px bg-indigo-600/60" />
                <span className="text-[9px] font-bold text-indigo-500 uppercase">localhost</span>
                <div className="w-12 h-px bg-indigo-600/60" />
              </div>
            </div>

            {/* Backend */}
            <div className="bg-gray-800 border border-indigo-700/40 rounded-2xl px-5 py-4 text-center min-w-[110px]">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-2">
                <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>
              </div>
              <p className="text-white text-xs font-bold">Backend</p>
              <p className="text-gray-500 text-[10px] mt-0.5">FastAPI + SQLite</p>
            </div>

            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-px bg-gray-600" />
                <div className="w-0 h-0 border-t-4 border-b-4 border-l-6 border-t-transparent border-b-transparent border-l-gray-500" style={{borderLeftWidth:'6px'}} />
              </div>
              <span className="text-[9px] font-bold text-amber-500 uppercase bg-amber-900/20 border border-amber-700/30 px-2 py-0.5 rounded-full">HTTPS · Cloud boundary</span>
            </div>

            {/* LLM Cloud */}
            <div className="bg-amber-900/10 border border-amber-700/30 rounded-2xl px-5 py-4 text-center min-w-[110px]">
              <div className="w-8 h-8 rounded-lg bg-amber-600/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-2">
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
              </div>
              <p className="text-white text-xs font-bold">LLM APIs</p>
              <p className="text-gray-500 text-[10px] mt-0.5">OpenAI / Anthropic</p>
            </div>
          </div>
          <p className="text-gray-600 text-xs mt-5 leading-relaxed">
            The browser has no direct access to cloud APIs. All LLM calls originate from the backend only. Evaluation prompts and incident text cross the cloud boundary — never include real data.
          </p>
        </div>

        {/* ── Policy Sections ── */}
        <div className="space-y-4">
          {SECTIONS.map(s => (
            <div key={s.id} className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden">
              <div className="px-8 py-5 border-b border-gray-800 bg-gray-800/20 flex items-center gap-4">
                <span className="text-[11px] font-black text-indigo-500/60 tracking-widest tabular-nums">{s.label}</span>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">{s.title}</h2>
              </div>
              <ul className="divide-y divide-gray-800/50">
                {s.rules.map((r, i) => (
                  <li key={i} className="flex items-start gap-4 px-8 py-4 hover:bg-gray-800/20 transition-colors">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    </span>
                    <p className="text-gray-300 text-sm leading-relaxed">{r.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ── Critical Warning ── */}
        <div className="bg-red-950/30 border border-red-700/40 rounded-3xl p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-red-500 to-transparent" />
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-red-900/40 border border-red-700/40 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-red-300 font-bold text-base mb-1">No Real Data Policy</p>
              <p className="text-red-300/70 text-sm leading-relaxed mb-3">
                All data entered into this system must be fully synthetic. Do not enter real employee names, customer records, proprietary company information, or production API credentials into any form in this application.
              </p>
              <p className="text-red-400/60 text-xs font-bold uppercase tracking-wider">
                Violation may expose sensitive information to cloud AI providers.
              </p>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between text-[11px] text-gray-700 pb-2">
          <span>AI Operations Control Room · Internal Governance</span>
          <span>v1.2 · April 2026</span>
        </div>

      </div>
    </div>
  );
}
