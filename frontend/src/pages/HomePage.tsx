//this file is inspected and needs to be re inspected once complete traversal is done
//ui is trash for mobile atleast, change later

import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeStore } from "../store/useThemeStore";
import { DiscoveryModal } from "../components/DiscoveryModal/DiscoveryModal";

type Project = { _id: string; description: string; createdAt: string };
type SettingsForm = { fullName: string; email: string; newPassword: string; confirmPassword: string };

// ── Sidebar project row ───────────────────────────────────────────────────────
function ProjectRow({
  project, dark, onDiscovery, onFormulation, onOpen, onEdit, onDelete, isActive, onClick,
}: {
  project: Project; dark: boolean;
  onDiscovery: () => void; onFormulation: () => void;
  onOpen: () => void; onEdit: () => void; onDelete: () => void;
  isActive: boolean; onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`group flex flex-col px-3 py-3.5 cursor-pointer transition-colors rounded-xl ${
        isActive
          ? dark ? "bg-[#26282d]/40" : "bg-slate-100"
          : dark ? "hover:bg-[#26282d]/20" : "hover:bg-slate-50"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <span className={`text-[13px] font-medium leading-snug line-clamp-2 ${dark ? "text-[#f5f5f5]" : "text-slate-800"}`}>
          {project.description}
        </span>
        
        {/* Quick actions on hover */}
        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 pt-0.5">
          <button onClick={e => { e.stopPropagation(); onOpen(); }} title="Open" className={`transition-colors ${dark ? "text-[#8b8b95] hover:text-[#4f7cff]" : "text-slate-400 hover:text-blue-600"}`}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
          <button onClick={e => { e.stopPropagation(); onEdit(); }} title="Rename" className={`transition-colors ${dark ? "text-[#8b8b95] hover:text-[#4f7cff]" : "text-slate-400 hover:text-blue-600"}`}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(); }} title="Delete" className={`transition-colors ${dark ? "text-[#8b8b95] hover:text-red-400" : "text-slate-400 hover:text-red-500"}`}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onDiscovery(); }}
          className={`flex-1 rounded-lg border py-1.5 text-[11px] font-medium transition-colors ${
            dark
              ? "border-[#26282d] text-[#8b8b95] hover:bg-[#26282d]/50 hover:text-[#f5f5f5]"
              : "border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          }`}
        >
          Discovery
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onFormulation(); }}
          className={`flex-1 rounded-lg border py-1.5 text-[11px] font-medium transition-colors ${
            dark
              ? "border-[#26282d] text-[#8b8b95] hover:bg-[#26282d]/50 hover:text-[#f5f5f5]"
              : "border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          }`}
        >
          Formulation
        </button>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const navigate = useNavigate();
  const { authUser, logout, updateUser } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const dark = theme === "dark";

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

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
    fullName: authUser?.fullName || "", email: authUser?.email || "", newPassword: "", confirmPassword: "",
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  useEffect(() => {
    setSettingsForm({ fullName: authUser?.fullName || "", email: authUser?.email || "", newPassword: "", confirmPassword: "" });
  }, [authUser]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false); setShowSettings(false);
      }
    };
    if (showProfileMenu) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showProfileMenu]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 140), 180)}px`;
  }, [inputValue]);

  useEffect(() => {
    (async () => {
      try {
        const res = await axiosInstance.get<Project[]>("/projects");
        setProjects(Array.isArray(res.data) ? res.data : []);
      } catch (e: any) {
        toast.error(e?.response?.data?.message || "Failed to load projects");
      } finally { setLoading(false); }
    })();
  }, []);

  const handleSubmitAgenticInput = () => {
    if (inputValue.trim()) { setDiscoveryIdea(inputValue.trim()); setShowDiscoveryModal(true); }
  };

  const handleEditProject = async (project: Project) => {
    const next = window.prompt("Rename project", project.description);
    if (!next || next.trim() === project.description) return;
    try {
      await axiosInstance.put(`/project/${project._id}`, { description: next.trim() });
      setProjects(prev => prev.map(p => p._id === project._id ? { ...p, description: next.trim() } : p));
      toast.success("Project renamed");
    } catch (e: any) { toast.error(e?.response?.data?.error || "Failed to rename"); }
  };

  const handleDeleteProject = async (project: Project) => {
    if (!window.confirm(`Delete "${project.description}"?`)) return;
    try {
      await axiosInstance.delete(`/project/${project._id}`);
      setProjects(prev => prev.filter(p => p._id !== project._id));
      if (activeProjectId === project._id) setActiveProjectId(null);
      toast.success("Deleted");
    } catch (e: any) { toast.error(e?.response?.data?.error || "Failed to delete"); }
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
    } catch (e: any) { toast.error(e?.response?.data?.error || "Failed to update");
    } finally { setIsSavingSettings(false); }
  };

  const initial = authUser?.fullName?.charAt(0).toUpperCase() || "U";

  // theme tokens
  const bg = dark ? "bg-[#0f0f11]" : "bg-white";
  const sidebarBg = dark ? "bg-[#141518]" : "bg-[#fcfcfc]";
  const borderCol = dark ? "border-[#26282d]" : "border-slate-200";
  const textHead = dark ? "text-[#f5f5f5]" : "text-slate-900";
  const textSub = dark ? "text-[#8b8b95]" : "text-slate-500";
  const accentText = dark ? "text-[#4f7cff]" : "text-blue-600";
  const accentBg = dark ? "bg-[#4f7cff]" : "bg-blue-600";

  const inputCls = `w-full rounded-md px-3 py-2 text-sm outline-none border transition ${
    dark
      ? "bg-[#0f0f11] border-[#26282d] text-[#f5f5f5] placeholder:text-[#8b8b95] focus:border-[#4f7cff]"
      : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-500"
  }`;

  return (
    <div className={`flex h-screen overflow-hidden ${bg}`} style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className={`relative z-10 flex w-72 flex-shrink-0 flex-col border-r ${sidebarBg} ${borderCol}`}>

        {/* Logo */}
        <div className={`px-5 py-5 flex items-center gap-3`}>
          <div className={`flex h-6 w-6 items-center justify-center rounded-md ${dark ? "bg-[#26282d]" : "bg-slate-200"}`}>
            <svg className={`h-3 w-3 ${textHead}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <p className={`text-sm font-medium ${textHead}`}>Wireup</p>
        </div>

        {/* Project list */}
        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5 mt-2">
          {loading && (
            <div className="space-y-3 px-3 pt-1">
              {[1, 2, 3].map(n => (
                <div key={n} className={`h-24 rounded-xl animate-pulse ${dark ? "bg-[#26282d]/50" : "bg-slate-100"}`} />
              ))}
            </div>
          )}

          {!loading && projects.length === 0 && (
            <div className="px-4 pt-4 text-left">
              <p className={`text-xs ${textSub}`}>No projects yet.</p>
            </div>
          )}

          {!loading && projects.map(project => (
            <ProjectRow
              key={project._id}
              project={project}
              dark={dark}
              isActive={activeProjectId === project._id}
              onClick={() => setActiveProjectId(project._id === activeProjectId ? null : project._id)}
              onOpen={() => navigate(`/project/${project._id}/ideation`)}
              onDiscovery={() => {
                setDiscoveryProjectId(project._id);
                setDiscoveryPhase(1);
                setShowDiscoveryModal(true);
              }}
              onFormulation={() => {
                setDiscoveryProjectId(project._id);
                setDiscoveryPhase(2);
                setShowDiscoveryModal(true);
              }}
              onEdit={() => handleEditProject(project)}
              onDelete={() => handleDeleteProject(project)}
            />
          ))}
        </div>

        {/* Profile */}
        <div className={`p-3 border-t ${borderCol}`} ref={profileRef}>
          <button
            onClick={() => { setShowProfileMenu(v => !v); setShowSettings(false); }}
            className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors ${
              dark ? "hover:bg-[#26282d]" : "hover:bg-slate-100"
            }`}
          >
            <div className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-medium ${dark ? "bg-[#26282d] text-[#f5f5f5]" : "bg-slate-200 text-slate-800"}`}>
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-xs font-medium truncate ${textHead}`}>{authUser?.fullName || "User"}</p>
            </div>
          </button>

          {/* profile popup */}
          {showProfileMenu && (
            <div className={`absolute bottom-16 left-3 right-3 rounded-lg border shadow-lg overflow-hidden z-50 ${
              dark ? "bg-[#141518] border-[#26282d]" : "bg-white border-slate-200"
            }`}>
              {!showSettings ? (
                <div className="p-1.5 space-y-0.5">
                  {[
                    { label: "Account settings", action: () => setShowSettings(true) },
                    { label: `${dark ? "Light" : "Dark"} mode`, action: () => { toggleTheme(); setShowProfileMenu(false); } },
                  ].map(({ label, action }) => (
                    <button key={label} onClick={action}
                      className={`w-full rounded-md px-3 py-2 text-left text-xs font-medium transition-colors ${
                        dark ? "text-[#f5f5f5] hover:bg-[#26282d]" : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >{label}</button>
                  ))}
                  <div className={`my-1 border-t ${borderCol}`} />
                  <button onClick={handleLogout}
                    className={`w-full rounded-md px-3 py-2 text-left text-xs font-medium transition-colors ${
                      dark ? "text-red-400 hover:bg-[#26282d]" : "text-red-500 hover:bg-slate-100"
                    }`}
                  >Logout</button>
                </div>
              ) : (
                <>
                  <div className={`flex items-center gap-2 px-3 py-2 border-b ${borderCol}`}>
                    <button onClick={() => setShowSettings(false)}
                      className={`flex h-5 w-5 items-center justify-center rounded transition-colors ${
                        dark ? "text-[#8b8b95] hover:bg-[#26282d]" : "text-slate-400 hover:bg-slate-100"
                      }`}>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className={`text-xs font-medium ${textHead}`}>Settings</span>
                  </div>
                  <div className="p-3 space-y-3">
                    {[
                      { label: "Full name", type: "text",     key: "fullName",    val: settingsForm.fullName },
                      { label: "Email",     type: "email",    key: "email",       val: settingsForm.email },
                      { label: "Password",  type: "password", key: "newPassword", val: settingsForm.newPassword, ph: "Leave blank to keep" },
                    ].map(({ label, type, key, val, ph }) => (
                      <div key={key}>
                        <label className={`text-[10px] block mb-1 ${textSub}`}>{label}</label>
                        <input type={type} value={val} placeholder={ph}
                          onChange={e => setSettingsForm({ ...settingsForm, [key]: e.target.value })}
                          className={inputCls} />
                      </div>
                    ))}
                    {settingsForm.newPassword && (
                      <div>
                        <label className={`text-[10px] block mb-1 ${textSub}`}>Confirm Password</label>
                        <input type="password" value={settingsForm.confirmPassword}
                          onChange={e => setSettingsForm({ ...settingsForm, confirmPassword: e.target.value })}
                          className={inputCls} />
                      </div>
                    )}
                    <button onClick={handleSaveSettings} disabled={isSavingSettings}
                      className={`w-full rounded-md py-2 text-xs font-medium text-white transition mt-2 ${accentBg} hover:opacity-90 disabled:opacity-50`}>
                      {isSavingSettings ? "Saving…" : "Save changes"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex flex-1 flex-col overflow-hidden">

        {/* minimal top bar */}
        

        {/* centred hero */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          <div className="flex-1 flex flex-col items-center justify-center px-4 md:px-8 py-12">
            <div className="w-full max-w-3xl flex flex-col items-center">

              {/* heading */}
              <h1 className={`text-4xl md:text-5xl font-normal tracking-tight mb-10 text-center ${textHead}`} style={{ fontFamily: "Georgia, 'Playfair Display', serif" }}>
                What can I do for you?
              </h1>

              {/* input box */}
              <div className={`w-full rounded-2xl border flex flex-col transition-all ${
                dark ? "bg-[#141518] border-[#26282d] focus-within:border-[#4f7cff]/50" : "bg-white border-slate-200 focus-within:border-blue-300"
              }`}>
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmitAgenticInput(); } }}
                  placeholder="Ask anything..."
                  disabled={isCreating}
                  className={`w-full resize-none bg-transparent px-5 pt-5 pb-2 outline-none text-base disabled:opacity-50 ${
                    dark ? "text-[#f5f5f5] placeholder:text-[#8b8b95]" : "text-slate-900 placeholder:text-slate-400"
                  }`}
                  style={{ minHeight: "140px", maxHeight: "300px" }}
                />

                <div className="flex items-center justify-between px-3 pb-3">
                  {/* action chips */}
                  <div className="flex flex-wrap gap-2">
                    {[
                      "Create Project",
                      "Discovery",
                      "Formulation",
                      "Simulator",
                      "More"
                    ].map(action => (
                      <button
                        key={action}
                        onClick={() => setInputValue(prev => prev ? `${prev} ${action}` : action)}
                        className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                          dark
                            ? "border-[#26282d] text-[#8b8b95] hover:bg-[#26282d] hover:text-[#f5f5f5]"
                            : "border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        {action}
                      </button>
                    ))}
                  </div>

                  {/* submit button */}
                  <button
                    onClick={handleSubmitAgenticInput}
                    disabled={isCreating || !inputValue.trim()}
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-all ${
                      inputValue.trim() && !isCreating
                        ? `${accentBg} text-white hover:opacity-90`
                        : dark ? "bg-[#26282d] text-[#8b8b95] cursor-not-allowed" : "bg-slate-100 text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    {isCreating ? (
                      <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>

      {/* Discovery modal */}
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