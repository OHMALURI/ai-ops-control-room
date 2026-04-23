import { useState, useEffect } from "react";
import api from "../api.js";

const ROLES = ["admin", "maintainer", "user"];

function roleBadge(role) {
  if (role === "admin") return "bg-indigo-900/50 text-indigo-300 border-indigo-700/50";
  if (role === "maintainer") return "bg-amber-900/40 text-amber-300 border-amber-700/50";
  return "bg-gray-800 text-gray-400 border-gray-700";
}

function statusBadge(status) {
  if (status === "approved") return "bg-green-900/40 text-green-300 border-green-700/50";
  if (status === "pending") return "bg-amber-900/40 text-amber-300 border-amber-700/50";
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
function UserRow({ user, onSaved, isTempAdmin, setActionMsg }) {
  const currentUsername = localStorage.getItem("username") || "";
  const isSelf = user?.username === currentUsername;

  const [role, setRole] = useState(ROLES.includes(user?.role) ? user.role : "user");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);

  const options = isTempAdmin ? ROLES.filter(r => r !== "admin") : ROLES;

  async function handleSave() {
    setSaving(true); setSaved(false); setError("");
    try {
      const payload = { email };
      // Only send role if it actually changed (avoids Pydantic error on legacy roles)
      if (!isSelf && role !== user.role) payload.role = role;
      if (password.trim()) payload.password = password;

      const { data } = await api.put(`/auth/users/${user.username}/update`, payload);
      setSaved(true);
      if (onSaved) onSaved();
      if (setActionMsg) setActionMsg(`Successfully updated ${user.username}`);
      setPassword(""); // clear password after save
      setTimeout(() => setSaved(false), 2500);
      if (setActionMsg) setTimeout(() => setActionMsg(""), 4000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className={`transition-colors group ${isSelf ? "bg-indigo-500/5 hover:bg-indigo-500/10" : "hover:bg-gray-800/30"}`}>
      <td className="px-8 py-6 text-gray-500 tabular-nums font-medium text-xs">
        {isSelf ? <span className="text-indigo-400 font-bold">YOU</span> : `#${user.id}`}
      </td>
      <td className="px-8 py-6">
        <div className="flex flex-col gap-2 min-w-[200px]">
          <span className="text-white font-bold text-base tracking-tight">{user.username}</span>
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-xs text-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
            placeholder="Email address"
          />
        </div>
      </td>
      <td className="px-8 py-6">
        <div className="flex flex-col gap-3">
          <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border self-start ${roleBadge(user.role)}`}>
            Current: {user.role}
          </span>
          <div className={`relative group/select ${isSelf ? "opacity-50 cursor-not-allowed" : ""}`}>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              disabled={isSelf}
              className={`bg-gray-800 border border-gray-700 text-gray-100 text-xs font-semibold rounded-xl pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none w-full ${isSelf ? "cursor-not-allowed" : "cursor-pointer"}`}
            >
              {options.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {!isSelf && (
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-8 py-6">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest ml-1">Reset Password</label>
          <div className="relative">
            <input
              type={showPass ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="New password"
              className="w-full bg-gray-800/50 border border-gray-700 text-xs text-gray-300 rounded-lg pl-3 pr-10 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors p-1"
            >
              {showPass ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.076m1.406-1.406A10.015 10.015 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.059 10.059 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
              )}
            </button>
          </div>
        </div>
      </td>
      <td className="px-8 py-6 text-right">
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={handleSave}
            disabled={saving || (role === user.role && email === user.email && !password.trim())}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-600 disabled:border-transparent text-white text-xs font-bold uppercase tracking-widest px-6 py-2.5 rounded-xl border border-indigo-500 shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
          >
            {saving ? "SAVING..." : saved ? "SAVED ✓" : "Update User"}
          </button>
          {error && <div className="text-[10px] text-red-500 font-bold max-w-[150px] leading-tight">{error}</div>}
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
  const recentGrants = grants.filter(g => g.status !== "pending");

  return (
    <div className="space-y-10">
      {/* Add User Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden shadow-2xl relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent"></div>
        <div className="px-8 py-6 border-b border-gray-800 bg-gray-800/20">
          <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
            Provision New User
          </h2>
        </div>
        <form onSubmit={handleAddUser} className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Username</label>
              <input
                placeholder="j_doe"
                value={addForm.username}
                onChange={e => setAddForm(p => ({ ...p, username: e.target.value }))}
                required
                className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Email Address</label>
              <input
                type="email"
                placeholder="john@example.com"
                value={addForm.email}
                onChange={e => setAddForm(p => ({ ...p, email: e.target.value }))}
                required
                className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={addForm.password}
                onChange={e => setAddForm(p => ({ ...p, password: e.target.value }))}
                required
                className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Assigned Role</label>
              <select
                value={addForm.role}
                onChange={e => setAddForm(p => ({ ...p, role: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm font-semibold rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none"
              >
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between">
            {addError && <p className="text-red-400 text-xs font-medium flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              {addError}
            </p>}
            <button
              type="submit"
              disabled={adding}
              className="ml-auto bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-bold px-8 py-3 rounded-xl transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
            >
              {adding ? "Provisioning…" : "Add User to System"}
            </button>
          </div>
        </form>
      </div>

      {/* User Table Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="px-8 py-6 border-b border-gray-800 flex items-center justify-between bg-gray-800/20">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-white uppercase tracking-wider">System Directory</h2>
            {actionMsg && (
              <span className="ml-4 px-3 py-1 bg-green-900/30 border border-green-500/30 text-green-400 text-xs font-bold rounded-lg animate-fade-in">
                {actionMsg}
              </span>
            )}
          </div>
          <div className="text-[10px] font-bold text-gray-500 uppercase bg-gray-800 px-3 py-1 rounded-full border border-gray-700">
            {users.length} Active Records
          </div>
        </div>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-500">
            <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
            <span className="text-sm font-medium">Synchronizing records…</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-800 text-gray-400 uppercase text-xs tracking-widest font-bold border-b border-gray-800">
                <tr>
                  <th className="px-8 py-5 font-bold">Identifier</th>
                  <th className="px-8 py-5 font-bold">Account</th>
                  <th className="px-8 py-5 font-bold">Role Status</th>
                  <th className="px-8 py-5 font-bold">Security</th>
                  <th className="px-8 py-5 font-bold text-right">Management Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {users.map(u => (
                  <UserRow key={u.id} user={u} isTempAdmin={isTempAdmin} setActionMsg={setActionMsg}
                    onSaved={() => fetchUsers()} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Temp access requests */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-8 py-6 border-b border-gray-800 flex items-center justify-between bg-gray-800/20">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-white uppercase tracking-wider">Temporary Access Requests</h2>
            {pendingGrants.length > 0 && (
              <span className="bg-amber-900/30 text-amber-400 border border-amber-500/30 text-xs font-bold px-3 py-1 rounded-full animate-pulse">
                {pendingGrants.length} PENDING
              </span>
            )}
          </div>
        </div>

        {actionMsg && (
          <div className="mx-6 mt-4 p-3 bg-indigo-900/20 border border-indigo-500/30 text-indigo-300 text-xs rounded-xl flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {actionMsg}
          </div>
        )}

        {grantsLoading ? (
          <div className="py-20 flex justify-center">
            <div className="w-6 h-6 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
          </div>
        ) : grants.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-600 text-sm italic">No requests in the queue.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {/* Pending Requests Section */}
            {pendingGrants.length > 0 && (
              <div className="bg-amber-900/5">
                {pendingGrants.map(g => (
                  <div key={g.id} className="px-6 py-5 flex items-start justify-between gap-6 hover:bg-amber-900/10 transition-colors">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-white font-bold text-base tracking-tight">{g.username}</span>
                        <span className="text-xs font-bold text-gray-500 bg-gray-800 px-2 py-1 rounded uppercase">{g.duration_hours}h REQUEST</span>
                      </div>
                      <p className="text-gray-300 text-sm leading-relaxed mb-2">"{g.reason}"</p>
                      <div className="text-xs text-gray-500 font-medium">
                        Submitted {new Date(g.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0 self-center">
                      <button onClick={() => handleGrant(g.id, "approve")}
                        className="bg-green-600 hover:bg-green-500 text-white text-sm font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-green-900/20 active:scale-95">
                        Approve
                      </button>
                      <button onClick={() => handleGrant(g.id, "reject")}
                        className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-bold px-6 py-3 rounded-xl border border-gray-700 transition-all active:scale-95">
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Recent History Section */}
            <div className="bg-gray-900/30">
              {recentGrants.slice(0, 8).map(g => (
                <div key={g.id} className="px-6 py-4 flex items-center justify-between gap-4 group">
                  <div className="flex items-center gap-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-700 group-hover:bg-gray-500 transition-colors"></div>
                    <div className="flex flex-col w-32">
                      <span className="text-gray-300 font-bold text-sm truncate">{g.username}</span>
                      <span className="text-[10px] text-gray-600 font-medium">{new Date(g.created_at).toLocaleDateString()}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadge(g.status)} uppercase tracking-tighter shrink-0`}>
                      {g.status}
                    </span>
                    <div className="flex flex-col">
                      {g.status === "approved" && g.expires_at ? (
                        <div className="text-[10px] text-gray-500 font-medium flex items-center gap-1.5">
                          <span className="text-gray-400">{new Date(g.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="text-gray-700">→</span>
                          <span className="text-gray-400">{new Date(g.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="ml-1 text-indigo-900/60 font-bold">({g.duration_hours}h)</span>
                        </div>
                      ) : (
                        <span className="text-gray-600 text-xs font-medium">
                          {g.duration_hours}h requested
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-600 font-bold uppercase tracking-widest italic opacity-0 group-hover:opacity-100 transition-opacity">
                    {g.status === "approved" ? `by ${g.granted_by || 'system'}` : g.status === "rejected" ? 'rejected' : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── MaintainerView ────────────────────────────────────────────────────────────
function MaintainerView({ effectiveRole }) {
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [form, setForm] = useState({ reason: "", durationHr: 1, durationMin: 0 });
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");

  const toDurationHours = (hr, min) => hr + min / 60;
  const durationValid = (hr, min) => (hr > 0 || min > 0) && (hr < 24 || (hr === 24 && min === 0));

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data } = await api.get("/auth/temp-access/requests");
      setHistory(data);
    } catch (err) {
      console.error("Failed to fetch history", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => { fetchHistory(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true); setSubmitMsg("");
    try {
      const duration_hours = toDurationHours(form.durationHr, form.durationMin);
      await api.post("/auth/temp-access/request", { reason: form.reason, duration_hours });
      setSubmitMsg("success|Request submitted successfully.");
      setForm({ reason: "", durationHr: 1, durationMin: 0 });
      await fetchHistory();
    } catch (err) {
      setSubmitMsg(`error|${err.response?.data?.detail || "Failed to submit request"}`);
    } finally {
      setSubmitting(false);
    }
  }

  const isTempActive = effectiveRole === "admin";
  const pendingRequest = history.find(h => h.status === "pending");
  const showForm = !pendingRequest && !isTempActive;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Column: Status & Form */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-xl">
          <h2 className="text-base font-bold text-white mb-6 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.6)]"></span>
            Access Status
          </h2>

          {isTempActive ? (
            <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-xl p-4 text-indigo-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                </div>
                <span className="font-bold text-sm">Elevation Active</span>
              </div>
              <p className="text-xs text-indigo-300/80 leading-relaxed">
                You currently have temporary administrative privileges. You can manage services and incidents, but role modifications are restricted.
              </p>
            </div>
          ) : pendingRequest ? (
            <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-4 text-amber-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
                  <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <span className="font-bold text-sm">Request Pending</span>
              </div>
              <p className="text-xs text-amber-300/80 mb-3">"{pendingRequest.reason}"</p>
              <div className="text-[10px] uppercase tracking-wider font-bold text-amber-500/60">
                Submitted {new Date(pendingRequest.created_at).toLocaleDateString()}
              </div>
            </div>
          ) : (
            <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4 text-gray-400 text-sm italic">
              No active elevation. Use the form below to request temporary admin access.
            </div>
          )}

          {showForm && (
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label className="block text-[11px] uppercase tracking-wider font-bold text-gray-500 mb-2">Reason for Access</label>
                <textarea
                  value={form.reason}
                  onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                  required
                  rows={3}
                  placeholder="e.g. Investigating high-severity incident INC-402..."
                  className="w-full bg-gray-800/50 border border-gray-700 text-gray-200 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none placeholder:text-gray-600"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider font-bold text-gray-500 mb-2">Duration</label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 flex items-center bg-gray-800/50 border border-gray-700 rounded-xl px-3">
                    <input
                      type="number" min={0} max={24}
                      value={form.durationHr}
                      onChange={e => {
                        const hr = Math.min(24, Math.max(0, parseInt(e.target.value) || 0));
                        setForm(p => ({ ...p, durationHr: hr, durationMin: hr === 24 ? 0 : p.durationMin }));
                      }}
                      className="w-full bg-transparent text-white text-sm py-2.5 focus:outline-none text-center font-semibold"
                    />
                    <span className="text-gray-500 text-[10px] font-bold uppercase ml-1">hr</span>
                  </div>
                  <div className="text-gray-700 font-bold">:</div>
                  <div className="flex-1 flex items-center bg-gray-800/50 border border-gray-700 rounded-xl px-3 opacity-80">
                    <input
                      type="number" min={0} max={59}
                      value={form.durationMin}
                      disabled={form.durationHr === 24}
                      onChange={e => setForm(p => ({ ...p, durationMin: Math.min(59, Math.max(0, parseInt(e.target.value) || 0)) }))}
                      className="w-full bg-transparent text-white text-sm py-2.5 focus:outline-none text-center font-semibold disabled:opacity-40"
                    />
                    <span className="text-gray-500 text-[10px] font-bold uppercase ml-1">min</span>
                  </div>
                </div>
              </div>

              {submitMsg && (
                <div className={`text-xs px-3 py-2 rounded-lg border ${submitMsg.startsWith("success") ? "bg-green-900/20 border-green-700/30 text-green-400" : "bg-red-900/20 border-red-700/30 text-red-400"}`}>
                  {submitMsg.split("|")[1]}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !durationValid(form.durationHr, form.durationMin)}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98]"
              >
                {submitting ? "Submitting..." : "Submit Request"}
              </button>
            </form>
          )}
        </div>

        <div className="bg-gray-900/40 border border-gray-800/60 rounded-2xl p-5">
          <p className="text-[11px] text-gray-500 leading-relaxed italic">
            Elevation requests are audited. While elevated, you will have access to Audit Logs and Governance tools, but you cannot modify the role of any Admin user or promote others to Admin.
          </p>
        </div>
      </div>

      {/* Right Column: History */}
      <div className="lg:col-span-2">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-8 py-6 border-b border-gray-800 flex items-center justify-between bg-gray-800/20">
            <h2 className="text-base font-bold text-white uppercase tracking-wider">Request History</h2>
            <button onClick={fetchHistory} className="text-gray-500 hover:text-gray-300 transition-colors">
              <svg className={`w-5 h-5 ${loadingHistory ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
          </div>

          <div className="min-h-[400px]">
            {loadingHistory ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-600">
                <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
                <span className="text-sm">Fetching logs...</span>
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-gray-600">
                <svg className="w-12 h-12 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <p className="text-sm italic">No previous access requests found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-800 text-gray-400 uppercase text-xs tracking-widest font-bold border-b border-gray-800">
                    <tr>
                      <th className="px-8 py-5">Submitted</th>
                      <th className="px-8 py-5">Reason</th>
                      <th className="px-8 py-5">Access Window</th>
                      <th className="px-8 py-5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {history.map(g => (
                      <tr key={g.id} className="hover:bg-gray-800/30 transition-colors group">
                        <td className="px-8 py-6 whitespace-nowrap">
                          <div className="text-white font-bold text-sm">{new Date(g.created_at).toLocaleDateString()}</div>
                          <div className="text-xs text-gray-500 font-medium">{new Date(g.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </td>
                        <td className="px-8 py-6">
                          <p className="text-gray-300 text-sm leading-relaxed line-clamp-1 group-hover:line-clamp-none transition-all duration-300 max-w-xs">{g.reason}</p>
                        </td>
                        <td className="px-8 py-6 whitespace-nowrap">
                          {g.status === "approved" && g.expires_at ? (
                            <div className="flex flex-col">
                              <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider mb-1">Elevation Active</span>
                              <div className="text-white text-sm font-bold flex items-center gap-2">
                                <span>{new Date(g.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                <span className="text-gray-600">→</span>
                                <span>{new Date(g.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <span className="text-[10px] text-gray-500 font-bold uppercase mt-1">{g.duration_hours < 1 ? `${Math.round(g.duration_hours * 60)}m` : `${g.duration_hours}h`} window</span>
                            </div>
                          ) : (
                            <div className="text-gray-500 text-sm font-medium italic">
                              {g.duration_hours < 1 ? `${Math.round(g.duration_hours * 60)}m` : `${g.duration_hours}h`} requested
                            </div>
                          )}
                        </td>
                        <td className="px-8 py-6 text-right">
                          <span className={`inline-block text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full border shadow-sm ${statusBadge(g.status)}`}>
                            {g.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function UserManager() {
  const role = localStorage.getItem("role") || "user";
  const effectiveRole = localStorage.getItem("effectiveRole") || role;
  const isTempAdmin = localStorage.getItem("isTempAdmin") === "true";

  // Refresh effective role from /auth/me on mount
  useEffect(() => {
    api.get("/auth/me").then(({ data }) => {
      const eff = data.effective_role || data.role;
      localStorage.setItem("effectiveRole", eff);
      localStorage.setItem("isTempAdmin", data.is_temp_admin ? "true" : "false");
    }).catch(() => { });
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
