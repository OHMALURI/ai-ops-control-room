import { useEffect, useRef } from "react";
import { useTheme } from "../contexts/ThemeContext";

/* Pre-compute dot grid positions (outside component — computed once) */
const DOT_GAP = 24;
const DOTS = [];
for (let row = 0; row * DOT_GAP < 330; row++) {
  for (let col = 0; col * DOT_GAP < 920; col++) {
    DOTS.push({ cx: col * DOT_GAP + 1.2, cy: row * DOT_GAP + 1.2 });
  }
}

/* ── Data ────────────────────────────────────────────────────── */

const DATA_CLASSES = [
  { type: "Service Config",     fields: "Name, owner, env, model, API key ref",       sc: "indigo", sensitivity: "Internal"     },
  { type: "Evaluation Results", fields: "Scores, timestamps, dataset type",           sc: "indigo", sensitivity: "Internal"     },
  { type: "Incidents",          fields: "Symptoms, timeline, AI summaries",           sc: "amber",  sensitivity: "Confidential" },
  { type: "Maintenance Plans",  fields: "Risk level, rollback plan, approval",        sc: "amber",  sensitivity: "Confidential" },
  { type: "Audit Logs",         fields: "Action, resource, user, timestamp",          sc: "red",    sensitivity: "Restricted"   },
  { type: "User Accounts",      fields: "Username, email, role (no plain passwords)", sc: "red",    sensitivity: "Restricted"   },
];

const COMPLIANCE = [
  "Audit Logged", "Local-First", "Zero Prompt Retention",
];

const POLICY_CARDS = [
  {
    id: "retention", title: "Data Retention",
    rules: [
      "Evaluation results stored indefinitely — scores and metadata only, never prompt text.",
      "Incident summaries generated once and stored; originating prompts are not retained.",
      "Audit log entries are immutable and permanently retained for compliance.",
      "Drift judge results store full model responses — treat as internal data only.",
    ],
  },
  {
    id: "prompts", title: "Prompt Logging",
    rules: [
      "Test prompts sent during evaluation runs are never persisted to the database.",
      "Only evaluation output (score, pass/fail, metrics) is written to storage.",
      "Incident text submitted for post-mortem generation is discarded after response.",
      "Drift judge raw LLM JSON is stored — do not include PII in sample sets.",
    ],
  },
  {
    id: "network", title: "Network & Routing",
    rules: [
      "Frontend and backend run entirely on your local machine — no cloud hosting.",
      "Cloud LLM APIs are called by the backend only; browser never contacts them.",
      "API keys referenced by name in the database, never stored in plaintext.",
      "No telemetry or usage data transmitted outside configured LLM providers.",
    ],
  },
  {
    id: "access", title: "Role-Based Access",
    rules: [
      "Viewers: read services, evaluations, and incidents — no write access.",
      "Maintainers: create and manage services, incidents, and maintenance plans.",
      "Admins: full access — user management, audit logs, and governance controls.",
      "Temp admin elevation is time-bounded, audited, and cannot be self-approved.",
    ],
  },
];

/* ── Mind map topology ───────────────────────────────────────── */

const HUB = { x: 450, y: 82 };

const NODES = [
  { id: "classification", label: ["Data",    "Types"],      color: "#818cf8", x:  82, y: 236, delay: "0s",     count: "6 types"  },
  { id: "retention",      label: ["Data",    "Retention"],  color: "#38bdf8", x: 216, y: 263, delay: "0.12s",  count: "4 rules"  },
  { id: "prompts",        label: ["Prompt",  "Logging"],    color: "#34d399", x: 350, y: 273, delay: "0.24s",  count: "4 rules"  },
  { id: "network",        label: ["Network", "& Routing"],  color: "#fbbf24", x: 550, y: 273, delay: "0.36s",  count: "4 rules"  },
  { id: "access",         label: ["Role",    "Access"],     color: "#fb923c", x: 684, y: 263, delay: "0.48s",  count: "4 rules"  },
  { id: "compliance",     label: ["Safety",  "& Policy"],   color: "#4ade80", x: 818, y: 236, delay: "0.6s",   count: "4 checks" },
];

const CARD_ORDER = ["classification", "retention", "prompts", "network", "access", "compliance"];

function branch(n) {
  return `M ${HUB.x} ${HUB.y} C ${HUB.x} ${HUB.y + 100} ${n.x} ${n.y - 62} ${n.x} ${n.y}`;
}

/* ── Sensitivity palette ─────────────────────────────────────── */
const SENS = {
  indigo: { bg: "rgba(99,102,241,0.14)",  border: "#4338ca60", text: "#a5b4fc" },
  amber:  { bg: "rgba(245,158,11,0.14)",  border: "#b4530060", text: "#fcd34d" },
  red:    { bg: "rgba(239,68,68,0.14)",   border: "#dc262660", text: "#fca5a5" },
};

const SENS_LIGHT = {
  indigo: { bg: "rgba(99,102,241,0.10)",  border: "#6366f140", text: "#4f46e5" },
  amber:  { bg: "rgba(245,158,11,0.10)",  border: "#d9770640", text: "#b45309" },
  red:    { bg: "rgba(239,68,68,0.10)",   border: "#dc262640", text: "#dc2626" },
};

/* ── Component ───────────────────────────────────────────────── */

export default function DataPolicy() {
  const { dark } = useTheme();
  const isAdmin = localStorage.getItem("effectiveRole") === "admin";
  /* ── Theme colour palette ── */
  const C = {
    pageBg:        dark ? "#08090f"  : "#f4f6fb",
    pageText:      dark ? "#e2e8f0"  : "#1e293b",
    svgTopGrad:    dark ? "rgba(99,102,241,0.11)" : "rgba(99,102,241,0.07)",
    dotDefault:    dark ? "#181e2d"  : "#c8d0df",
    hubGradId:     dark ? "url(#hub-grad)" : "url(#hub-grad-light)",
    hubText:       dark ? "#ffffff"  : "#1e293b",
    hubSub:        dark ? "#475569"  : "#475569",
    hubVer:        dark ? "#1e2d3d"  : "#94a3b8",
    nodeBody:      dark ? "#0a0c18"  : "#ffffff",
    nodeCount:     dark ? "#2d3b50"  : "#94a3b8",
    branchOpacity: dark ? "0.5"      : "0.55",
    divGrad:       dark ? "#1e2a3a"  : "#cbd5e1",
    divText:       dark ? "#263040"  : "#94a3b8",
    cardBg:        dark ? "#0b0d18"  : "#ffffff",
    cardBorder:    dark ? "#161d2c"  : "#e2e8f0",
    cardHdrBorder: dark ? "#101520"  : "#f1f5f9",
    cardSub:       dark ? "#243040"  : "#94a3b8",
    classTitle:    dark ? "#cbd5e1"  : "#334155",
    classField:    dark ? "#2d3b50"  : "#64748b",
    ruleText:      dark ? "#6b7280"  : "#475569",
    compBadgeText: dark ? "#86efac"  : "#15803d",
    flowBg:        dark ? "#070910"  : "#f8fafc",
    flowBorder:    dark ? "#131b28"  : "#e2e8f0",
    flowLabel:     dark ? "#1e2d3d"  : "#94a3b8",
    flowNodeBg:    dark ? "#0c0f1a"  : "#f1f5f9",
    flowNodeBorder:dark ? "#1e2535"  : "#e2e8f0",
    flowNodeText:  dark ? "#64748b"  : "#64748b",
    flowNodeSub:   dark ? "#1e2d3d"  : "#94a3b8",
    arrowCloud:    dark ? "#fbbf24"  : "#f59e0b",
    arrowNorm:     dark ? "#1e2d3d"  : "#cbd5e1",
    warningText:   dark ? "#f87171"  : "#dc2626",
    warningBody:   dark ? "#374151"  : "#64748b",
    footerBorder:  dark ? "#10161f"  : "#e2e8f0",
    footerText:    dark ? "#1a2535"  : "#94a3b8",
  };

  const SENS_PAL = dark ? SENS : SENS_LIGHT;

  /* ── Dot interactivity ── */
  const svgRef    = useRef(null);
  const mouseRef  = useRef({ x: -9999, y: -9999 });
  const rafRef    = useRef(null);
  const themeRef  = useRef(dark);

  useEffect(() => { themeRef.current = dark; }, [dark]);

  /* Reset dot fills when theme changes */
  useEffect(() => {
    if (!svgRef.current) return;
    const fill = dark ? "#181e2d" : "#c8d0df";
    svgRef.current.querySelectorAll(".bg-dot").forEach(dot => {
      dot.setAttribute("r",            "0.7");
      dot.setAttribute("fill",         fill);
      dot.setAttribute("fill-opacity", "1");
    });
  }, [dark]);

  function applyDotEffect(mx, my) {
    if (!svgRef.current) return;
    const RADIUS   = 72;
    const resetFill = themeRef.current ? "#181e2d" : "#c8d0df";
    svgRef.current.querySelectorAll(".bg-dot").forEach(dot => {
      const cx   = +dot.getAttribute("data-cx");
      const cy   = +dot.getAttribute("data-cy");
      const dist = Math.sqrt((cx - mx) ** 2 + (cy - my) ** 2);
      if (dist < RADIUS) {
        const t    = 1 - dist / RADIUS;
        const ease = t * t * (3 - 2 * t);
        dot.setAttribute("r",            (0.7 + ease * 1.5).toFixed(2));
        dot.setAttribute("fill",         `rgb(${Math.round(99+ease*30)},${Math.round(102+ease*20)},241)`);
        dot.setAttribute("fill-opacity", (themeRef.current ? 0.12 : 0.18 + ease * 0.82).toFixed(2));
      } else {
        dot.setAttribute("r",            "0.7");
        dot.setAttribute("fill",         resetFill);
        dot.setAttribute("fill-opacity", "1");
      }
    });
  }

  function handleDotMouseMove(e) {
    if (!svgRef.current) return;
    const rect   = svgRef.current.getBoundingClientRect();
    const scaleX = 900 / rect.width;
    const scaleY = 315 / rect.height;
    mouseRef.current = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
    };
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        applyDotEffect(mouseRef.current.x, mouseRef.current.y);
      });
    }
  }

  function handleDotMouseLeave() {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    const resetFill = themeRef.current ? "#181e2d" : "#c8d0df";
    svgRef.current?.querySelectorAll(".bg-dot").forEach(dot => {
      dot.setAttribute("r",            "0.7");
      dot.setAttribute("fill",         resetFill);
      dot.setAttribute("fill-opacity", "1");
    });
  }


  return (
    <div style={{ minHeight: "100vh", background: C.pageBg, color: C.pageText }}>
      <style>{`
        @keyframes mm-draw  { to   { stroke-dashoffset: 0; }                         }
        @keyframes mm-node  { from { opacity:0; transform:translateY(10px); }
                              to   { opacity:1; transform:translateY(0); }           }
        @keyframes hub-pulse{ 0%,100%{opacity:.14;} 50%{opacity:.38;}               }
        @keyframes card-in  { from { opacity:0; transform:translateY(16px); }
                              to   { opacity:1; transform:translateY(0); }           }
        .mm-card { animation: card-in .45s ease both; }
      `}</style>

      {/* ══ Mind Map SVG ══ */}
      <div style={{ background: `radial-gradient(ellipse 80% 55% at 50% -5%, ${C.svgTopGrad} 0%, transparent 68%)` }}>
        <svg
          ref={svgRef}
          viewBox="0 0 900 315"
          width="100%"
          style={{ display: "block", cursor: "crosshair" }}
          onMouseMove={handleDotMouseMove}
          onMouseLeave={handleDotMouseLeave}
        >
          <defs>
            <filter id="fg-md" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="4" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="fg-sm" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <radialGradient id="hub-grad" cx="40%" cy="35%">
              <stop offset="0%"   stopColor="#1e1b4b"/>
              <stop offset="100%" stopColor="#08090f"/>
            </radialGradient>
            <radialGradient id="hub-grad-light" cx="40%" cy="35%">
              <stop offset="0%"   stopColor="#eef2ff"/>
              <stop offset="100%" stopColor="#f4f6fb"/>
            </radialGradient>
          </defs>

          {/* Interactive dot grid */}
          {DOTS.map(({ cx, cy }, i) => (
            <circle
              key={i}
              className="bg-dot"
              data-cx={cx}
              data-cy={cy}
              cx={cx} cy={cy}
              r="0.7"
              fill={C.dotDefault}
              fillOpacity="1"
            />
          ))}

          {/* Branch bezier lines */}
          {NODES.map(n => (
            <path
              key={n.id}
              d={branch(n)}
              stroke={n.color}
              strokeWidth="1.4"
              fill="none"
              strokeOpacity={C.branchOpacity}
              pathLength={1}
              style={{
                strokeDasharray: 1,
                strokeDashoffset: 1,
                animation: `mm-draw .8s ${n.delay} cubic-bezier(.4,0,.2,1) forwards`,
              }}
            />
          ))}

          {/* Hub outer breathing ring */}
          <circle cx={HUB.x} cy={HUB.y} r="62" fill="none" stroke="#6366f1" strokeWidth="0.7"
            style={{ animation: "hub-pulse 2.8s ease-in-out infinite" }} />

          {/* Hub dashed inner ring */}
          <circle cx={HUB.x} cy={HUB.y} r="52" fill="none" stroke="#6366f1"
            strokeWidth="0.5" strokeOpacity="0.25" strokeDasharray="2.5 7" />

          {/* Hub glow */}
          <circle cx={HUB.x} cy={HUB.y} r="48" fill="#6366f1" fillOpacity="0.07" filter="url(#fg-md)" />

          {/* Hub body */}
          <circle cx={HUB.x} cy={HUB.y} r="42" fill={C.hubGradId} stroke="#6366f1"
            strokeWidth="1.6" filter="url(#fg-sm)" />

          {/* Hub — checkmark shield icon */}
          <g transform={`translate(${HUB.x}, ${HUB.y - 16})`}>
            <path d="M0-9 L-6.5-6.5 V-1 C-6.5 3 -2.5 6.5 0 8 C2.5 6.5 6.5 3 6.5-1 V-6.5 Z"
              fill="#6366f1" fillOpacity="0.22" stroke="#818cf8" strokeWidth="1" strokeLinejoin="round" />
            <path d="M-3 -1 L-0.5 2 L4 -3.5"
              fill="none" stroke="#a5b4fc" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </g>

          {/* Hub labels */}
          <text x={HUB.x} y={HUB.y + 10} textAnchor="middle" fontSize="10.5" fontWeight="800"
            fill={C.hubText} fontFamily="system-ui,sans-serif" letterSpacing="0.6">AI PULSE</text>
          <text x={HUB.x} y={HUB.y + 23} textAnchor="middle" fontSize="6.5" fontWeight="600"
            fill={C.hubSub} fontFamily="system-ui,sans-serif" letterSpacing="1.8">DATA POLICY</text>
          <text x={HUB.x} y={HUB.y + 35} textAnchor="middle" fontSize="5"
            fill={C.hubVer} fontFamily="system-ui,sans-serif">v1.2 · April 2026</text>

          {/* Topic nodes */}
          {NODES.map(n => (
            <g key={n.id} style={{
              opacity: 0,
              animation: `mm-node .55s ${parseFloat(n.delay) + .55}s cubic-bezier(.34,1.56,.64,1) forwards`,
            }}>
              {/* Halo */}
              <circle cx={n.x} cy={n.y} r="33" fill={n.color} fillOpacity="0.07" />
              {/* Body */}
              <circle cx={n.x} cy={n.y} r="23" fill={C.nodeBody} stroke={n.color}
                strokeWidth="1.5" filter="url(#fg-sm)" />
              {/* Centre dot */}
              <circle cx={n.x} cy={n.y} r="3.2" fill={n.color} fillOpacity="0.9" />
              {/* Labels */}
              <text x={n.x} y={n.y - 7} textAnchor="middle" fontSize="7" fontWeight="700"
                fill={n.color} fontFamily="system-ui,sans-serif">{n.label[0]}</text>
              <text x={n.x} y={n.y + 9} textAnchor="middle" fontSize="7" fontWeight="700"
                fill={n.color} fontFamily="system-ui,sans-serif">{n.label[1]}</text>
              {/* Count */}
              <text x={n.x} y={n.y + 42} textAnchor="middle" fontSize="5.5"
                fill={C.nodeCount} fontFamily="system-ui,sans-serif">{n.count}</text>
            </g>
          ))}
        </svg>
      </div>

      {/* ══ Section divider ══ */}
      <div style={{ display: "flex", alignItems: "center", padding: "0 28px", margin: "0 0 20px" }}>
        <div style={{ flex: 1, height: "1px", background: `linear-gradient(90deg,transparent,${C.divGrad})` }} />
        <span style={{ margin: "0 14px", fontSize: "12px", fontWeight: 700, color: C.divText,
          letterSpacing: "0.18em", textTransform: "uppercase" }}>Policy Details</span>
        <div style={{ flex: 1, height: "1px", background: `linear-gradient(90deg,${C.divGrad},transparent)` }} />
      </div>

      {/* ══ Content cards ══ */}
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "0 20px 60px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: 14 }}>

          {CARD_ORDER.map((id, ci) => {
            const node   = NODES.find(n => n.id === id);
            const color  = node?.color ?? "#818cf8";
            const delay  = `${ci * 0.06}s`;

            /* ── Data Classification ── */
            if (id === "classification") return (
              <div key={id} className="mm-card" style={{ animationDelay: delay,
                background: C.cardBg, border: `1px solid ${C.cardBorder}`,
                borderTop: `2px solid ${color}`, borderRadius: 13, overflow: "hidden" }}>
                <CardHeader color={color} title="Data Classification" sub="6 data types · sensitivity mapping"
                  borderColor={C.cardHdrBorder} subColor={C.cardSub} />
                <div style={{ padding: "10px 18px 16px", display: "flex", flexDirection: "column", gap: 9 }}>
                  {DATA_CLASSES.map(d => {
                    const s = SENS_PAL[d.sc];
                    return (
                      <div key={d.type} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ color: C.classTitle, fontSize: 12, fontWeight: 600, marginBottom: 1 }}>{d.type}</p>
                          <p style={{ color: C.classField, fontSize: 12, lineHeight: 1.4 }}>{d.fields}</p>
                        </div>
                        <span style={{
                          background: s.bg, border: `1px solid ${s.border}`,
                          color: s.text, fontSize: 11, fontWeight: 700,
                          padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap",
                          textTransform: "uppercase", letterSpacing: "0.04em", flexShrink: 0,
                        }}>{d.sensitivity}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );

            /* ── Compliance ── */
            if (id === "compliance") return (
              <div key={id} className="mm-card" style={{ animationDelay: delay,
                background: C.cardBg, border: `1px solid ${C.cardBorder}`,
                borderTop: `2px solid ${color}`, borderRadius: 13, overflow: "hidden" }}>
                <CardHeader color={color} title="Compliance & Safety" sub="v1.2 · April 2026 · Internal use"
                  borderColor={C.cardHdrBorder} subColor={C.cardSub} />
                <div style={{ padding: "12px 18px" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
                    {COMPLIANCE.map(c => (
                      <span key={c} style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        background: `${color}12`, border: `1px solid ${color}30`,
                        color: C.compBadgeText, fontSize: 13, fontWeight: 600,
                        padding: "4px 10px", borderRadius: 999,
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, flexShrink: 0 }} />
                        {c}
                      </span>
                    ))}
                  </div>

                  {/* Data flow mini-diagram */}
                  <div style={{ background: C.flowBg, border: `1px solid ${C.flowBorder}`, borderRadius: 9, padding: "10px 12px", marginBottom: 12 }}>
                    <p style={{ color: C.flowLabel, fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                      letterSpacing: "0.12em", marginBottom: 8 }}>Data Flow Boundary</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                      {[
                        { label: "Browser",  sub: "React UI",        accent: false },
                        { label: "→",        sub: null,              arrow: true   },
                        { label: "Backend",  sub: "FastAPI",         accent: false },
                        { label: "→",        sub: null,              arrow: true, cloud: true },
                        { label: "LLM APIs", sub: "OpenAI / Gemini", accent: true  },
                      ].map((item, i) => item.arrow ? (
                        <span key={i} style={{ color: item.cloud ? C.arrowCloud : C.arrowNorm, fontSize: 12, fontWeight: 300 }}>→</span>
                      ) : (
                        <div key={i} style={{
                          background: item.accent ? `${color}14` : C.flowNodeBg,
                          border: `1px solid ${item.accent ? color + "35" : C.flowNodeBorder}`,
                          borderRadius: 6, padding: "4px 9px", textAlign: "center",
                        }}>
                          <p style={{ color: item.accent ? color : C.flowNodeText, fontSize: 12, fontWeight: 700 }}>{item.label}</p>
                          <p style={{ color: C.flowNodeSub, fontSize: 10, marginTop: 1 }}>{item.sub}</p>
                        </div>
                      ))}
                    </div>
                    <p style={{ textAlign: "center", fontSize: 11, color: C.flowLabel, marginTop: 7 }}>
                      localhost only · browser never contacts cloud
                    </p>
                  </div>


                  {/* Warning */}
                  <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.18)",
                    borderRadius: 9, padding: "10px 13px" }}>
                    <p style={{ color: C.warningText, fontSize: 11, fontWeight: 700, marginBottom: 3 }}>
                      ⚠  No Real Data Policy
                    </p>
                    <p style={{ color: C.warningBody, fontSize: 11, lineHeight: 1.6 }}>
                      All data must be fully synthetic. Do not enter real employee names, customer records,
                      or production credentials into any form in this application.
                    </p>
                  </div>
                </div>
              </div>
            );

            /* ── Policy rule cards ── */
            const policy = POLICY_CARDS.find(p => p.id === id);
            if (!policy) return null;
            return (
              <div key={id} className="mm-card" style={{ animationDelay: delay,
                background: C.cardBg, border: `1px solid ${C.cardBorder}`,
                borderTop: `2px solid ${color}`, borderRadius: 13, overflow: "hidden" }}>
                <CardHeader color={color} title={policy.title} sub="4 governing rules"
                  borderColor={C.cardHdrBorder} subColor={C.cardSub} />
                <ul style={{ padding: "10px 18px 16px", display: "flex", flexDirection: "column", gap: 10, listStyle: "none", margin: 0 }}>
                  {policy.rules.map((rule, ri) => (
                    <li key={ri} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <span style={{
                        width: 18, height: 18, borderRadius: "50%",
                        background: `${color}14`, border: `1px solid ${color}35`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontWeight: 800, color, flexShrink: 0, marginTop: 1,
                      }}>{ri + 1}</span>
                      <span style={{ color: C.ruleText, fontSize: 12, lineHeight: 1.65 }}>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

        </div>
      </div>

      {/* ══ Footer ══ */}
      <div style={{ borderTop: `1px solid ${C.footerBorder}`, padding: "18px", textAlign: "center" }}>
        <p style={{ color: C.footerText, fontSize: 11 }}>AI Pulse · Internal Governance · v1.2 · April 2026</p>
      </div>
    </div>
  );
}

/* ── Shared sub-component ─────────────────────────────────────── */
function CardHeader({ color, title, sub, borderColor, subColor }) {
  return (
    <div style={{ padding: "14px 18px 11px", borderBottom: `1px solid ${borderColor}`, display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{
        width: 30, height: 30, borderRadius: "50%",
        background: `${color}14`, border: `1px solid ${color}35`,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: color,
          boxShadow: `0 0 6px ${color}` }} />
      </div>
      <div>
        <p style={{ color, fontSize: 13, fontWeight: 700, letterSpacing: "0.09em",
          textTransform: "uppercase", marginBottom: 1 }}>{title}</p>
        <p style={{ color: subColor, fontSize: 12 }}>{sub}</p>
      </div>
    </div>
  );
}
