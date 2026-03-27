const sections = [
  {
    title: "What Data Is Stored",
    icon: "🗄️",
    items: [
      "Services — name, owner, environment config, model name, API key reference, data sensitivity label",
      "Evaluations — scores and timestamps (no prompt text retained)",
      "Incidents — symptoms, timeline, checklist JSON, and AI-generated summaries",
      "Maintenance plans — risk level, rollback plan, validation steps, approval status",
      "Audit log — every system write action with timestamp, action type, and resource path",
    ],
    note: "No real employee or customer data is stored in this system.",
  },
  {
    title: "Prompt Logging Policy",
    icon: "📝",
    items: [
      "Test prompts used during evaluation runs are not stored permanently.",
      "Only the evaluation result (score, pass/fail status) is persisted to the database.",
      "Incident symptom and timeline text submitted to OpenAI for summary generation is not retained after the API response is returned.",
    ],
    note: null,
  },
  {
    title: "Cloud vs. Local Routing",
    icon: "☁️",
    items: [
      "The frontend (React) and backend (FastAPI) both run locally on your machine.",
      "The OpenAI API (cloud) is called exclusively by the backend for three purposes: test connection checks, evaluation harness runs, and incident post-mortem summary generation.",
      "No data is transmitted to any other third-party service.",
    ],
    note: null,
  },
  {
    title: "No Real Data Policy",
    icon: "🚫",
    items: [
      "All test and demo data entered into this system must be fully synthetic.",
      "Do not enter real employee names, customer data, proprietary company information, or production credentials into any form in this application.",
      "This system is intended for internal operations tooling evaluation only.",
    ],
    note: "Violation of this policy may expose sensitive information to cloud AI providers.",
    noteType: "warning",
  },
];

export default function DataPolicy() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Data Handling Policy</h1>
        <p className="text-gray-400 text-sm mt-1">
          How data is collected, stored, processed, and protected within the AI Ops Control Room.
        </p>
      </div>

      <div className="space-y-5">
        {sections.map((section) => (
          <div
            key={section.title}
            className="bg-gray-900 border border-gray-800 rounded-2xl p-6"
          >
            {/* Section heading */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">{section.icon}</span>
              <h2 className="text-lg font-semibold text-white">{section.title}</h2>
            </div>

            {/* Bullet list */}
            <ul className="space-y-2">
              {section.items.map((item) => (
                <li key={item} className="flex items-start gap-2 text-gray-300 text-sm">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>

            {/* Inline note */}
            {section.note && (
              <div
                className={`mt-4 flex items-start gap-2 text-sm rounded-lg px-4 py-3 ${
                  section.noteType === "warning"
                    ? "bg-amber-900/30 border border-amber-700/50 text-amber-300"
                    : "bg-indigo-900/30 border border-indigo-700/50 text-indigo-300"
                }`}
              >
                <span className="shrink-0 mt-px">
                  {section.noteType === "warning" ? "⚠️" : "ℹ️"}
                </span>
                {section.note}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <p className="text-gray-600 text-xs text-center mt-8">
        Last updated — March 2026 · AI Operations Control Room
      </p>
    </div>
  );
}
