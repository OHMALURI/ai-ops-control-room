import { useState, useEffect } from "react";
import api from "../api.js";

function authHeader() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const ROLES = ["admin", "maintainer", "user"];

function UserRow({ user, onSaved }) {
  const [role, setRole] = useState(user.role);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await api.put(
        `/auth/users/${user.username}/role`,
        { role },
        { headers: authHeader() }
      );
      setSaved(true);
      onSaved(user.id, role);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error("Role update failed", err);
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
        <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded border ${
          user.role === "admin"
            ? "bg-indigo-900/50 text-indigo-300 border-indigo-700/50"
            : user.role === "maintainer"
            ? "bg-amber-900/40 text-amber-300 border-amber-700/50"
            : "bg-gray-800 text-gray-400 border-gray-700"
        }`}>
          {user.role}
        </span>
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center gap-2">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <button
            onClick={handleSave}
            disabled={saving || role === user.role}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {saved && (
            <span className="text-green-400 text-xs font-medium">✓ Saved</span>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function UserManager() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const currentRole = localStorage.getItem("role");
  const isAdmin = currentRole === "admin";

  useEffect(() => {
    if (!isAdmin) { setTimeout(() => setLoading(false), 0); return; }
    const fetchUsers = async () => {
      try {
        const { data } = await api.get("/auth/users", { headers: authHeader() });
        setUsers(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [isAdmin]);

  function handleSaved(id, newRole) {
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, role: newRole } : u))
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 bg-red-900/30 border border-red-700/50 text-red-300 rounded-2xl px-6 py-5">
          <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524L13.477 14.89zm1.414-1.414L6.524 5.11A6 6 0 0114.89 13.476zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="font-semibold">Access Denied — Admin only</p>
            <p className="text-sm text-red-400 mt-0.5">You do not have permission to manage users.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">User Manager</h1>
        <p className="text-gray-400 text-sm mt-0.5">Manage accounts and role assignments</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <svg className="animate-spin w-6 h-6 mr-3 text-indigo-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Loading users…
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-20 text-gray-500">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-800 text-gray-400 uppercase text-xs tracking-wider">
                <tr>
                  {["ID", "Username", "Email", "Current Role", "Change Role"].map((h) => (
                    <th key={h} className="px-5 py-3 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {users.map((user) => (
                  <UserRow key={user.id} user={user} onSaved={handleSaved} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
