const COMPLIANCE_BADGES = [
  { label: "No PII Stored",          color: "green"  },
  { label: "Audit Logged",           color: "indigo" },
  { label: "Local-First",            color: "indigo" },
  { label: "Zero Prompt Retention",  color: "green"  },
];

const DATA_CLASSES = [
  { type: "Service Config",    fields: "Name, owner, env, model, API key ref",         sensitivity: "Internal",     color: "indigo" },
  { type: "Evaluation Results",fields: "Scores, timestamps, dataset type",             sensitivity: "Internal",     color: "indigo" },
  { type: "Incidents",         fields: "Symptoms, timeline, AI summaries",             sensitivity: "Confidential", color: "amber"  },
  { type: "Maintenance Plans", fields: "Risk level, rollback plan, approval",          sensitivity: "Confidential", color: "amber"  },
  { type: "Audit Logs",        fields: "Action, resource, user, timestamp",            sensitivity: "Restricted",   color: "red"    },
  { type: "User Accounts",     fields: "Username, email, role (no plain passwords)",   sensitivity: "Restricted",   color: "red"    },
];

const SECTIONS = [
  {
    id: "retention", label: "01", title: "Data Retention",
    rules: [
      "Evaluation results are stored indefinitely — only scores and metadata, never prompt text.",
      "Incident summaries are generated once and stored; the originating prompt is not retained after the API call completes.",
      "Audit log entries are immutable and permanently retained for compliance.",
      "Drift judge results store model responses in full — treat this as internal data only.",
    ],
  },
  {
    id: "prompt", label: "02", title: "Prompt Logging Policy",
    rules: [
      "Test prompts sent to models during evaluation runs are not persisted to the database.",
      "Only the evaluation output (score, pass/fail, metrics) is written to storage.",
      "Incident text submitted to the LLM for post-mortem generation is not stored after the response is received.",
      "Drift judge tool calls and raw LLM JSON are stored in drift_judge_results — do not include PII in sample sets.",
    ],
  },
  {
    id: "routing", label: "03", title: "Network & Data Routing",
    rules: [
      "The React frontend and FastAPI backend both run entirely on your local machine.",
      "Cloud LLM APIs (OpenAI, Anthropic, etc.) are called by the backend only — the browser never contacts them directly.",
      "API keys are referenced by name in the database, not stored in plaintext.",
      "No telemetry, analytics, or usage data is transmitted to any third-party service outside the configured LLM providers.",
    ],
  },
  {
    id: "access", label: "04", title: "Role-Based Data Access",
    rules: [
      "Viewers can read services, evaluations, and incidents — no write access.",
      "Maintainers can create and manage services, incidents, and maintenance plans.",
      "Admins have full access including user management, audit logs, and governance controls.",
      "Temporary admin elevation is time-bounded, audited, and cannot be self-approved.",
    ],
  },
];

const sensitivityStyle = (color) => {
  if (color === "green")  return { pill: "bg-green-100 text-green-700 border-green-200",  dot: "bg-green-500"  };
  if (color === "amber")  return { pill: "bg-amber-100 text-amber-700 border-amber-200",  dot: "bg-amber-500"  };
  if (color === "red")    return { pill: "bg-red-100 text-red-700 border-red-200",         dot: "bg-red-500"    };
  return                         { pill: "bg-indigo-100 text-indigo-700 border-indigo-200",dot: "bg-indigo-500" };
};

const badgeStyle = (color) => {
  if (color === "green") return "bg-green-50 text-green-700 border-green-200";
  return "bg-indigo-50 text-indigo-700 border-indigo-200";
};

export default function DataPolicy() {
  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Hero ── */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-800/30 via-transparent to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
        <div className="relative max-w-5xl mx-auto px-10 pt-14 pb-16">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="text-indigo-400 text-xs font-bold uppercase tracking-[0.2em]">Governance Document</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-3">Data Handling Policy</h1>
          <p className="text-slate-400 text-base max-w-xl leading-relaxed mb-8">
            Defines how data is classified, stored, transmitted, and protected across the AI Pulse platform.
          </p>
          {/* Compliance badges */}
          <div className="flex flex-wrap gap-2">
            {COMPLIANCE_BADGES.map(b => (
              <span key={b.label} className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-bold ${badgeStyle(b.color)}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${b.color === "green" ? "bg-green-500" : "bg-indigo-500"}`} />
                {b.label}
              </span>
            ))}
          </div>
          <p className="text-slate-600 text-xs mt-6">v1.2 · April 2026 · Internal Use Only</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-10 py-14 space-y-14">

        {/* ── Data Classification ── */}
        <section>
          <div className="mb-6">
            <p className="text-indigo-600 text-xs font-bold uppercase tracking-[0.15em] mb-2">Classification</p>
            <h2 className="text-3xl font-black text-slate-900">Data Classification Matrix</h2>
            <p className="text-slate-400 text-base mt-1">All data stored by this system and its sensitivity level</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
              {DATA_CLASSES.map((d, idx) => {
                const s = sensitivityStyle(d.color);
                return (
                  <div key={d.type} className={`p-6 hover:bg-slate-50 transition-colors ${idx >= 3 ? "border-t border-slate-100" : ""}`}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <span className="text-slate-800 font-bold text-sm">{d.type}</span>
                      <span className={`shrink-0 text-[10px] font-black px-2.5 py-1 rounded-full border uppercase tracking-wide ${s.pill}`}>
                        {d.sensitivity}
                      </span>
                    </div>
                    <p className="text-slate-400 text-xs leading-relaxed">{d.fields}</p>
                  </div>
                );
              })}
            </div>
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex gap-4 flex-wrap">
              {[["green","Internal"],["amber","Confidential"],["red","Restricted"]].map(([c, l]) => {
                const s = sensitivityStyle(c);
                return (
                  <span key={l} className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${s.pill}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                    {l}
                  </span>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Data Flow ── */}
        <section>
          <div className="mb-6">
            <p className="text-indigo-600 text-xs font-bold uppercase tracking-[0.15em] mb-2">Architecture</p>
            <h2 className="text-3xl font-black text-slate-900">Data Flow Boundary</h2>
            <p className="text-slate-400 text-base mt-1">Where your data travels and what crosses the cloud boundary</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Browser */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-6 py-5 text-center min-w-[120px]">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-slate-800 text-sm font-bold">Browser</p>
                <p className="text-slate-400 text-xs mt-0.5">React UI</p>
              </div>

              <div className="flex flex-col items-center gap-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-px bg-indigo-300" />
                  <span className="text-[10px] font-bold text-indigo-600 uppercase bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">localhost</span>
                  <div className="w-10 h-px bg-indigo-300" />
                </div>
              </div>

              {/* Backend */}
              <div className="bg-indigo-50 border border-indigo-300 rounded-2xl px-6 py-5 text-center min-w-[120px]">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                  </svg>
                </div>
                <p className="text-slate-800 text-sm font-bold">Backend</p>
                <p className="text-slate-400 text-xs mt-0.5">FastAPI + SQLite</p>
              </div>

              <div className="flex flex-col items-center gap-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-px bg-amber-400" />
                  <span className="text-[10px] font-bold text-amber-700 uppercase bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">HTTPS · Cloud</span>
                  <div className="w-10 h-px bg-amber-400" />
                </div>
              </div>

              {/* LLM APIs */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-6 py-5 text-center min-w-[120px]">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                </div>
                <p className="text-slate-800 text-sm font-bold">LLM APIs</p>
                <p className="text-slate-400 text-xs mt-0.5">OpenAI / Anthropic</p>
              </div>
            </div>

            <p className="text-slate-400 text-sm mt-6 leading-relaxed">
              The browser has no direct access to cloud APIs. All LLM calls originate from the backend only. Evaluation prompts and incident text cross the cloud boundary — never include real data.
            </p>
          </div>
        </section>

        {/* ── Policy Sections ── */}
        <section>
          <div className="mb-6">
            <p className="text-indigo-600 text-xs font-bold uppercase tracking-[0.15em] mb-2">Policies</p>
            <h2 className="text-3xl font-black text-slate-900">Policy Details</h2>
            <p className="text-slate-400 text-base mt-1">Specific rules governing data handling in this system</p>
          </div>

          <div className="space-y-4">
            {SECTIONS.map(s => (
              <div key={s.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-7 py-5 border-b border-slate-100 bg-slate-50 flex items-center gap-4">
                  <span className="text-2xl font-black text-indigo-200 tabular-nums leading-none">{s.label}</span>
                  <h3 className="text-base font-black text-slate-800">{s.title}</h3>
                </div>
                <ul className="divide-y divide-slate-50">
                  {s.rules.map((rule, i) => (
                    <li key={i} className="flex items-start gap-4 px-7 py-4 hover:bg-slate-50 transition-colors">
                      <span className="mt-1 w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                      </span>
                      <p className="text-slate-600 text-sm leading-relaxed">{rule}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ── Warning ── */}
        <section>
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-red-400 to-transparent rounded-t-2xl" />
            <div className="flex items-start gap-5">
              <div className="w-12 h-12 rounded-2xl bg-red-100 border border-red-200 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="text-red-800 font-black text-lg mb-2">No Real Data Policy</p>
                <p className="text-red-600 text-sm leading-relaxed mb-3">
                  All data entered into this system must be fully synthetic. Do not enter real employee names, customer records, proprietary company information, or production API credentials into any form in this application.
                </p>
                <p className="text-red-500 text-xs font-bold uppercase tracking-wider">
                  Violation may expose sensitive information to cloud AI providers.
                </p>
              </div>
            </div>
          </div>
        </section>

      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 bg-white py-8 text-center">
        <p className="text-slate-400 text-sm">AI Pulse · Internal Governance · v1.2 · April 2026</p>
      </div>

    </div>
  );
}
