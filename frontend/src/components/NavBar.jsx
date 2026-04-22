import { NavLink, useNavigate } from "react-router-dom";

const BASE_LINKS = [
  { to: "/dashboard",  label: "Dashboard"        },
  { to: "/registry",   label: "Service Registry" },
  { to: "/perf-logs",  label: "Performance Logs" },
  { to: "/operations", label: "Operations"       },
  { to: "/policy",     label: "Data Policy"      },
];

const ADMIN_LINKS = [
  { to: "/audit", label: "Audit Log"    },
  { to: "/users", label: "User Manager" },
];

export default function NavBar() {
  const navigate = useNavigate();
  const username      = localStorage.getItem("username")      || "—";
  const role          = localStorage.getItem("role")          || "—";
  const effectiveRole = localStorage.getItem("effectiveRole") || role;
  const isTempAdmin   = localStorage.getItem("isTempAdmin") === "true";
  const NAV_LINKS = effectiveRole === "admin"
    ? [...BASE_LINKS, ...ADMIN_LINKS]
    : role === "maintainer"
    ? [...BASE_LINKS, { to: "/users", label: "Access Request" }]
    : BASE_LINKS;

  function handleLogout() {
    localStorage.clear();
    navigate("/login");
  }

  return (
    <nav className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between gap-4">
      {/* Brand */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-7 h-7 rounded-md bg-indigo-600 flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <span className="text-white font-semibold text-sm whitespace-nowrap">AI Ops</span>
      </div>

      {/* Links */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
        {NAV_LINKS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </div>

      {/* User info + logout */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right hidden sm:block">
          <p className="text-white text-sm font-medium leading-none">{username}</p>
          <p className="text-gray-500 text-xs mt-0.5 capitalize flex items-center gap-1">
            {effectiveRole}
            {isTempAdmin && <span className="text-amber-400 text-[10px] font-bold">(temp)</span>}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 bg-gray-800 hover:bg-red-900/50 border border-gray-700 hover:border-red-700/60 text-gray-300 hover:text-red-300 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </button>
      </div>
    </nav>
  );
}
