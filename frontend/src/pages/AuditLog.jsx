import { useState, useEffect } from "react";
import api from "../api.js";

/* ── action category → colour tokens ─────────────────────────────────── */
const CAT = {
  auth:        { pill: "bg-blue-500/20 text-blue-400 border-blue-500",       active: "bg-blue-500 text-white border-blue-400",       dot: "bg-blue-400"    },
  service:     { pill: "bg-emerald-500/20 text-emerald-400 border-emerald-500", active: "bg-emerald-500 text-white border-emerald-400", dot: "bg-emerald-400" },
  incident:    { pill: "bg-amber-500/20 text-amber-400 border-amber-500",     active: "bg-amber-500 text-white border-amber-400",     dot: "bg-amber-400"   },
  maintenance: { pill: "bg-purple-500/20 text-purple-400 border-purple-500",  active: "bg-purple-500 text-white border-purple-400",   dot: "bg-purple-400"  },
  governance:  { pill: "bg-cyan-500/20 text-cyan-400 border-cyan-500",        active: "bg-cyan-500 text-white border-cyan-400",       dot: "bg-cyan-400"    },
  evaluation:  { pill: "bg-violet-500/20 text-violet-400 border-violet-500",  active: "bg-violet-500 text-white border-violet-400",   dot: "bg-violet-400"  },
};
const DEFAULT_CAT = { pill: "bg-gray-700/40 text-gray-300 border-gray-500", active: "bg-gray-500 text-white border-gray-400", dot: "bg-gray-400" };

function catOf(action = "") { return CAT[action.split(".")[0]] ?? DEFAULT_CAT; }

/* ── user avatar ──────────────────────────────────────────────────────── */
const AVATAR_COLORS = [
  "bg-indigo-600","bg-pink-600","bg-emerald-600","bg-amber-600","bg-cyan-600","bg-purple-600",
];
function avatarColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function initials(name = "") {
  const parts = name.split("_");
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function Avatar({ name }) {
  if (!name || name === "system") {
    return (
      <span className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-gray-400 text-xs font-bold shrink-0">
        SYS
      </span>
    );
  }
  return (
    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${avatarColor(name)}`}>
      {initials(name)}
    </span>
  );
}

/* ── timestamp ────────────────────────────────────────────────────────── */
function Ts({ ts }) {
  if (!ts) return <span className="text-gray-600">—</span>;
  const d = new Date(ts);
  return (
    <div className="leading-tight">
      <div className="text-gray-300 text-xs">{d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"})}</div>
      <div className="text-gray-500 text-xs">{d.toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</div>
    </div>
  );
}

/* ── filter select ────────────────────────────────────────────────────── */
function FilterSelect({ label, value, onChange, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-500 font-medium">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40"
      >
        {children}
      </select>
    </div>
  );
}

function FilterDate({ label, value, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-500 font-medium">{label}</label>
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40"
      />
    </div>
  );
}

/* ── stat card ────────────────────────────────────────────────────────── */
function StatCard({ label, value, sub }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
export default function AuditLog() {
  const role = localStorage.getItem("effectiveRole") || localStorage.getItem("role");

  const [entries,    setEntries]    = useState([]);
  const [allActions, setAllActions] = useState([]);
  const [allUsers,   setAllUsers]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [downloading,setDownloading]= useState(false);
  const [expandedId, setExpandedId] = useState(null);

  /* filters */
  const [fAction,   setFAction]   = useState("");
  const [fUser,     setFUser]     = useState("");
  const [fFrom,     setFFrom]     = useState("");
  const [fTo,       setFTo]       = useState("");
  const [fCategory, setFCategory] = useState("");

  /* ── load filter options ──────────────────────────────────────────── */
  useEffect(() => {
    if (role !== "admin") return;
    Promise.all([
      api.get("/governance/audit-log/actions"),
      api.get("/governance/audit-log/users"),
    ]).then(([a, u]) => {
      setAllActions(a.data);
      setAllUsers(u.data);
    }).catch(() => {});
  }, [role]);

  /* ── fetch entries ────────────────────────────────────────────────── */
  function buildQS() {
    const p = new URLSearchParams();
    if (fAction) p.set("action",    fAction);
    if (fUser)   p.set("user_id",   fUser);
    if (fFrom)   p.set("from_date", fFrom + "T00:00:00");
    if (fTo)     p.set("to_date",   fTo   + "T23:59:59");
    const s = p.toString();
    return s ? "?" + s : "";
  }

  function fetchEntries() {
    setLoading(true);
    setError(null);
    api.get(`/governance/audit-log${buildQS()}`)
      .then(({ data }) => setEntries(data))
      .catch(err => setError(err?.response?.data?.detail ?? "Failed to load audit log"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { if (role === "admin") fetchEntries(); }, [role]);

  /* ── download ─────────────────────────────────────────────────────── */
  async function handleDownload() {
    setDownloading(true);
    try {
      const { data } = await api.get(`/governance/audit-log/download${buildQS()}`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit_log_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* silent */ }
    finally { setDownloading(false); }
  }

  /* ── admin guard ──────────────────────────────────────────────────── */
  if (role !== "admin") {
    return (
      <div className="p-8 max-w-lg mx-auto mt-16">
        <div className="bg-red-950/30 border border-red-800/60 rounded-2xl p-10 text-center">
          <div className="w-14 h-14 bg-red-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <p className="text-red-300 font-semibold text-lg">Access Restricted</p>
          <p className="text-red-400/60 text-sm mt-1.5">Audit logs are visible to administrators only.</p>
        </div>
      </div>
    );
  }

  /* ── derived stats ────────────────────────────────────────────────── */
  const visibleEntries = fCategory
    ? entries.filter(e => e.action?.startsWith(fCategory + "."))
    : entries;
  const uniqueUsers = new Set(visibleEntries.map(e => e.username).filter(u => u && u !== "system")).size;
  const systemCount = visibleEntries.filter(e => !e.username || e.username === "system").length;

  /* ── group actions for dropdown ───────────────────────────────────── */
  const actionGroups = {};
  for (const a of allActions) {
    const prefix = a.split(".")[0];
    if (!actionGroups[prefix]) actionGroups[prefix] = [];
    actionGroups[prefix].push(a);
  }

  /* ════════════════════════════════════════════════════════════════════ */
  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-6">

      {/* ── header ── */}
      <div>
        <h1 className="text-2xl font-bold text-white">Audit Log</h1>
        <p className="text-gray-400 text-sm mt-0.5">Complete tamper-evident record of all system actions — admin only</p>
      </div>

      {/* ── stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Total Entries"  value={visibleEntries.length.toLocaleString()} sub={fCategory ? `filtered: ${fCategory}` : undefined} />
        <StatCard label="Named Users"    value={uniqueUsers}  sub="system actions excluded" />
        <StatCard label="System Actions" value={systemCount}  sub="no user context" />
      </div>

      {/* ── filters + export ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-5">

        {/* filter row */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Filter & View</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <FilterSelect label="Action" value={fAction} onChange={setFAction}>
              <option value="">All actions</option>
              {Object.entries(actionGroups).map(([prefix, actions]) => (
                <optgroup key={prefix} label={prefix.toUpperCase()}>
                  {actions.map(a => <option key={a} value={a}>{a}</option>)}
                </optgroup>
              ))}
            </FilterSelect>

            <FilterSelect label="User" value={fUser} onChange={setFUser}>
              <option value="">All users</option>
              {allUsers.map(u => <option key={u.id} value={u.id}>{u.username} ({u.role})</option>)}
            </FilterSelect>

            <FilterDate label="From date" value={fFrom} onChange={setFFrom} />
            <FilterDate label="To date"   value={fTo}   onChange={setFTo}   />
          </div>

          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={fetchEntries}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
            >
              Apply filters
            </button>
            <button
              onClick={() => { setFAction(""); setFUser(""); setFFrom(""); setFTo(""); }}
              className="bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 text-sm px-4 py-2 rounded-lg transition-colors"
            >
              Clear
            </button>
            {(fAction || fUser || fFrom || fTo) && (
              <span className="text-xs text-indigo-400 ml-1">Filters active — click Apply to refresh</span>
            )}
          </div>
        </div>

        {/* divider */}
        <div className="border-t border-gray-800" />

        {/* export row */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Export by Date Range</p>
          <div className="flex flex-wrap items-end gap-3">
            <FilterDate label="From" value={fFrom} onChange={setFFrom} />
            <FilterDate label="To"   value={fTo}   onChange={setFTo}   />
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {downloading ? "Exporting…" : "Download JSON"}
            </button>
            <p className="text-xs text-gray-600 self-end pb-2">
              {fFrom && fTo
                ? `Will export entries from ${fFrom} to ${fTo}`
                : fFrom
                ? `Will export entries from ${fFrom} onwards`
                : fTo
                ? `Will export entries up to ${fTo}`
                : "Leave blank to export all entries"}
            </p>
          </div>
        </div>
      </div>

      {/* ── category filter pills ── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500 font-medium mr-1">Filter by type:</span>
        <button
          onClick={() => setFCategory("")}
          className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${
            fCategory === ""
              ? "bg-gray-600 text-white border-gray-400"
              : "bg-gray-800/40 text-gray-500 border-gray-700 hover:border-gray-500 hover:text-gray-300"
          }`}
        >
          all
        </button>
        {Object.entries(CAT).map(([k, v]) => {
          const count = entries.filter(e => e.action?.startsWith(k + ".")).length;
          const active = fCategory === k;
          return (
            <button
              key={k}
              onClick={() => setFCategory(active ? "" : k)}
              className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${
                active ? v.active + " ring-2 ring-offset-1 ring-offset-gray-950 ring-current" : v.pill + " hover:brightness-125"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${v.dot}`} />
              {k}
              <span className="ml-0.5 opacity-70 font-normal">({count})</span>
            </button>
          );
        })}
        {fCategory && (
          <span className="text-xs text-indigo-400 ml-1">
            Showing <span className="font-semibold">{fCategory}</span> logs only
          </span>
        )}
      </div>

      {/* ── table ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">

        {/* error */}
        {error && (
          <div className="flex items-center gap-3 px-5 py-4 bg-red-950/30 border-b border-red-800/40 text-red-300 text-sm">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
            </svg>
            {error}
          </div>
        )}

        {/* loading */}
        {loading ? (
          <div className="flex items-center justify-center py-24 text-gray-500">
            <svg className="animate-spin w-5 h-5 mr-3 text-indigo-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Loading audit log…
          </div>
        ) : visibleEntries.length === 0 && !error ? (
          <div className="text-center py-24 text-gray-600">
            <svg className="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            No entries match the current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800/70 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="px-5 py-3 text-left font-medium w-36">Timestamp</th>
                  <th className="px-5 py-3 text-left font-medium w-40">User</th>
                  <th className="px-5 py-3 text-left font-medium w-52">Action</th>
                  <th className="px-5 py-3 text-left font-medium w-36">Resource</th>
                  <th className="px-5 py-3 text-left font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {visibleEntries.map(row => {
                  const c        = catOf(row.action);
                  const expanded = expandedId === row.id;
                  const isSystem = !row.username || row.username === "system";
                  return (
                    <tr
                      key={row.id}
                      onClick={() => setExpandedId(expanded ? null : row.id)}
                      className={`group cursor-pointer transition-colors ${expanded ? "bg-gray-800/60" : "hover:bg-gray-800/30"}`}
                    >
                      <td className="px-5 py-3 align-top">
                        <Ts ts={row.timestamp} />
                      </td>

                      <td className="px-5 py-3 align-top">
                        <div className="flex items-center gap-2">
                          <Avatar name={row.username} />
                          <p className={`text-xs font-medium ${isSystem ? "text-gray-500 italic" : "text-gray-200"}`}>
                            {row.username || "system"}
                          </p>
                        </div>
                      </td>

                      <td className="px-5 py-3 align-top">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded-md border ${c.pill}`}>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
                          {row.action}
                        </span>
                      </td>

                      <td className="px-5 py-3 align-top">
                        <code className="text-gray-500 text-xs">{row.resource}</code>
                      </td>

                      <td className="px-5 py-3 align-top max-w-md">
                        {expanded ? (
                          <p className="text-gray-200 text-xs leading-relaxed whitespace-pre-wrap break-words">
                            {row.details || "—"}
                          </p>
                        ) : (
                          <p className="text-gray-400 text-xs truncate max-w-sm group-hover:text-gray-300 transition-colors">
                            {row.details || "—"}
                          </p>
                        )}
                        {expanded && (
                          <button
                            onClick={e => { e.stopPropagation(); setExpandedId(null); }}
                            className="text-indigo-400 hover:text-indigo-300 text-xs mt-1.5 transition-colors"
                          >
                            Collapse ↑
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && visibleEntries.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-800 flex items-center justify-between text-xs text-gray-600">
            <span>{visibleEntries.length.toLocaleString()} {visibleEntries.length === 1 ? "entry" : "entries"}{fCategory ? ` · ${fCategory}` : ""}</span>
            <span>Click any row to expand full details</span>
          </div>
        )}
      </div>
    </div>
  );
}
