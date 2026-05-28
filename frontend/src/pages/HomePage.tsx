import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useThemeStore } from "../store/useThemeStore";
import { useAuthStore } from "../store/useAuthStore";
import forgeLogo from "../assets/forge logo.png";
// ??$$$ NEW FLOW
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const navigate    = useNavigate();
  const { theme, toggleTheme } = useThemeStore();
  const { authUser, logout, updateUser } = useAuthStore();
  const isDark = theme === "dark";

  // projects
  const [projects,   setProjects]   = useState<Project[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // prompt input
  const [inputValue, setInputValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // profile dropdown
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettings,     setShowSettings]     = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // ??$$$ NEW FLOW
  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);
  const [discoveryIdea, setDiscoveryIdea] = useState("");
  const [discoveryProjectId, setDiscoveryProjectId] = useState<string | undefined>(undefined);
  const [discoveryPhase, setDiscoveryPhase] = useState<1 | 2 | undefined>(undefined);

  // settings form
  const [settingsForm, setSettingsForm] = useState<SettingsForm>({
    fullName:        authUser?.fullName || "",
    email:           authUser?.email    || "",
    newPassword:     "",
    confirmPassword: "",
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // ── sync settings form when authUser changes ──
  useEffect(() => {
    setSettingsForm({
      fullName:        authUser?.fullName || "",
      email:           authUser?.email    || "",
      newPassword:     "",
      confirmPassword: "",
    });
  }, [authUser]);

  // ── close profile modal on outside click ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileModal(false);
        setShowSettings(false);
      }
    };
    if (showProfileModal) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showProfileModal]);

  // ── auto-grow textarea ──
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [inputValue]);

  // ── fetch projects ──
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await axiosInstance.get<Project[]>("/projects");
        setProjects(Array.isArray(res.data) ? res.data : []);
      } catch (error: any) {
        toast.error(error?.response?.data?.message || "Failed to load projects");
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  // ── create project ──
  // ??$$$ Modified to support agentic project creation
  const handleCreateProject = async (description: string, isAgentic = false) => {
    if (isCreating) return;
    const trimmed = description.trim();
    if (!trimmed) { toast.error("Project name is required"); return; }
    try {
      setIsCreating(true);
      const res = await axiosInstance.post<{ projectId: string }>("/project", {
        description: trimmed,
        isAgentic
      });
      navigate(`/project/${res.data.projectId}/ideation`);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || error?.response?.data?.message || "Failed to create project");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSubmitInput = () => {
    if (inputValue.trim()) {
      handleCreateProject(inputValue, false);
    }
  };

  // ??$$$ Added agentic submit handler
  const handleSubmitAgenticInput = () => {
    if (inputValue.trim()) {
      setDiscoveryIdea(inputValue.trim());
      setShowDiscoveryModal(true);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmitInput();
    }
  };

  // ── edit project ──
  const handleEditProject = async (project: Project) => {
    const next = window.prompt("Update project name", project.description);
    if (!next || next.trim() === project.description) return;
    try {
      await axiosInstance.put(`/project/${project._id}`, { description: next.trim() });
      setProjects((prev) => prev.map((p) => p._id === project._id ? { ...p, description: next.trim() } : p));
      toast.success("Project updated");
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to update project");
    }
  };

  // ── delete project ──
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

  // ── logout ──
  const handleLogout = async () => {
    await logout();
    navigate("/auth");
  };

  // ── save settings ──
  const handleSaveSettings = async () => {
    if (settingsForm.newPassword && settingsForm.newPassword !== settingsForm.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    try {
      setIsSavingSettings(true);
      const payload: any = { fullName: settingsForm.fullName, email: settingsForm.email };
      if (settingsForm.newPassword) payload.newPassword = settingsForm.newPassword;
      await updateUser(payload);
      setShowSettings(false);
      setShowProfileModal(false);
      toast.success("Account updated");
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to update account");
    } finally {
      setIsSavingSettings(false);
    }
  };

  // ─── Shared class helpers ─────────────────────────────────────────────────

  const inputCls = `w-full rounded-lg px-3 py-2 text-sm outline-none border transition ${
    isDark
      ? "bg-[#1a1a1a] border-white/10 text-[#e5e5e5] placeholder:text-white/25 focus:border-white/25"
      : "bg-white border-black/10 text-[#111] placeholder:text-black/30 focus:border-black/25"
  }`;

  const labelCls = `text-xs font-medium block mb-1 ${isDark ? "text-[#777]" : "text-[#777]"}`;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0f0f0f] text-[#f0f0f0]" : "bg-[#f4f1e8] text-[#191919]"}`}>

      {/* ── Topbar ─────────────────────────────────────────────────────────── */}
      <header className={`sticky top-0 z-50 border-b ${
        isDark
          ? "bg-[#0f0f0f]/95 border-white/[0.07] backdrop-blur-xl"
          : "bg-[#f4f1e8]/95 border-black/[0.08] backdrop-blur-xl"
      }`}>
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">

          {/* Logo */}
          <img src={forgeLogo} alt="Forge" className="h-9 w-auto object-contain" />

          {/* Right controls */}
          <div className="flex items-center gap-2">

            {/* Test Simulator */}
            <button
              onClick={() => navigate("/test-simulator")}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                isDark
                  ? "border-white/10 text-[#999] hover:border-white/20 hover:text-[#ccc]"
                  : "border-black/10 text-[#666] hover:border-black/20 hover:text-[#333]"
              }`}
            >
              Test Simulator
            </button>

            {/* Profile avatar + dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => { setShowProfileModal((v) => !v); setShowSettings(false); }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d9a441] font-bold text-black text-xs transition hover:opacity-85"
                title={authUser?.fullName || "Profile"}
                aria-label="Open profile menu"
              >
                {authUser?.fullName?.charAt(0).toUpperCase() || "U"}
              </button>

              {/* Dropdown */}
              <AnimatePresence>
                {showProfileModal && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0,  scale: 1    }}
                    exit   ={{ opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ duration: 0.13 }}
                    className={`absolute right-0 top-10 w-60 rounded-xl border shadow-2xl z-50 overflow-hidden ${
                      isDark
                        ? "bg-[#181818] border-white/10"
                        : "bg-white border-black/10"
                    }`}
                  >
                    {!showSettings ? (
                      <>
                        {/* Profile header */}
                        <div className={`flex items-center gap-3 px-4 py-3.5 border-b ${isDark ? "border-white/[0.07]" : "border-black/[0.07]"}`}>
                          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#d9a441] font-bold text-black text-xs">
                            {authUser?.fullName?.charAt(0).toUpperCase() || "U"}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold leading-tight">{authUser?.fullName}</p>
                            <p className={`truncate text-xs mt-0.5 ${isDark ? "text-[#666]" : "text-[#888]"}`}>{authUser?.email}</p>
                          </div>
                        </div>

                        {/* Menu */}
                        <div className="p-1.5 space-y-0.5">
                          <DropdownItem label="Manage account" onClick={() => setShowSettings(true)} isDark={isDark} />
                          <DropdownItem label={isDark ? "Switch to light mode" : "Switch to dark mode"} onClick={() => { toggleTheme(); setShowProfileModal(false); }} isDark={isDark} />
                          <div className={`my-1 border-t ${isDark ? "border-white/[0.07]" : "border-black/[0.07]"}`} />
                          <DropdownItem label="Log out" onClick={handleLogout} isDark={isDark} danger />
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Settings header */}
                        <div className={`flex items-center gap-3 px-4 py-3 border-b ${isDark ? "border-white/[0.07]" : "border-black/[0.07]"}`}>
                          <button
                            onClick={() => setShowSettings(false)}
                            className={`text-xs transition ${isDark ? "text-[#666] hover:text-[#bbb]" : "text-[#aaa] hover:text-[#444]"}`}
                          >
                            ←
                          </button>
                          <span className="text-sm font-semibold">Account settings</span>
                        </div>

                        {/* Form */}
                        <div className="p-4 space-y-3">
                          <div>
                            <label className={labelCls}>Full name</label>
                            <input type="text" value={settingsForm.fullName}
                              onChange={(e) => setSettingsForm({ ...settingsForm, fullName: e.target.value })}
                              className={inputCls} />
                          </div>
                          <div>
                            <label className={labelCls}>Email</label>
                            <input type="email" value={settingsForm.email}
                              onChange={(e) => setSettingsForm({ ...settingsForm, email: e.target.value })}
                              className={inputCls} />
                          </div>
                          <div>
                            <label className={labelCls}>New password</label>
                            <input type="password" value={settingsForm.newPassword}
                              placeholder="Leave blank to keep current"
                              onChange={(e) => setSettingsForm({ ...settingsForm, newPassword: e.target.value })}
                              className={inputCls} />
                          </div>
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
                            className="w-full rounded-lg bg-[#d9a441] py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isSavingSettings ? "Saving…" : "Save changes"}
                          </button>
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">

        {/* Hero + prompt */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0  }}
          transition={{ duration: 0.25 }}
          className={`rounded-2xl border px-7 py-7 ${
            isDark
              ? "border-white/[0.08] bg-[#161616]"
              : "border-black/[0.08] bg-white"
          }`}
        >
          {/* Header row */}
          <div className="mb-5">
            <p className={`text-[10px] font-semibold uppercase tracking-[0.22em] mb-1.5 ${isDark ? "text-[#555]" : "text-[#aaa]"}`}>
              Workspace
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              {authUser?.fullName
                ? `Welcome back, ${authUser.fullName.split(" ")[0]}.`
                : "Welcome."}
            </h1>
            <p className={`mt-1 text-sm ${isDark ? "text-[#666]" : "text-[#999]"}`}>
              Describe a hardware project and press Enter to begin.
            </p>
          </div>

          {/* Prompt input */}
          <div className={`flex items-end gap-2 rounded-xl border px-4 py-3 transition-colors ${
            isDark
              ? "border-white/10 bg-[#0f0f0f] focus-within:border-[#d9a441]/60"
              : "border-black/10 bg-[#f9f7f1] focus-within:border-[#d9a441]/70"
          }`}>
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Smart garden monitor with ESP32 and soil moisture sensor"
              disabled={isCreating}
              className={`flex-1 resize-none bg-transparent text-sm outline-none leading-relaxed ${
                isDark
                  ? "text-[#f0f0f0] placeholder:text-[#444]"
                  : "text-[#191919] placeholder:text-[#bbb]"
              } disabled:opacity-50`}
              style={{ minHeight: "24px", maxHeight: "160px" }}
            />
            <button
              onClick={handleSubmitInput}
              disabled={isCreating || !inputValue.trim()}
              className={`flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold transition ${
                inputValue.trim() && !isCreating
                  ? "bg-[#d9a441] text-black hover:opacity-90"
                  : isDark
                  ? "bg-white/5 text-[#444] cursor-not-allowed"
                  : "bg-black/5 text-[#bbb] cursor-not-allowed"
              }`}
              aria-label="Create project"
            >
              {isCreating ? (
                <span className="block h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
              ) : (
                "↑"
              )}
            </button>
            {/* ??$$$ Added 2nd button for experimental agentic creation */}
            <button
              onClick={handleSubmitAgenticInput}
              disabled={isCreating || !inputValue.trim()}
              className={`flex-shrink-0 flex h-8 px-3.5 items-center justify-center rounded-lg text-xs font-bold transition ${
                inputValue.trim() && !isCreating
                  ? "bg-emerald-500 text-zinc-950 hover:bg-emerald-450 shadow-[0_0_12px_rgba(16,185,129,0.2)] hover:shadow-[0_0_16px_rgba(16,185,129,0.35)]"
                  : isDark
                  ? "bg-white/5 text-[#444] cursor-not-allowed"
                  : "bg-black/5 text-[#bbb] cursor-not-allowed"
              }`}
              aria-label="Create project agentic"
            >
              {isCreating ? (
                <span className="block h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
              ) : (
                "✦ AI Build"
              )}
            </button>
          </div>

          <p className={`mt-2.5 text-xs ${isDark ? "text-[#444]" : "text-[#bbb]"}`}>
            Press <kbd className={`rounded px-1 py-0.5 text-[10px] font-mono ${isDark ? "bg-white/5 text-[#666]" : "bg-black/5 text-[#999]"}`}>Enter</kbd> to start &nbsp;·&nbsp; Shift+Enter for a new line
          </p>
        </motion.section>

        {/* ── Projects section ──────────────────────────────────────────────── */}
        <section className="mt-10">

          {/* Section header */}
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Recent projects</h2>
              <p className={`mt-0.5 text-xs ${isDark ? "text-[#555]" : "text-[#aaa]"}`}>
                {loading ? "Loading…" : `${projects.length} ${projects.length === 1 ? "project" : "projects"}`}
              </p>
            </div>

            {/* Fallback create button */}
            <button
              onClick={() => {
                const d = window.prompt("Name your project");
                if (d?.trim()) handleCreateProject(d.trim());
              }}
              disabled={isCreating}
              className={`rounded-lg border px-3.5 py-2 text-xs font-semibold transition ${
                isDark
                  ? "border-white/10 bg-white/5 hover:bg-white/10 text-[#ccc]"
                  : "border-black/10 bg-white hover:bg-black/5 text-[#444]"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              + New project
            </button>
          </div>

          {/* Loading skeleton */}
          {loading && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className={`h-36 rounded-2xl border animate-pulse ${
                    isDark ? "border-white/[0.06] bg-[#161616]" : "border-black/[0.06] bg-white"
                  }`}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && projects.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`rounded-2xl border border-dashed p-12 text-center ${
                isDark ? "border-white/[0.08]" : "border-black/[0.08]"
              }`}
            >
              <p className="text-sm font-semibold">No projects yet</p>
              <p className={`mt-1.5 text-xs ${isDark ? "text-[#555]" : "text-[#aaa]"}`}>
                Use the input above to describe your first project.
              </p>
            </motion.div>
          )}

          {/* Projects grid */}
          {!loading && projects.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {projects.map((project, i) => (
                <motion.div
                  key={project._id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: i * 0.035 }}
                  className={`group relative flex flex-col rounded-2xl border transition-all ${
                    isDark
                      ? "border-white/[0.08] bg-[#161616] hover:border-white/[0.14] hover:bg-[#1c1c1c]"
                      : "border-black/[0.08] bg-white hover:border-black/[0.14] hover:shadow-sm"
                  }`}
                >
                  {/* Accent line on hover */}
                  <div className={`absolute left-0 top-4 bottom-4 w-[2px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-[#d9a441]`} />

                  {/* Card body — clickable to open */}
                  <button
                    onClick={() => navigate(`/project/${project._id}/ideation`)}
                    className="flex-1 text-left px-5 pt-5 pb-4"
                  >
                    <h3 className={`text-sm font-semibold leading-snug ${isDark ? "text-[#f0f0f0]" : "text-[#191919]"}`}>
                      {project.description}
                    </h3>
                    <p className={`mt-2 text-xs ${isDark ? "text-[#484848]" : "text-[#bbb]"}`}>
                      {new Date(project.createdAt).toLocaleDateString(undefined, {
                        year: "numeric", month: "short", day: "numeric",
                      })}
                    </p>
                  </button>

                  {/* Card footer */}
                  <div className={`flex flex-col gap-1.5 px-4 pb-4 pt-3 border-t ${
                    isDark ? "border-white/[0.06]" : "border-black/[0.06]"
                  }`}>
                    <div className="flex items-center gap-1.5">
                      {/* Open — primary */}
                      <button
                        onClick={() => navigate(`/project/${project._id}/ideation`)}
                        className="flex-1 rounded-lg bg-[#d9a441] py-1.5 text-xs font-bold text-black transition hover:opacity-90"
                      >
                        Open
                      </button>

                      {/* Rename */}
                      <button
                        onClick={() => handleEditProject(project)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                          isDark
                            ? "border-white/[0.08] text-[#888] hover:text-[#ccc] hover:border-white/20"
                            : "border-black/[0.08] text-[#999] hover:text-[#444] hover:border-black/20"
                        }`}
                      >
                        Rename
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDeleteProject(project)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                          isDark
                            ? "border-red-900/40 text-red-500/70 hover:border-red-500/40 hover:text-red-400"
                            : "border-red-100 text-red-400 hover:border-red-300 hover:text-red-500"
                        }`}
                      >
                        Delete
                      </button>
                    </div>

                    {/* ??$$$ NEW FLOW */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setDiscoveryProjectId(project._id);
                          setDiscoveryPhase(1);
                          setShowDiscoveryModal(true);
                        }}
                        className={`flex-1 flex items-center justify-center gap-1 rounded-lg border py-1.5 text-[10px] font-semibold transition ${
                          isDark
                            ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/50"
                            : "border-emerald-500/30 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:border-emerald-500/50"
                        }`}
                      >
                        ✦ AI Discovery
                      </button>

                      <button
                        onClick={() => {
                          setDiscoveryProjectId(project._id);
                          setDiscoveryPhase(2);
                          setShowDiscoveryModal(true);
                        }}
                        className={`flex-1 flex items-center justify-center gap-1 rounded-lg border py-1.5 text-[10px] font-semibold transition ${
                          isDark
                            ? "border-blue-500/30 bg-blue-500/5 text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/50"
                            : "border-blue-500/30 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:border-blue-500/50"
                        }`}
                      >
                        ✦ AI Formulation
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* ??$$$ NEW FLOW */}
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

// ─── Dropdown item ────────────────────────────────────────────────────────────

function DropdownItem({
  label, onClick, isDark, danger = false,
}: {
  label: string; onClick: () => void; isDark: boolean; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-lg px-3 py-2 text-left text-xs font-medium transition ${
        danger
          ? isDark
            ? "text-red-500 hover:bg-red-500/10"
            : "text-red-500 hover:bg-red-50"
          : isDark
          ? "text-[#ccc] hover:bg-white/[0.07]"
          : "text-[#333] hover:bg-black/[0.05]"
      }`}
    >
      {label}
    </button>
  );
}