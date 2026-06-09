import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore";
import { useThemeStore } from "../../store/useThemeStore";
import { LogOut, User, Moon, Sun } from "lucide-react";

export const Navbar = () => {
  const { authUser, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();
  const dark = theme === "dark";

  return (
    <nav className={\`h-16 flex items-center justify-between px-6 border-b shrink-0 z-50 \${
      dark ? "bg-[#0d0d12] border-white/5" : "bg-white border-slate-200"
    }\`}>
      <div className="flex items-center gap-8">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="Logo" className="h-8 w-auto" onError={(e) => {
            e.currentTarget.src = "https://ui-avatars.com/api/?name=W&background=f97316&color=fff";
          }} />
          <span className={\`font-bold tracking-tight text-lg \${dark ? "text-white" : "text-slate-900"}\`}>
            Wireup.ai
          </span>
        </Link>

        {authUser && (
          <div className="hidden md:flex items-center gap-6">
            <Link to="/home" className={\`text-sm font-medium \${dark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"}\`}>
              Dashboard
            </Link>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={toggleTheme}
          className={\`p-2 rounded-lg transition-colors \${
            dark ? "text-slate-400 hover:bg-white/5" : "text-slate-500 hover:bg-slate-100"
          }\`}
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {authUser ? (
          <div className="flex items-center gap-3">
            <div className={\`flex items-center gap-2 px-3 py-1.5 rounded-full border \${
              dark ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200"
            }\`}>
              <User size={14} className={dark ? "text-slate-400" : "text-slate-500"} />
              <span className={\`text-xs font-medium \${dark ? "text-slate-200" : "text-slate-700"}\`}>
                {authUser.fullName}
              </span>
            </div>
            <button
              onClick={() => { logout(); navigate("/auth"); }}
              className={\`p-2 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors\`}
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        ) : (
          <Link
            to="/auth"
            className="px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-bold hover:bg-orange-500 transition-colors"
          >
            Sign In
          </Link>
        )}
      </div>
    </nav>
  );
};
