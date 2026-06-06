import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeStore } from "../store/useThemeStore";
import { DiscoveryModal } from "../components/DiscoveryModal";

// ─── Types ────────────────────────────────────────────────────────────────────

type Project = {
  _id: string;
  description: string;
  createdAt: string;
};

type SettingsForm = {
  fullName: string;
  email: string;
  newPassword: string;
  confirmPassword: string;
};

// ─── Mouse glow tracker ───────────────────────────────────────────────────────

function MouseGlow({ dark }: { dark: boolean }) {
  const glowRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: -999, y: -999 });
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      posRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", move);

    const tick = () => {
      if (glowRef.current) {
        glowRef.current.style.left = `${posRef.current.x}px`;
        glowRef.current.style.top = `${posRef.current.y}px`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", move);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      ref={glowRef}
      className="pointer-events-none fixed z-0 -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity duration-300"
      style={{
        width: 560,
        height: 560,
        background: dark
          ? "radial-gradient(circle, rgba(99,102,241,0.13) 0%, rgba(139,92,246,0.07) 40%, transparent 70%)"
          : "radial-gradient(circle, rgba(99,102,241,0.09) 0%, rgba(139,92,246,0.05) 40%, transparent 70%)",
        filter: "blur(8px)",
      }}
    />
  );
}

// ─── Sidebar nav item ─────────────────────────────────────────────────────────

function NavItem({
  icon,
  label,
  active = false,
  dark,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  dark: boolean;
  onClick?: () => void;
}) {
  const base = "group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition-all duration-150";
  const activeClass = dark
    ? "bg-indigo-500/15 text-indigo-300"
    : "bg-indigo-50 text-indigo-700";
  const idleClass = dark
    ? "text-slate-400 hover:bg-white/5 hover:text-slate-200"
    : "text-slate-500 hover:bg-slate-100 hover:text-slate-800";
  const iconActive = dark ? "bg-indigo-500/20 text-indigo-400" : "bg-indigo-100 text-indigo-600";
  const iconIdle = dark
    ? "bg-white/5 text-slate-500 group-hover:bg-white/10 group-hover:text-slate-300"
    : "bg-slate-100 text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-600";

  return (
    <button onClick={onClick} className={`${base} ${active ? activeClass : idleClass}`}>
      <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors ${active ? iconActive : iconIdle}`}>
        {icon}
      </span>
      {label}
    </button>
  );
}

// ─── Project card ─────────────────────────────────────────────────────────────

function ProjectCard({
  project, dark, onOpen, onDiscovery, onFormulation, onEdit, onDelete,
}: {
  project: Project;
  dark: boolean;
  onOpen: () => void;
  onDiscovery: () => void;
  onFormulation: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const date = new Date(project.createdAt).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });

  const card = dark
    ? "border-white/8 bg-white/[0.03] hover:border-indigo-500/30 hover:bg-white/[0.06]"
    : "border-slate-200/80 bg-white hover:border-indigo-200 hover:shadow-md";

  return (
    <div className={`group relative flex flex-col md:flex-row md:items-center gap-3 md:gap-5 rounded-2xl border px-5 py-4 md:px-6 md:py-5 shadow-sm transition-all duration-200 ${card}`}>
      {/* accent strip */}
      <div className="absolute inset-y-0 left-0 w-[3px] rounded-l-2xl bg-gradient-to-b from-indigo-500 to-violet-500 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

      {/* top row: icon + info wrapper */}
      <div className="flex items-center gap-4 w-full md:w-auto md:flex-1 min-w-0">
        {/* icon */}
        <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border ${dark ? "border-indigo-500/20 bg-indigo-500/10" : "border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50"}`}>
          <svg className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
          </svg>
        </div>

        {/* info */}
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm font-semibold ${dark ? "text-slate-100" : "text-slate-800"}`}>
            {project.description}
          </p>
          <p className={`mt-1 text-xs ${dark ? "text-slate-500" : "text-slate-400"}`}>{date}</p>
        </div>
      </div>

      {/* actions */}
      <div className="flex items-center gap-2 flex-wrap w-full md:w-auto md:opacity-0 md:group-hover:opacity-100 transition-all duration-150 justify-start md:justify-end mt-1 md:mt-0 border-t border-slate-100 dark:border-white/5 pt-3 md:pt-0">
        <PillButton label="Open" onClick={onOpen} variant="primary" />
        <PillButton label="Discovery" onClick={onDiscovery} dark={dark} />
        <PillButton label="Formulation" onClick={onFormulation} dark={dark} />
        <div className={`hidden md:block mx-1 h-4 w-px ${dark ? "bg-white/10" : "bg-slate-200"}`} />
        <div className="flex items-center gap-1.5 ml-auto md:ml-0">
          <GhostIconBtn title="Rename" onClick={onEdit} dark={dark} icon={
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 013.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" />
            </svg>
          } />
          <GhostIconBtn title="Delete" onClick={onDelete} dark={dark} danger icon={
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          } />
        </div>
      </div>
    </div>
  );
}

function PillButton({ label, onClick, variant = "default", dark }: { label: string; onClick: () => void; variant?: "primary" | "default"; dark?: boolean }) {
  if (variant === "primary") {
    return (
      <button onClick={onClick} className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700">
        {label}
      </button>
    );
  }
  const cls = dark
    ? "border border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200"
    : "border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800";
  return (
    <button onClick={onClick} className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${cls}`}>
      {label}
    </button>
  );
}

function GhostIconBtn({ icon, title, onClick, dark, danger = false }: { icon: React.ReactNode; title: string; onClick: () => void; dark: boolean; danger?: boolean }) {
  const cls = danger
    ? (dark ? "text-slate-500 hover:bg-red-500/10 hover:text-red-400" : "text-slate-400 hover:bg-red-50 hover:text-red-500")
    : (dark ? "text-slate-500 hover:bg-white/8 hover:text-slate-300" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600");
  return (
    <button onClick={onClick} title={title} className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${cls}`}>
      {icon}
    </button>
  );
}

function ProjectSkeleton({ dark }: { dark: boolean }) {
  const cls = dark ? "bg-white/5" : "bg-slate-100";
  return (
    <div className={`flex items-center gap-5 rounded-2xl border px-6 py-5 ${dark ? "border-white/8 bg-white/[0.03]" : "border-slate-200/80 bg-white"}`}>
      <div className={`h-11 w-11 flex-shrink-0 rounded-xl animate-pulse ${cls}`} />
      <div className="flex-1 space-y-2.5">
        <div className={`h-3.5 w-2/3 rounded-full animate-pulse ${cls}`} />
        <div className={`h-2.5 w-1/4 rounded-full animate-pulse ${cls}`} />
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sublabel, icon, color, isText, dark }: {
  label: string; value: number | string; sublabel?: string;
  icon: React.ReactNode; color: "indigo" | "violet" | "emerald"; isText?: boolean; dark: boolean;
}) {
  const lightBg: Record<string, string> = {
    indigo: "from-indigo-50 to-white border-indigo-100",
    violet: "from-violet-50 to-white border-violet-100",
    emerald: "from-emerald-50 to-white border-emerald-100",
  };
  const darkBg: Record<string, string> = {
    indigo: "border-indigo-500/20 bg-indigo-500/5",
    violet: "border-violet-500/20 bg-violet-500/5",
    emerald: "border-emerald-500/20 bg-emerald-500/5",
  };

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${dark ? darkBg[color] : `bg-gradient-to-br ${lightBg[color]}`}`}>
      <div className="flex items-start justify-between gap-3">
        {/* ??$$$ newer code: flex-1 min-w-0 for text wrapper to prevent overlap */}
        <div className="flex-1 min-w-0">
          <p className={`text-[10px] font-semibold uppercase tracking-widest ${dark ? "text-slate-500" : "text-slate-500"}`}>{label}</p>
          <p className={`mt-2 font-bold ${dark ? "text-slate-100" : "text-slate-800"} ${isText ? "text-sm leading-tight truncate" : "text-3xl"}`}>
            {value}
          </p>
          {sublabel && <p className={`mt-1 text-[11px] ${dark ? "text-slate-600" : "text-slate-400"}`}>{sublabel}</p>}
        </div>
        {/* ??$$$ newer code: flex-shrink-0 for icon wrapper to guarantee layout dimensions */}
        <div className={`flex-shrink-0 rounded-xl p-2.5 shadow-sm ${dark ? "bg-white/5 border border-white/8" : "bg-white/80 border border-white"}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// ─── Menu helpers ─────────────────────────────────────────────────────────────

function MenuBtn({ label, onClick, dark, danger }: { label: string; onClick: () => void; dark: boolean; danger?: boolean }) {
  const cls = danger
    ? (dark ? "text-red-400 hover:bg-red-500/10" : "text-red-500 hover:bg-red-50")
    : (dark ? "text-slate-300 hover:bg-white/8 hover:text-slate-100" : "text-slate-600 hover:bg-slate-100 hover:text-slate-800");
  return (
    <button onClick={onClick} className={`w-full rounded-lg px-3 py-2.5 text-left text-xs font-medium transition-colors ${cls}`}>
      {label}
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const navigate = useNavigate();
  const { authUser, logout, updateUser } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const dark = theme === "dark";

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // ??$$$ newer code: mobile nav sidebar open state
  const [showMobileNav, setShowMobileNav] = useState(false);

  const [inputValue, setInputValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);
  const [discoveryIdea, setDiscoveryIdea] = useState("");
  const [discoveryProjectId, setDiscoveryProjectId] = useState<string | undefined>(undefined);
  const [discoveryPhase, setDiscoveryPhase] = useState<1 | 2 | undefined>(undefined);

  const [settingsForm, setSettingsForm] = useState<SettingsForm>({
    fullName: authUser?.fullName || "",
    email: authUser?.email || "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  useEffect(() => {
    setSettingsForm({ fullName: authUser?.fullName || "", email: authUser?.email || "", newPassword: "", confirmPassword: "" });
  }, [authUser]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
        setShowSettings(false);
      }
    };
    if (showProfileMenu) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showProfileMenu]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [inputValue]);

  useEffect(() => {
    (async () => {
      try {
        const res = await axiosInstance.get<Project[]>("/projects");
        setProjects(Array.isArray(res.data) ? res.data : []);
      } catch (error: any) {
        toast.error(error?.response?.data?.message || "Failed to load projects");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleCreateProject = useCallback(async (description: string, isAgentic = false) => {
    if (isCreating) return;
    const trimmed = description.trim();
    if (!trimmed) { toast.error("Project name is required"); return; }
    try {
      setIsCreating(true);
      const res = await axiosInstance.post<{ projectId: string }>("/project", { description: trimmed, isAgentic });
      navigate(`/project/${res.data.projectId}/ideation`);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || error?.response?.data?.message || "Failed to create project");
    } finally {
      setIsCreating(false);
    }
  }, [isCreating, navigate]);

  const handleSubmitAgenticInput = () => {
    if (inputValue.trim()) {
      setDiscoveryIdea(inputValue.trim());
      setShowDiscoveryModal(true);
    }
  };

  const handleEditProject = async (project: Project) => {
    const next = window.prompt("Rename project", project.description);
    if (!next || next.trim() === project.description) return;
    try {
      await axiosInstance.put(`/project/${project._id}`, { description: next.trim() });
      setProjects((prev) => prev.map((p) => p._id === project._id ? { ...p, description: next.trim() } : p));
      toast.success("Project renamed");
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to rename project");
    }
  };

  const handleDeleteProject = async (project: Project) => {
    if (!window.confirm(`Delete "${project.description}"?`)) return;
    try {
      await axiosInstance.delete(`/project/${project._id}`);
      setProjects((prev) => prev.filter((p) => p._id !== project._id));
      toast.success("Project deleted");
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to delete project");
    }
  };

  const handleLogout = async () => { await logout(); navigate("/auth"); };

  const handleSaveSettings = async () => {
    if (settingsForm.newPassword && settingsForm.newPassword !== settingsForm.confirmPassword) {
      toast.error("Passwords do not match"); return;
    }
    try {
      setIsSavingSettings(true);
      const payload: any = { fullName: settingsForm.fullName, email: settingsForm.email };
      if (settingsForm.newPassword) payload.newPassword = settingsForm.newPassword;
      await updateUser(payload);
      setShowSettings(false); setShowProfileMenu(false);
      toast.success("Account updated");
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to update account");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const firstName = authUser?.fullName?.split(" ")[0] || "there";
  const initial = authUser?.fullName?.charAt(0).toUpperCase() || "U";

  // ── theme tokens ──
  const bg = dark ? "bg-[#0d0d12]" : "bg-slate-50";
  const sidebar = dark ? "bg-[#0d0d12] border-white/[0.06]" : "bg-white border-slate-200";
  const topbar = dark ? "bg-[#0d0d12]/80 border-white/[0.06]" : "bg-white/80 border-slate-200";
  const cardBase = dark ? "bg-white/[0.03] border-white/[0.06]" : "bg-white border-slate-200";
  const inputCls = `w-full rounded-xl px-4 py-2.5 text-sm outline-none border transition ${
    dark
      ? "bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-600 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/10"
      : "bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
  }`;
  const labelCls = `text-[10px] font-semibold block mb-1.5 uppercase tracking-wider ${dark ? "text-slate-500" : "text-slate-500"}`;
  const headingColor = dark ? "text-slate-100" : "text-slate-800";
  const subColor = dark ? "text-slate-500" : "text-slate-400";

  return (
    <div className={`flex h-screen overflow-hidden font-sans ${bg}`}>
      {/* global mouse glow */}
      <MouseGlow dark={dark} />

      {/* ??$$$ newer code: Mobile nav backdrop overlay */}
      {showMobileNav && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-xs md:hidden"
          onClick={() => setShowMobileNav(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      {/* old code
      <aside className={`relative z-10 flex w-64 flex-shrink-0 flex-col border-r px-3 py-6 ${sidebar}`}>
      */}
      {/* ??$$$ newer code: Responsive sidebar sliding drawer */}
      <aside className={`w-64 flex-shrink-0 flex-col border-r px-3 py-6 transition-all duration-300 z-40
        md:relative md:translate-x-0
        ${showMobileNav ? "fixed inset-y-0 left-0 flex shadow-2xl translate-x-0" : "hidden md:flex -translate-x-full"} ${sidebar}`}>
        {/* logo */}
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25">
            <svg className="h-4.5 w-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <p className={`text-sm font-bold tracking-tight ${dark ? "text-white" : "text-slate-800"}`}>Wireup</p>
            <p className={`text-[10px] leading-none ${subColor}`}>AI Hardware Studio</p>
          </div>
        </div>

        {/* nav */}
        <nav className="flex flex-col gap-0.5">
          {[
            { label: "Home", active: true, icon: <HomeIcon />, action: () => setShowMobileNav(false) },
            { label: "Projects", icon: <FolderIcon />, action: () => setShowMobileNav(false) },
            { label: "Simulations", icon: <MonitorIcon />, action: () => { setShowMobileNav(false); navigate("/test-simulator"); } },
            { label: "Workspace", icon: <LayersIcon />, action: () => setShowMobileNav(false) },
          ].map(({ label, active, icon, action }) => (
            <NavItem key={label} label={label} active={active} dark={dark} icon={icon} onClick={action} />
          ))}
        </nav>

        <div className="flex-1" />

        {/* bottom nav */}
        <div className={`flex flex-col gap-0.5 border-t pt-4 ${dark ? "border-white/[0.06]" : "border-slate-100"}`}>
          <NavItem
            label="Settings"
            dark={dark}
            icon={<SettingsIcon />}
            onClick={() => { setShowMobileNav(false); setShowProfileMenu(true); setShowSettings(true); }}
          />
          <NavItem label="Help & Support" dark={dark} icon={<HelpIcon />} onClick={() => setShowMobileNav(false)} />
        </div>

        {/* profile */}
        <div className="relative mt-2" ref={profileRef}>
          <button
            onClick={() => { setShowProfileMenu((v) => !v); setShowSettings(false); }}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${dark ? "hover:bg-white/5" : "hover:bg-slate-100"}`}
          >
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-xs font-bold text-white shadow-sm">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className={`truncate text-xs font-semibold ${dark ? "text-slate-200" : "text-slate-700"}`}>{authUser?.fullName || "User"}</p>
              <p className={`truncate text-[10px] ${subColor}`}>{authUser?.email}</p>
            </div>
            <svg className={`h-3.5 w-3.5 flex-shrink-0 ${subColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
            </svg>
          </button>

          {showProfileMenu && (
            <div className={`absolute bottom-full left-0 right-0 mb-1 rounded-xl border shadow-2xl overflow-hidden z-50 ${dark ? "bg-[#16161e] border-white/10" : "bg-white border-slate-200"}`}>
              {!showSettings ? (
                <div className="p-1.5 space-y-0.5">
                  <MenuBtn label="Account settings" dark={dark} onClick={() => setShowSettings(true)} />
                  <MenuBtn label="Toggle theme" dark={dark} onClick={() => { toggleTheme(); setShowProfileMenu(false); }} />
                  <div className={`my-1 border-t ${dark ? "border-white/5" : "border-slate-100"}`} />
                  <MenuBtn label="Logout" dark={dark} danger onClick={handleLogout} />
                </div>
              ) : (
                <>
                  <div className={`flex items-center gap-2 border-b px-4 py-3 ${dark ? "border-white/5" : "border-slate-100"}`}>
                    <button
                      onClick={() => setShowSettings(false)}
                      className={`flex h-6 w-6 items-center justify-center rounded-lg transition-colors ${dark ? "text-slate-400 hover:bg-white/8 hover:text-slate-200" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"}`}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className={`text-xs font-semibold ${dark ? "text-slate-200" : "text-slate-700"}`}>Account Settings</span>
                  </div>
                  <div className="p-4 space-y-3">
                    {[
                      { lbl: "Full name", type: "text", val: settingsForm.fullName, key: "fullName" },
                      { lbl: "Email", type: "email", val: settingsForm.email, key: "email" },
                      { lbl: "New password", type: "password", val: settingsForm.newPassword, key: "newPassword", ph: "Leave blank to keep" },
                    ].map(({ lbl, type, val, key, ph }) => (
                      <div key={key}>
                        <label className={labelCls}>{lbl}</label>
                        <input
                          type={type}
                          value={val}
                          placeholder={ph}
                          onChange={(e) => setSettingsForm({ ...settingsForm, [key]: e.target.value })}
                          className={inputCls}
                        />
                      </div>
                    ))}
                    {settingsForm.newPassword && (
                      <div>
                        <label className={labelCls}>Confirm password</label>
                        <input type="password" value={settingsForm.confirmPassword}
                          onChange={(e) => setSettingsForm({ ...settingsForm, confirmPassword: e.target.value })}
                          className={inputCls} />
                      </div>
                    )}
                    <button
                      onClick={handleSaveSettings}
                      disabled={isSavingSettings}
                      className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSavingSettings ? "Saving…" : "Save changes"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex flex-1 flex-col overflow-hidden">

        {/* topbar */}
        {/* old code
        <header className={`flex h-16 flex-shrink-0 items-center justify-between border-b px-8 backdrop-blur-xl ${topbar}`}>
        */}
        {/* ??$$$ newer code: adjust topbar padding and add hamburger button on mobile */}
        <header className={`flex h-16 flex-shrink-0 items-center justify-between border-b px-4 md:px-8 backdrop-blur-xl z-20 ${topbar}`}>
          <div className="flex items-center gap-3">
            {/* ??$$$ newer code: mobile hamburger button */}
            <button
              onClick={() => setShowMobileNav(true)}
              className="flex md:hidden h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 transition-colors cursor-pointer mr-1"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest ${
              dark ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border-emerald-200 bg-emerald-50 text-emerald-600"
            }`}>
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              AI Online
            </span>
            {/* ??$$$ newer code: hide welcome text on mobile to save space */}
            <span className={`text-xs ${subColor} hidden sm:inline`}>Good {getTimeOfDay()}, {firstName}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* theme toggle */}
            <button
              onClick={toggleTheme}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${dark ? "text-slate-400 hover:bg-white/8 hover:text-slate-200" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"}`}
              title="Toggle theme"
            >
              {dark ? <SunIcon /> : <MoonIcon />}
            </button>
            <button
              onClick={() => { const d = window.prompt("Name your project"); if (d?.trim()) handleCreateProject(d.trim()); }}
              disabled={isCreating}
              className={`inline-flex items-center gap-1.5 rounded-xl border p-2 sm:px-4 sm:py-2 text-xs font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                dark
                  ? "border-white/10 bg-white/5 text-slate-300 hover:border-indigo-500/40 hover:bg-indigo-500/10 hover:text-indigo-300"
                  : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              {/* ??$$$ newer code: hide text on mobile */}
              <span className="hidden sm:inline">New project</span>
            </button>
          </div>
        </header>

        {/* scrollable body */}
        {/* old code
        <div className="flex-1 overflow-y-auto px-8 py-10">
        */}
        {/* ??$$$ newer code: adjust padding for mobile viewports */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 sm:py-10">
          <div className="mx-auto max-w-4xl space-y-12">

            {/* ── Hero heading ─────────────────────────────────────────────── */}
            <section className="pt-4 pb-2 text-center">
              <p className={`mb-3 text-xs font-semibold uppercase tracking-[0.2em] ${subColor}`}>
                AI Hardware Studio
              </p>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1]">
                <span className={`${dark ? "text-slate-100" : "text-slate-800"}`}>What do you want</span>
                <br />
                <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-pink-400 bg-clip-text text-transparent">
                  to build?
                </span>
              </h1>
              <p className={`mt-5 text-base max-w-lg mx-auto leading-relaxed ${subColor}`}>
                Describe any hardware project and Wireup will guide you through discovery, component selection, wiring, and simulation.
              </p>
            </section>

            {/* ── Prompt box ───────────────────────────────────────────────── */}
            <section>
              <div className={`relative rounded-2xl border shadow-sm transition-all ${
                dark
                  ? "border-white/[0.08] bg-white/[0.03] focus-within:border-indigo-500/40 focus-within:shadow-indigo-500/10 focus-within:shadow-lg"
                  : "border-slate-200 bg-white focus-within:border-indigo-300 focus-within:shadow-md"
              }`}>
                {/* top gradient line */}
                <div className="absolute inset-x-0 top-0 h-px rounded-t-2xl bg-gradient-to-r from-indigo-500 via-violet-500 to-pink-500 opacity-70" />

                <div className="flex items-end gap-3 px-5 pt-5 pb-4">
                  <div className="flex-shrink-0 mb-0.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/30">
                      <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                  </div>
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmitAgenticInput(); } }}
                    placeholder="e.g. Smart garden monitor with ESP32 and soil moisture sensor…"
                    disabled={isCreating}
                    className={`flex-1 resize-none bg-transparent py-1.5 text-sm outline-none leading-relaxed disabled:opacity-50 ${dark ? "text-slate-100 placeholder:text-slate-600" : "text-slate-800 placeholder:text-slate-400"}`}
                    style={{ minHeight: "32px", maxHeight: "200px" }}
                  />
                  <button
                    onClick={handleSubmitAgenticInput}
                    disabled={isCreating || !inputValue.trim()}
                    className={`flex-shrink-0 flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold transition-all ${
                      inputValue.trim() && !isCreating
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30 hover:bg-indigo-700"
                        : dark ? "bg-white/5 text-slate-600 cursor-not-allowed" : "bg-slate-100 text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    {isCreating ? (
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    ) : (
                      <>
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        AI Build
                      </>
                    )}
                  </button>
                </div>

                <div className={`flex items-center gap-2 border-t px-5 py-3 ${dark ? "border-white/5" : "border-slate-100"}`}>
                  <svg className={`h-3 w-3 flex-shrink-0 ${dark ? "text-slate-600" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className={`text-[11px] ${dark ? "text-slate-600" : "text-slate-400"}`}>
                    Tip: Be specific about components, behavior and requirements for better results.
                  </p>
                  <span className={`ml-auto text-[10px] ${dark ? "text-slate-700" : "text-slate-300"}`}>Shift+Enter for new line</span>
                </div>
              </div>

              {/* quick prompts */}
              <div className="mt-4 flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setInputValue(p)}
                    className={`rounded-full border px-3.5 py-1.5 text-[11px] font-medium transition-all ${
                      dark
                        ? "border-white/8 text-slate-500 hover:border-indigo-500/40 hover:bg-indigo-500/10 hover:text-indigo-300"
                        : "border-slate-200 bg-white text-slate-500 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </section>

            {/* ── Stats ────────────────────────────────────────────────────── */}
            {!loading && projects.length > 0 && (
              /* old code
              <section className="grid grid-cols-3 gap-5">
              */
              // ??$$$ newer code: grid layout stacks on mobile viewports
              <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
                <StatCard dark={dark} label="Total Projects" value={projects.length} color="indigo" icon={
                  <svg className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                } />
                <StatCard dark={dark} label="This Week" value={getRecentCount(projects)} sublabel="projects created" color="violet" icon={
                  <svg className="h-5 w-5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                } />
                <StatCard dark={dark} label="Latest Build" isText value={(projects[0]?.description.split(" ").slice(0, 4).join(" ") || "—") + "…"} color="emerald" icon={
                  <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                } />
              </section>
            )}

            {/* ── Projects ─────────────────────────────────────────────────── */}
            <section className="pb-12">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className={`text-base font-bold ${headingColor}`}>Recent Projects</h2>
                  {!loading && (
                    <p className={`mt-1 text-xs ${subColor}`}>
                      {projects.length} {projects.length === 1 ? "project" : "projects"}
                    </p>
                  )}
                </div>
              </div>

              {loading && (
                <div className="space-y-3">
                  {[1, 2, 3].map((n) => <ProjectSkeleton key={n} dark={dark} />)}
                </div>
              )}

              {!loading && projects.length === 0 && (
                <div className={`flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center ${dark ? "border-white/10" : "border-slate-300 bg-white"}`}>
                  <div className={`mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ${dark ? "bg-indigo-500/10 border border-indigo-500/20" : "bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100"}`}>
                    <svg className="h-7 w-7 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <p className={`text-sm font-semibold ${headingColor}`}>No projects yet</p>
                  <p className={`mt-2 text-xs max-w-xs ${subColor}`}>
                    Describe a hardware project above and let the AI guide you through the entire build.
                  </p>
                </div>
              )}

              {!loading && projects.length > 0 && (
                <div className="space-y-3">
                  {projects.map((project) => (
                    <ProjectCard
                      key={project._id}
                      project={project}
                      dark={dark}
                      onOpen={() => navigate(`/project/${project._id}/ideation`)}
                      onDiscovery={() => { setDiscoveryProjectId(project._id); setDiscoveryPhase(1); setShowDiscoveryModal(true); }}
                      onFormulation={() => { setDiscoveryProjectId(project._id); setDiscoveryPhase(2); setShowDiscoveryModal(true); }}
                      onEdit={() => handleEditProject(project)}
                      onDelete={() => handleDeleteProject(project)}
                    />
                  ))}
                </div>
              )}
            </section>

          </div>
        </div>
      </main>

      {showDiscoveryModal && (
        <DiscoveryModal
          initialIdea={discoveryIdea}
          projectId={discoveryProjectId}
          initialPhase={discoveryPhase}
          onClose={() => {
            setShowDiscoveryModal(false);
            setDiscoveryIdea("");
            setDiscoveryProjectId(undefined);
            setDiscoveryPhase(undefined);
          }}
        />
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

function getRecentCount(projects: Project[]) {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return projects.filter((p) => new Date(p.createdAt).getTime() > weekAgo).length;
}

const QUICK_PROMPTS = [
  "ESP32 temp & humidity monitor",
  "Arduino LED matrix clock",
  "Raspberry Pi security cam",
  "Soil moisture auto-watering",
];

// ─── Icon components ──────────────────────────────────────────────────────────

const HomeIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);
const FolderIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);
const MonitorIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
  </svg>
);
const LayersIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
  </svg>
);
const SettingsIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const HelpIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const SunIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);
const MoonIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
  </svg>
);
