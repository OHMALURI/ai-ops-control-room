import { NavLink, useNavigate } from "react-router-dom";

const BASE_LINKS = [
  {
    to: "/dashboard", label: "Dashboard",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
  },
  {
    to: "/registry", label: "Services",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />,
  },
  {
    to: "/perf-logs", label: "Performance",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
  },
  {
    to: "/operations", label: "Operations",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />,
  },
  {
    to: "/policy", label: "Policy",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />,
  },
];

const ADMIN_LINKS = [
  {
    to: "/audit", label: "Audit",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />,
  },
  {
    to: "/users", label: "Users",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />,
  },
];

const MAINTAINER_EXTRA = {
  to: "/users", label: "Access",
  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />,
};

function roleColors(role, isTemp) {
  if (isTemp) return "bg-amber-500/10 text-amber-400 border-amber-500/30";
  if (role === "admin") return "bg-indigo-500/10 text-indigo-400 border-indigo-500/30";
  if (role === "maintainer") return "bg-cyan-500/10 text-cyan-400 border-cyan-500/30";
  return "bg-gray-700/40 text-gray-400 border-gray-600/40";
}

function Initials({ name }) {
  const letters = name.split(/[\s_]/).map(w => w[0]?.toUpperCase()).filter(Boolean).slice(0, 2).join("");
  return (
    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-600 to-indigo-800 flex items-center justify-center text-white text-sm font-bold shrink-0 ring-2 ring-indigo-500/20 select-none">
      {letters || "?"}
    </div>
  );
}

export default function NavBar() {
  const navigate = useNavigate();
  const username      = localStorage.getItem("username")      || "—";
  const role          = localStorage.getItem("role")          || "user";
  const effectiveRole = localStorage.getItem("effectiveRole") || role;
  const isTempAdmin   = localStorage.getItem("isTempAdmin") === "true";

  const NAV_LINKS = effectiveRole === "admin"
    ? [...BASE_LINKS, ...ADMIN_LINKS]
    : role === "maintainer"
    ? [...BASE_LINKS, MAINTAINER_EXTRA]
    : BASE_LINKS;

  function handleLogout() {
    localStorage.clear();
    navigate("/login");
  }

  const displayRole = isTempAdmin ? "admin (temp)" : effectiveRole;

  return (
    <nav className="bg-gray-900/95 backdrop-blur border-b border-gray-800 sticky top-0 z-50">
      <div className="px-6 h-16 flex items-center gap-4">

        {/* ── Brand ── */}
        <div className="flex items-center gap-2.5 shrink-0 mr-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M3 12h3l2-7 4 14 3-10 2 3h4" />
            </svg>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-indigo-400 font-black text-base tracking-tight">AI</span>
            <span className="text-white font-bold text-base tracking-tight">Pulse</span>
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="w-px h-5 bg-gray-800 shrink-0" />

        {/* ── Nav Links ── */}
        <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide flex-1 min-w-0">
          {NAV_LINKS.map(({ to, label, icon }) => (
            <NavLink
              key={to + label}
              to={to}
              end={to === "/dashboard"}
              className={({ isActive }) =>
                `group relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-150 ${
                  isActive
                    ? "text-white bg-indigo-600/20 border border-indigo-500/30"
                    : "text-gray-500 hover:text-gray-200 hover:bg-gray-800/60 border border-transparent"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <svg className={`w-4 h-4 shrink-0 transition-colors ${isActive ? "text-indigo-400" : "text-gray-600 group-hover:text-gray-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {icon}
                  </svg>
                  <span>{label}</span>
                  {isActive && <span className="absolute bottom-0 left-3 right-3 h-px bg-indigo-500 rounded-full" />}
                </>
              )}
            </NavLink>
          ))}
        </div>

        {/* ── User section ── */}
        <div className="flex items-center gap-2.5 shrink-0 ml-auto pl-2 border-l border-gray-800">
          <Initials name={username} />

          <div className="hidden sm:flex flex-col leading-none gap-1.5">
            <span className="text-white text-sm font-semibold">{username}</span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border capitalize ${roleColors(effectiveRole, isTempAdmin)}`}>
              {displayRole}
            </span>
          </div>

          <button
            onClick={handleLogout}
            title="Sign out"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-900/20 border border-transparent hover:border-red-800/50 transition-all ml-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>

      </div>
    </nav>
  );
}
