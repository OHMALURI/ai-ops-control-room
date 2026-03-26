import { useState, useEffect } from "react";
import api from "../api.js";

function authHeader() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function AuditLog() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    api
      .get("/governance/audit-log", { headers: authHeader() })
      .then(({ data }) => setEntries(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleDownload() {
    setDownloading(true);
    try {
      const { data } = await api.get("/governance/export", {
        headers: authHeader(),
        responseType: "blob",
      });
      const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "compliance_export.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed", err);
    } finally {
      setDownloading(false);
    }
  }

  function formatTs(ts) {
    if (!ts) return "—";
    return new Date(ts).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Log</h1>
          <p className="text-gray-400 text-sm mt-0.5">Full history of system write actions</p>
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {downloading ? "Exporting…" : "Download Evidence"}
        </button>
      </div>

      {/* Table card */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <svg className="animate-spin w-6 h-6 mr-3 text-indigo-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Loading audit log…
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-20 text-gray-500">No audit log entries yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-800 text-gray-400 uppercase text-xs tracking-wider">
                <tr>
                  {["Timestamp", "User ID", "Action", "Resource", "Details"].map((h) => (
                    <th key={h} className="px-5 py-3 font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {entries.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-5 py-3 text-gray-300 whitespace-nowrap">{formatTs(row.timestamp)}</td>
                    <td className="px-5 py-3 text-gray-400">{row.user_id ?? "—"}</td>
                    <td className="px-5 py-3">
                      <span className="inline-block bg-indigo-900/50 text-indigo-300 border border-indigo-700/50 text-xs font-mono px-2 py-0.5 rounded">
                        {row.action}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-300 font-mono text-xs">{row.resource}</td>
                    <td className="px-5 py-3 text-gray-400 max-w-xs truncate" title={row.details}>
                      {row.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
