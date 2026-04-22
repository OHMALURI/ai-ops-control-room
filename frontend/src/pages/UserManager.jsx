import { useState, useEffect } from "react";
import api from "../api.js";

const ROLES = ["admin", "maintainer", "user"];

function roleBadge(role) {
  if (role === "admin")      return "bg-indigo-900/50 text-indigo-300 border-indigo-700/50";
  if (role === "maintainer") return "bg-amber-900/40 text-amber-300 border-amber-700/50";
  return "bg-gray-800 text-gray-400 border-gray-700";
}

function statusBadge(status) {
  if (status === "approved") return "bg-green-900/40 text-green-300 border-green-700/50";
  if (status === "pending")  return "bg-amber-900/40 text-amber-300 border-amber-700/50";
  if (status === "rejected") return "bg-red-900/40 text-red-300 border-red-700/50";
  return "bg-gray-800 text-gray-400 border-gray-700";
}

// ── Shared access-denied banner ───────────────────────────────────────────────
function AccessDenied({ message }) {
  return (
    <div className="flex items-center gap-3 bg-red-900/30 border border-red-700/50 text-red-300 rounded-2xl px-6 py-5">
      <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524L13.477 14.89zm1.414-1.414L6.524 5.11A6 6 0 0114.89 13.476zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
      </svg>
      <div>
        <p className="font-semibold">Access Denied</p>
        <p className="text-sm text-red-400 mt-0.5">{message}</p>
      </div>
    </div>
  );
}

// ── UserRow ───────────────────────────────────────────────────────────────────
function UserRow({ user, onSaved, isTempAdmin }) {
  const [role, setRole] = useState(user.role);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const options = isTempAdmin ? ROLES.filter(r => r !== "admin") : ROLES;

  async function handleSave() {
    setSaving(true); setSaved(false); setError("");
    try {
      await api.put(`/auth/users/${user.username}/role`, { role });
      setSaved(true);
      onSaved(user.id, role);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="hover:bg-gray-800/50 transition-colors">
      <td className="px-5 py-3 text-gray-400 tabular-nums">{user.id}</td>
      <td className="px-5 py-3 text-white font-medium">{user.username}</td>
      <td className="px-5 py-3 text-gray-300">{user.email}</td>
      <td className="px-5 py-3">
        <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded border ${roleBadge(user.role)}`}>
          {user.role}
        </span>
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center gap-2">
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          >
            {options.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button
            onClick={handleSave}
            disabled={saving || role === user.role}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {saved && <span className="text-green-400 text-xs font-medium">✓ Saved</span>}
          {error && <span className="text-red-400 text-xs">{error}</span>}
        </div>
      </td>
    </tr>
  );
}

// ── AdminView ─────────────────────────────────────────────────────────────────
function AdminView({ isTempAdmin }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [grants, setGrants] = useState([]);
  const [grantsLoading, setGrantsLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState("");

  // Add user form
  const [addForm, setAddForm] = useState({ username: "", email: "", password: "", role: "user" });
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchUsers = async () => {
    try {
      const { data } = await api.get("/auth/users");
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchGrants = async () => {
    setGrantsLoading(true);
    try {
      const { data } = await api.get("/auth/temp-access/requests");
      setGrants(data);
    } catch (err) {
      console.error(err);
    } finally {
      setGrantsLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); fetchGrants(); }, []);

  async function handleAddUser(e) {
    e.preventDefault();
    setAdding(true); setAddError("");
    try {
      await api.post("/auth/register", addForm);
      setAddForm({ username: "", email: "", password: "", role: "user" });
      await fetchUsers();
    } catch (err) {
      setAddError(err.response?.data?.detail || "Failed to create user");
    } finally {
      setAdding(false);
    }
  }

  async function handleGrant(id, action) {
    try {
      await api.put(`/auth/temp-access/${id}/${action}`);
      setActionMsg(`Request ${action}d successfully`);
      setTimeout(() => setActionMsg(""), 3000);
      await fetchGrants();
    } catch (err) {
      setActionMsg(err.response?.data?.detail || "Action failed");
    }
  }

  const pendingGrants = grants.filter(g => g.status === "pending");
  const recentGrants  = grants.filter(g => g.status !== "pending");

  return (
    <div className="space-y-8">
      {/* Add User */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Add New User</h2>
        </div>
        <form onSubmit={handleAddUser} className="p-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-4">
            <input
              placeholder="Username"
              value={addForm.username}
              onChange={e => setAddForm(p => ({ ...p, username: e.target.value }))}
              required
              className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="email"
              placeholder="Email"
              value={addForm.email}
              onChange={e => setAddForm(p => ({ ...p, email: e.target.value }))}
              required
              className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="password"
              placeholder="Password"
              value={addForm.password}
              onChange={e => setAddForm(p => ({ ...p, password: e.target.value }))}
              required
              className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <select
              value={addForm.role}
              onChange={e => setAddForm(p => ({ ...p, role: e.target.value }))}
              className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {addError && <p className="text-red-400 text-xs mb-3">{addError}</p>}
          <button
            type="submit"
            disabled={adding}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            {adding ? "Creating…" : "Create User"}
          </button>
        </form>
      </div>

      {/* User table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">All Users</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <svg className="animate-spin w-5 h-5 mr-3 text-indigo-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Loading users…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-800 text-gray-400 uppercase text-xs tracking-wider">
                <tr>
                  {["ID", "Username", "Email", "Current Role", "Change Role"].map(h => (
                    <th key={h} className="px-5 py-3 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {users.map(u => (
                  <UserRow key={u.id} user={u} isTempAdmin={isTempAdmin}
                    onSaved={(id, role) => setUsers(prev => prev.map(x => x.id === id ? { ...x, role } : x))} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Temp access requests */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Temp Access Requests</h2>
          {pendingGrants.length > 0 && (
            <span className="bg-amber-900/40 text-amber-300 border border-amber-700/50 text-xs font-bold px-2 py-0.5 rounded-full">
              {pendingGrants.length} pending
            </span>
          )}
        </div>
        {actionMsg && (
          <div className="mx-6 mt-4 text-sm text-green-400">{actionMsg}</div>
        )}
        {grantsLoading ? (
          <div className="py-10 text-center text-gray-500 text-sm">Loading…</div>
        ) : grants.length === 0 ? (
          <div className="py-10 text-center text-gray-600 text-sm italic">No temp access requests yet.</div>
        ) : (
          <div className="divide-y divide-gray-800">
            {/* Pending first */}
            {pendingGrants.map(g => (
              <div key={g.id} className="px-6 py-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-medium text-sm">{g.username}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded border ${statusBadge(g.status)}`}>{g.status}</span>
                    <span className="text-gray-500 text-xs">{g.duration_hours}h</span>
                  </div>
                  <p className="text-gray-400 text-xs truncate max-w-md">{g.reason}</p>
                  <p className="text-gray-600 text-xs mt-1">{new Date(g.created_at).toLocaleString()}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => handleGrant(g.id, "approve")}
                    className="bg-green-700 hover:bg-green-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                    Approve
                  </button>
                  <button onClick={() => handleGrant(g.id, "reject")}
                    className="bg-red-900/60 hover:bg-red-800 text-red-300 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors border border-red-700/50">
                    Reject
                  </button>
                </div>
              </div>
            ))}
            {/* Recent history */}
            {recentGrants.slice(0, 10).map(g => (
              <div key={g.id} className="px-6 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-gray-300 text-sm">{g.username}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded border ${statusBadge(g.status)}`}>{g.status}</span>
                  <span className="text-gray-600 text-xs">
                    {g.duration_hours < 1 ? `${Math.round(g.duration_hours * 60)}min` : `${g.duration_hours}h`}
                    {" · "}{new Date(g.created_at).toLocaleDateString()}
                  </span>
                  {g.granted_by && <span className="text-gray-600 text-xs">by {g.granted_by}</span>}
                </div>
                {g.expires_at && g.status === "approved" && (
                  <span className="text-gray-500 text-xs">exp {new Date(g.expires_at).toLocaleString()}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── MaintainerView ────────────────────────────────────────────────────────────
function MaintainerView({ effectiveRole }) {
  const [myRequest, setMyRequest] = useState(null);
  const [loadingRequest, setLoadingRequest] = useState(true);
  const [form, setForm] = useState({ reason: "", durationHr: 1, durationMin: 0 });
  const toDurationHours = (hr, min) => hr + min / 60;
  const durationValid = (hr, min) => (hr > 0 || min > 0) && (hr < 24 || (hr === 24 && min === 0));
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");

  const fetchMyRequest = async () => {
    setLoadingRequest(true);
    try {
      const { data } = await api.get("/auth/temp-access/my-request");
      setMyRequest(data);
    } catch {
      setMyRequest(null);
    } finally {
      setLoadingRequest(false);
    }
  };

  useEffect(() => { fetchMyRequest(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true); setSubmitMsg("");
    try {
      const duration_hours = toDurationHours(form.durationHr, form.durationMin);
      await api.post("/auth/temp-access/request", { reason: form.reason, duration_hours });
      setSubmitMsg("Request submitted. Waiting for admin approval.");
      setForm({ reason: "", durationHr: 1, durationMin: 0 });
      await fetchMyRequest();
    } catch (err) {
      setSubmitMsg(err.response?.data?.detail || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  }

  const isTempActive = effectiveRole === "admin";
  const isPending = myRequest?.status === "pending";
  const isRejected = myRequest?.status === "rejected";
  const showForm = !isPending && !isTempActive;

  return (
    <div className="space-y-6">
      {/* Current access status */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-white mb-4">My Temporary Access</h2>

        {loadingRequest ? (
          <p className="text-gray-500 text-sm">Loading…</p>
        ) : isTempActive ? (
          <div className="flex items-center gap-3 bg-green-900/30 border border-green-700/50 text-green-300 rounded-xl px-5 py-4">
            <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-semibold text-sm">Temporary Admin Access Active</p>
              {myRequest?.expires_at && (
                <p className="text-xs text-green-400 mt-0.5">
                  Expires: {new Date(myRequest.expires_at).toLocaleString()}
                </p>
              )}
              <p className="text-xs text-green-500 mt-0.5">Note: you cannot change or assign admin roles.</p>
            </div>
          </div>
        ) : isPending ? (
          <div className="flex items-center gap-3 bg-amber-900/30 border border-amber-700/50 text-amber-300 rounded-xl px-5 py-4">
            <svg className="w-5 h-5 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <div>
              <p className="font-semibold text-sm">Request Pending Approval</p>
              <p className="text-xs text-amber-400 mt-0.5">
                {myRequest.duration_hours < 1
                  ? `${Math.round(myRequest.duration_hours * 60)} min`
                  : `${myRequest.duration_hours}h`
                } · Submitted {new Date(myRequest.created_at).toLocaleString()}
              </p>
              <p className="text-xs text-amber-500 mt-0.5 max-w-xs">"{myRequest.reason}"</p>
            </div>
          </div>
        ) : isRejected ? (
          <div className="flex items-center gap-3 bg-red-900/30 border border-red-700/50 text-red-300 rounded-xl px-5 py-4 mb-4">
            <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-semibold text-sm">Last Request Rejected</p>
              <p className="text-xs text-red-400 mt-0.5">You can submit a new request below.</p>
            </div>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No active or pending temp access. Submit a request below.</p>
        )}

        {/* Request form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Reason for access</label>
              <textarea
                value={form.reason}
                onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                required
                rows={3}
                placeholder="Describe why you need temporary admin access…"
                className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Duration <span className="text-gray-600 font-normal">(max 24 hrs)</span>
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number" min={0} max={24}
                  value={form.durationHr}
                  onChange={e => {
                    const hr = Math.min(24, Math.max(0, parseInt(e.target.value) || 0));
                    setForm(p => ({ ...p, durationHr: hr, durationMin: hr === 24 ? 0 : p.durationMin }));
                  }}
                  className="w-16 bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-2 py-2 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-gray-400 text-xs font-medium">hr</span>
                <span className="text-gray-600 text-sm mx-1">:</span>
                <input
                  type="number" min={0} max={59}
                  value={form.durationMin}
                  disabled={form.durationHr === 24}
                  onChange={e => {
                    const min = Math.min(59, Math.max(0, parseInt(e.target.value) || 0));
                    setForm(p => ({ ...p, durationMin: min }));
                  }}
                  className="w-16 bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-2 py-2 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-40"
                />
                <span className="text-gray-400 text-xs font-medium">min</span>
              </div>
              {!durationValid(form.durationHr, form.durationMin) && (
                <p className="text-red-400 text-xs mt-1">Enter a duration between 1 minute and 24 hours.</p>
              )}
            </div>
            {submitMsg && <p className={`text-xs ${submitMsg.startsWith("Request submitted") ? "text-green-400" : "text-red-400"}`}>{submitMsg}</p>}
            <button
              type="submit"
              disabled={submitting || !durationValid(form.durationHr, form.durationMin)}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
            >
              {submitting ? "Submitting…" : "Request Temp Access"}
            </button>
          </form>
        )}
      </div>

      {/* Info box */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-2xl px-6 py-5">
        <p className="text-xs text-gray-500 leading-relaxed">
          As a maintainer, you can request temporary admin access for a limited period. An admin must approve the request.
          While active, you can manage users and perform admin actions — except changing or assigning the admin role.
        </p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function UserManager() {
  const role          = localStorage.getItem("role") || "user";
  const effectiveRole = localStorage.getItem("effectiveRole") || role;
  const isTempAdmin   = localStorage.getItem("isTempAdmin") === "true";

  // Refresh effective role from /auth/me on mount
  useEffect(() => {
    api.get("/auth/me").then(({ data }) => {
      const eff = data.effective_role || data.role;
      localStorage.setItem("effectiveRole", eff);
      localStorage.setItem("isTempAdmin", data.is_temp_admin ? "true" : "false");
    }).catch(() => {});
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">User Manager</h1>
        <p className="text-gray-400 text-sm mt-0.5">Manage accounts and role assignments</p>
      </div>

      {effectiveRole === "admin" ? (
        <AdminView isTempAdmin={isTempAdmin} />
      ) : role === "maintainer" ? (
        <MaintainerView effectiveRole={effectiveRole} />
      ) : (
        <AccessDenied message="User Manager is only accessible to admins and maintainers." />
      )}
    </div>
  );
}
