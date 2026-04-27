const COMPLIANCE_BADGES = [
  { label: "Passwords Hashed",        color: "green"  },
  { label: "Audit Logged",            color: "indigo" },
  { label: "Local-First",             color: "indigo" },
  { label: "RBAC Enforced",           color: "green"  },
];

const DATA_CLASSES = [
  { type: "Service Config",     fields: "Name, owner, environment, model name, base URL, system prompt, sensitivity tag, api_key_ref label (label only — not the actual key)", sensitivity: "Internal",     color: "indigo" },
  { type: "Evaluation Results", fields: "Quality score, accuracy, relevance, factuality, toxicity, instruction-following, latency, dataset type, drift flag — no prompt text stored", sensitivity: "Internal",     color: "indigo" },
  { type: "Drift Judge Results",fields: "Baseline & live samples, LLM raw JSON response, drift verdict, severity score, shift type — treat as confidential", sensitivity: "Confidential", color: "amber"  },
  { type: "Incidents",          fields: "Severity, symptoms, timeline, LLM-generated summary, post-mortem narrative, checklist", sensitivity: "Confidential", color: "amber"  },
  { type: "Maintenance Plans",  fields: "Risk level, rollback plan, validation steps, approval status, next eval date", sensitivity: "Confidential", color: "amber"  },
  { type: "Audit Logs",         fields: "Action, resource, user ID, username (plain text in details), timestamp — immutable, no deletion", sensitivity: "Restricted",   color: "red"    },
  { type: "User Accounts",      fields: "Username (plain text), email (plain text), hashed password (sha256-crypt), role, force-reset flag", sensitivity: "Restricted",   color: "red"    },
];

const SECTIONS = [
  {
    id: "retention", label: "01", title: "Data Retention",
    rules: [
      "All data is retained indefinitely — there is no automatic expiry or scheduled deletion for any table.",
      "Evaluation results store only metric scores, timestamps, and dataset type. The test prompts themselves are never written to the database.",
      "Incident LLM summaries and post-mortem narratives are stored permanently once generated. The original prompt sent to the LLM is not retained.",
      "Drift judge results store baseline samples, live samples, and the full raw LLM JSON response — treat these records as confidential.",
      "Audit log entries are immutable. There is no delete endpoint for audit logs.",
      "Services can be deleted by admins or maintainers; all linked evaluations, incidents, and drift results are cascade-deleted with them.",
    ],
  },
  {
    id: "prompt", label: "02", title: "What Gets Sent to Cloud LLMs",
    rules: [
      "Evaluation runs send golden-dataset test prompts and model responses to the configured judge LLM (OpenAI / Gemini) for scoring. These prompts are synthetic — do not use real data.",
      "Incident post-mortem generation sends the incident symptoms, timeline, and maintenance plan text to OpenAI. This text is not stored after the response is received.",
      "Drift judge sends baseline and live sample pairs to the selected judge model (OpenAI, Gemini, or Anthropic). The full LLM response is stored in drift_judge_results.raw_response.",
      "API keys are read exclusively from environment variables (OPENAI_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY). The api_key_ref field in services is a free-text label only and is not used for authentication.",
    ],
  },
  {
    id: "routing", label: "03", title: "Network & Data Routing",
    rules: [
      "The React frontend runs on localhost:5173 and the FastAPI backend on localhost:8000 — both are local-only.",
      "All LLM API calls (OpenAI, Anthropic, Gemini) originate from the backend only. The browser never contacts cloud providers directly.",
      "No telemetry, analytics, or usage data is sent to any third party outside the configured LLM providers.",
      "SQLite database (app.db) is stored on the local filesystem — no cloud database is used.",
    ],
  },
  {
    id: "access", label: "04", title: "Role-Based Access Control",
    rules: [
      "Users (base role) have read-only access to services, evaluations, and incidents. They cannot create, update, or approve anything.",
      "Maintainers can create and manage services, incidents, and maintenance plans. They can request time-bounded temporary admin elevation.",
      "Admins have full access — user management, audit logs, governance export, and all write operations.",
      "Temporary admin elevation requires approval from a real admin, cannot be self-approved, is time-bounded (max 24 hours), and is fully audit-logged.",
      "Temporary admins cannot promote users to admin or modify existing admin accounts.",
      "Admin password resets on another user's account are flagged as temporary — the affected user must set a new password on next login.",
    ],
  },
  {
    id: "passwords", label: "05", title: "Password & Authentication Policy",
    rules: [
      "All passwords are stored as sha256-crypt hashes — plain-text passwords are never written to the database.",
      "Passwords must be at least 8 characters and contain uppercase, lowercase, a number, and a special character.",
      "JWT tokens are used for session authentication and are stored in browser localStorage — they are not httpOnly cookies.",
      "When an admin resets a user's password, a force-reset flag is set. The user is redirected to set a new password before accessing the app.",
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
          <p className="text-slate-600 text-xs mt-6">v2.0 · April 2026 · Internal Use Only</p>
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
                  Incident symptoms, timelines, drift judge sample sets, and evaluation prompts are all sent to external cloud LLM providers for processing. Do not enter real customer data, production credentials, employee records, or proprietary business information into any field in this application.
                </p>
                <p className="text-red-500 text-xs font-bold uppercase tracking-wider">
                  All input data that touches LLM features crosses the cloud boundary — use synthetic data only.
                </p>
              </div>
            </div>
          </div>
        </section>

      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 bg-white py-8 text-center">
        <p className="text-slate-400 text-sm">AI Pulse · Internal Governance · v2.0 · April 2026</p>
      </div>

    </div>
  );
}
