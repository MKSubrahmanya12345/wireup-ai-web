// ??$$$ group 4 - Build & Firmware Compilation (Phase 3)
// ??$$$ NEW FLOW
import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { useProjectStore, Milestone } from "../store/useProjectStore";
import WokwiSimulator from "../components/WokwiSimulator";
import {
  ArrowLeft, Cpu, Code, Terminal, MessageSquare, Play, RefreshCw, CheckCircle2,
  Lock, AlertTriangle, AlertCircle, Sparkles, HelpCircle, HardDrive, PlayCircle,
  // ??$$$ newer code
  Folder, File, ChevronDown, ChevronRight, Settings, Keyboard, Activity
} from "lucide-react";
import toast from "react-hot-toast";

export default function BuildNewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    project, isLoading, error, loadProject, loadMilestones, updateMilestone,
    compileMilestone, confirmMilestone, failMilestone, skipMilestone,
    chatDebugCoach, regenerateMilestoneCode, reportComponentIssue, validateSerial
  } = useProjectStore();

  const [activeMilestoneId, setActiveMilestoneId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"code" | "simulator" | "coach">("code");
  const [localCode, setLocalCode] = useState("");
  const [serialInput, setSerialInput] = useState("");
  const [notes, setNotes] = useState("");
  const [compiling, setCompiling] = useState(false);
  const [compilationSuccess, setCompilationSuccess] = useState<boolean | null>(null);
  const [compilationConsole, setCompilationConsole] = useState<string>("");
  const [chatMessage, setChatMessage] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // Issue modal state
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueComponent, setIssueComponent] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [reportingIssue, setReportingIssue] = useState(false);

  // ??$$$ newer code
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const saveTimer = useRef<any>(null);

  // Load project on mount
  useEffect(() => {
    if (id) {
      loadProject(id);
      loadMilestones(id);
    }
  }, [id]);

  // Set active milestone
  useEffect(() => {
    if (project?.milestones && project.milestones.length > 0) {
      if (project.activeMilestoneId) {
        setActiveMilestoneId(project.activeMilestoneId);
      } else if (!activeMilestoneId) {
        setActiveMilestoneId(project.milestones[0].id);
      }
    }
  }, [project?.activeMilestoneId, project?.milestones]);

  // Selected Milestone
  const milestone = project?.milestones?.find(m => m.id === activeMilestoneId) || project?.milestones?.[0];

  // Sync local code state on milestone change
  useEffect(() => {
    if (milestone) {
      setLocalCode(milestone.code || "");
      setSerialInput(milestone.serialOutput || "");
      setCompilationConsole(milestone.compilationErrors?.join("\n") || "");
      setCompilationSuccess(milestone.compiledHex ? true : null);
    }
  }, [milestone?.id]);

  // Handle local code editing with auto-save
  const handleCodeChange = (val: string) => {
    setLocalCode(val);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (milestone && id) {
        await updateMilestone(id, milestone.id, { code: val });
      }
    }, 1000);
  };

  // Compile Sketch
  const handleCompile = async () => {
    if (!id || !milestone) return;
    setCompiling(true);
    setCompilationConsole("Initializing build context...\nRunning arduino-cli compile...");
    try {
      const res = await compileMilestone(id, milestone.id);
      if (res.success) {
        setCompilationSuccess(true);
        setCompilationConsole("✓ Compilation successful!\nHex binary generated.\nReady for simulator.");
        toast.success("Firmware compiled successfully!");
      } else {
        setCompilationSuccess(false);
        const errs = res.errors?.join("\n") || "Unknown error during compilation.";
        setCompilationConsole(`Compilation failed:\n${errs}`);
        toast.error("Compilation failed.");
      }
    } catch (err) {
      setCompilationSuccess(false);
      setCompilationConsole("Internal compile trigger error.");
    } finally {
      setCompiling(false);
    }
  };

  // Confirm Milestone
  const handleConfirm = async () => {
    if (!id || !milestone) return;
    try {
      await confirmMilestone(id, milestone.id, serialInput, notes);
      toast.success("Milestone confirmed and marked complete!");
      setNotes("");
    } catch (err) {
      toast.error("Failed to confirm milestone.");
    }
  };

  // Skip Milestone
  const handleSkip = async () => {
    if (!id || !milestone) return;
    try {
      await skipMilestone(id, milestone.id, notes || "Bypassed by user request.");
      toast.success("Milestone unlocked.");
    } catch (err) {
      toast.error("Failed to skip milestone.");
    }
  };

  // Send message to Debug Coach
  const handleSendChatMessage = async () => {
    if (!id || !milestone || !chatMessage.trim()) return;
    setChatLoading(true);
    const msg = chatMessage;
    setChatMessage("");
    try {
      await chatDebugCoach(id, milestone.id, msg);
    } catch (err) {
      toast.error("Coach failing to respond.");
    } finally {
      setChatLoading(false);
    }
  };

  // Trigger Debug Coach code regeneration
  const handleRegenCode = async () => {
    if (!id || !milestone) return;
    const ok = window.confirm("Are you sure you want the AI Coach to update your sketch code?");
    if (!ok) return;
    setCompiling(true);
    try {
      await regenerateMilestoneCode(id, milestone.id);
      toast.success("Sketch updated by Debug Coach.");
    } catch (err) {
      toast.error("Failed to regenerate sketch code.");
    } finally {
      setCompiling(false);
    }
  };

  // Report hardware issue
  const handleReportIssue = async () => {
    if (!id || !milestone || !issueComponent || !issueDescription.trim()) return;
    setReportingIssue(true);
    try {
      await reportComponentIssue(id, milestone.id, issueComponent, issueDescription);
      toast.success("Hardware issue reported to Debug Coach!");
      setShowIssueModal(false);
      setIssueComponent("");
      setIssueDescription("");
      setActiveTab("coach");
    } catch (err) {
      toast.error("Failed to report issue.");
    } finally {
      setReportingIssue(false);
    }
  };

  if (isLoading && !project) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-100">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
          <p className="text-sm text-zinc-400">Loading autonomous workspace...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-zinc-950 text-zinc-100 gap-4">
        <AlertTriangle className="h-10 w-10 text-red-500" />
        <p className="text-sm text-zinc-400">{error || "Project workspace not found."}</p>
        <button onClick={() => navigate("/home")} className="rounded-lg bg-zinc-800 px-4 py-2 text-xs font-semibold hover:bg-zinc-700">
          Return Home
        </button>
      </div>
    );
  }

  // ??$$$ newer code
  return (
    <div className="flex h-screen flex-col bg-[#1e1e1e] font-mono text-zinc-300 antialiased overflow-hidden select-none">
      
      {/* VSCode Title Bar / Header */}
      <header className="flex h-9 items-center justify-between border-b border-[#2d2d2d] bg-[#2d2d2d] px-3 text-[11px] text-zinc-400 select-none">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/home")}
            className="flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-center gap-1.5 font-bold">
            <span className="text-[#007acc]">WIREUP IDE</span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-300 font-normal truncate max-w-xs md:max-w-md">
              {project.description || "Autonomous Project Space"}
            </span>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-[10px] text-zinc-300">Live Node Connected</span>
          </div>
        </div>
      </header>

      {/* Main VSCode Layout Workspace */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* VSCode Left Activity Bar */}
        <div className="w-12 shrink-0 bg-[#333333] border-r border-[#252526] flex flex-col justify-between items-center py-2 z-10">
          <div className="flex flex-col gap-4 w-full items-center">
            
            {/* File Explorer icon */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`relative p-2 rounded text-zinc-400 hover:text-white transition-colors ${
                sidebarOpen ? "text-white bg-[#252526]" : ""
              }`}
            >
              <Folder className="w-5 h-5" />
              {sidebarOpen && (
                <div className="absolute left-0 top-2 bottom-2 w-[2px] bg-[#007acc]" />
              )}
            </button>
          </div>

          <div className="flex flex-col gap-3 items-center">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 text-zinc-500 hover:text-white"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Left Milestones Sidebar (Explorer panel style) */}
        {sidebarOpen && (
          <aside className="w-64 shrink-0 bg-[#252526] border-r border-[#2d2d2d] flex flex-col overflow-hidden text-zinc-400">
            <div className="h-9 flex items-center justify-between px-3 text-[10px] uppercase font-bold tracking-wider text-zinc-500 border-b border-[#2d2d2d]">
              <span>Milestone Curriculum</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-1 select-text">
              {project.milestones?.map((m, idx) => {
                const isActive = m.id === activeMilestoneId;
                const isLocked = m.status === "locked";
                const isPassed = m.status === "passed" || m.userConfirmed;
                
                return (
                  <button
                    key={m.id}
                    disabled={isLocked && !isActive}
                    onClick={() => setActiveMilestoneId(m.id)}
                    className={`w-full rounded border text-left px-2.5 py-2 transition-all flex items-start gap-2 relative overflow-hidden ${
                      isActive
                        ? "border-[#007acc] bg-[#1e1e1e] text-white"
                        : isLocked
                        ? "border-transparent bg-transparent opacity-35 cursor-not-allowed"
                        : "border-transparent bg-transparent hover:bg-[#2d2d2d] text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {/* Status Indicator Icon */}
                    <div className={`h-4.5 w-4.5 rounded-full flex-shrink-0 text-[9px] font-bold flex items-center justify-center border ${
                      isPassed
                        ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-400"
                        : isActive
                        ? "bg-[#007acc]/10 border-[#007acc]/30 text-[#007acc]"
                        : "bg-[#2d2d2d] border-[#3c3c3c] text-zinc-500"
                    }`}>
                      {isPassed ? "✓" : idx + 1}
                    </div>

                    <div className="min-w-0 flex-1 leading-snug">
                      <div className="text-[10px] font-bold truncate flex items-center gap-1">
                        {m.title}
                        {isLocked && <Lock className="h-2.5 w-2.5 text-zinc-650 flex-shrink-0" />}
                      </div>
                      <div className="text-[9px] text-zinc-500 truncate mt-0.5">{m.objective}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>
        )}

        {/* Central Stage & Interactive Workspace */}
        {milestone ? (
          <div className="flex-1 flex overflow-hidden bg-[#1e1e1e]">
            
            {/* Center Area: Tabs & Active Panel */}
            <div className="flex-1 flex flex-col border-r border-[#2d2d2d] overflow-hidden">
              
              {/* Tab selector bar */}
              <div className="flex h-9 border-b border-[#1e1e1e] bg-[#2d2d2d] px-2 items-center justify-between shrink-0">
                <div className="flex items-center overflow-x-auto h-full">
                  <button
                    onClick={() => setActiveTab("code")}
                    className={`h-full flex items-center gap-1.5 px-4 border-r border-[#1e1e1e] text-[11px] transition-colors ${
                      activeTab === "code"
                        ? "bg-[#1e1e1e] text-white border-t-2 border-[#007acc] font-semibold"
                        : "bg-[#2d2d2d] text-zinc-500 hover:bg-[#2b2b2b] hover:text-zinc-350"
                    }`}
                  >
                    <Code className="h-3.5 w-3.5" />
                    <span>sketch.ino</span>
                  </button>
                  
                  <button
                    onClick={() => setActiveTab("simulator")}
                    className={`h-full flex items-center gap-1.5 px-4 border-r border-[#1e1e1e] text-[11px] transition-colors ${
                      activeTab === "simulator"
                        ? "bg-[#1e1e1e] text-white border-t-2 border-[#007acc] font-semibold"
                        : "bg-[#2d2d2d] text-zinc-500 hover:bg-[#2b2b2b] hover:text-zinc-350"
                    }`}
                  >
                    <PlayCircle className="h-3.5 w-3.5 text-emerald-400" />
                    <span>simulation.json</span>
                  </button>
                  
                  <button
                    onClick={() => setActiveTab("coach")}
                    className={`h-full flex items-center gap-1.5 px-4 border-r border-[#1e1e1e] text-[11px] transition-colors ${
                      activeTab === "coach"
                        ? "bg-[#1e1e1e] text-white border-t-2 border-[#007acc] font-semibold"
                        : "bg-[#2d2d2d] text-zinc-500 hover:bg-[#2b2b2b] hover:text-zinc-350"
                    }`}
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-amber-400" />
                    <span>coach_chat.log</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowIssueModal(true)}
                    className="flex items-center gap-1 rounded bg-[#333333] hover:bg-[#444444] border border-[#444444] text-[9px] text-zinc-300 px-2 py-0.5 transition-all"
                  >
                    Report Connection Issue
                  </button>
                </div>
              </div>

              {/* Milestone Sub-Header Meta */}
              <div className="p-4 border-b border-[#2d2d2d] bg-[#1a1a1a] space-y-3 shrink-0">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      Step {milestone.order} · {(milestone as any).subsystem || "Core"}
                    </span>
                    <h2 className="text-xs font-bold text-white mt-1.5">{milestone.title}</h2>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-[10px]">
                  <div className="space-y-1 bg-[#1e1e1e] p-2 rounded border border-[#2d2d2d]">
                    <div className="text-zinc-500 font-bold uppercase text-[9px]">Objective</div>
                    <p className="text-zinc-350 leading-normal">{milestone.objective}</p>
                  </div>
                  <div className="space-y-1 bg-[#1e1e1e] p-2 rounded border border-[#2d2d2d]">
                    <div className="text-zinc-500 font-bold uppercase text-[9px]">Target Components</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {milestone.componentsInvolved?.map((comp, idx) => (
                        <span key={idx} className="rounded bg-[#2d2d2d] px-1.5 py-0.5 text-[9px] text-zinc-300 border border-[#3c3c3c]">
                          {comp}
                        </span>
                      )) || <span className="text-zinc-650 italic">None</span>}
                    </div>
                  </div>
                </div>

                <div className="bg-[#1e1e1e] p-2.5 rounded border border-[#2d2d2d] text-[10px]">
                  <div className="text-zinc-500 font-bold uppercase text-[9px] mb-0.5">Wiring Schematics</div>
                  <p className="text-zinc-350 font-mono leading-relaxed whitespace-pre-wrap">{milestone.wiringInstructions}</p>
                </div>
              </div>

              {/* Active Tab Panel Body */}
              <div className="flex-1 flex flex-col overflow-hidden relative">
                
                {activeTab === "code" ? (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 relative overflow-hidden bg-black/20">
                      <Editor
                        height="100%"
                        defaultLanguage="cpp"
                        theme="vs-dark"
                        value={localCode}
                        onChange={(v) => handleCodeChange(v || "")}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 12,
                          lineNumbers: "on",
                          scrollbar: { vertical: "visible" },
                          tabSize: 2,
                          wordWrap: "on"
                        }}
                      />
                    </div>

                    {/* Integrated VSCode Build Console */}
                    <div className="h-44 border-t border-[#2d2d2d] bg-[#1e1e1e] flex flex-col overflow-hidden shrink-0">
                      <div className="flex h-8 items-center justify-between border-b border-[#2d2d2d] bg-[#2d2d2d] px-4 shrink-0 select-none">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                          <Terminal className="h-3 w-3 text-zinc-550" /> BUILD CONSOLE
                        </span>
                        
                        <button
                          onClick={handleCompile}
                          disabled={compiling}
                          className="flex items-center gap-1 rounded bg-[#007acc] px-2.5 py-0.5 text-[9px] font-bold text-white hover:bg-[#0062a3] transition-colors disabled:bg-[#333333] disabled:text-zinc-500"
                        >
                          {compiling ? (
                            <RefreshCw className="h-3 w-3 animate-spin text-white" />
                          ) : (
                            <Play className="h-3 w-3 text-white" />
                          )}
                          Verify & Compile Code
                        </button>
                      </div>
                      <div className="flex-1 p-3 font-mono text-[10px] text-[#85e89d] overflow-y-auto whitespace-pre-wrap leading-relaxed select-text bg-black">
                        {compilationConsole || "Build pipeline ready. Trigger code verify above..."}
                      </div>
                    </div>

                  </div>
                ) : activeTab === "simulator" ? (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {milestone.compiledHex ? (
                      <WokwiSimulator
                        hexCode={milestone.compiledHex}
                        diagramJson={project.diagram}
                        sketchCode={milestone.code}
                      />
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-zinc-500 bg-[#1e1e1e]">
                        <HardDrive className="h-8 w-8 text-zinc-700 mb-2" />
                        <h3 className="text-xs font-bold text-zinc-400">Simulation Uncompiled</h3>
                        <p className="text-[10px] text-zinc-600 mt-1 max-w-xs">
                          Trigger verification compile inside the sketch.ino tab first before starting simulator.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  
                  /* VSCode Debug Coach Chat interface (Monochromatic) */
                  <div className="flex-1 flex flex-col overflow-hidden bg-[#1e1e1e]">
                    <div className="flex h-8 items-center justify-between border-b border-[#2d2d2d] bg-[#2d2d2d] px-3 shrink-0 select-none">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                        <Sparkles className="h-3.5 w-3.5 text-amber-500" /> AI DEBUG COACH
                      </span>
                      <button
                        onClick={handleRegenCode}
                        className="rounded border border-[#3c3c3c] bg-[#333333] px-2 py-0.5 text-[9px] font-semibold text-zinc-300 hover:bg-[#444444] transition-all"
                      >
                        Auto-Fix firmware code
                      </button>
                    </div>

                    {/* Chat Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 leading-relaxed select-text font-mono">
                      {milestone.debugMessages && milestone.debugMessages.length > 0 ? (
                        milestone.debugMessages.map((msg, idx) => (
                          <div
                            key={idx}
                            className={`p-3 rounded border max-w-[85%] text-[10px] whitespace-pre-wrap ${
                              msg.role === "model"
                                ? "bg-[#2d2d2d]/50 border-[#3c3c3c] text-zinc-200 self-start mr-auto"
                                : "bg-black/30 border-[#2d2d2d] text-zinc-350 self-end ml-auto"
                            }`}
                          >
                            <div className="text-[8px] text-[#007acc] font-bold mb-1">
                              {msg.role === "model" ? "COACH" : "DEVELOPER"}
                            </div>
                            {msg.content}
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-[10px] text-zinc-600 p-8">
                          Describe active compiler errors, wiring snags, or logic bugs to the AI Coach below.
                        </div>
                      )}
                    </div>

                    {/* Send Input */}
                    <div className="p-2 border-t border-[#2d2d2d] bg-[#181818] flex gap-2 shrink-0">
                      <input
                        type="text"
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSendChatMessage();
                        }}
                        placeholder="Ask the coach for assistance..."
                        className="flex-1 rounded border border-[#3c3c3c] bg-black px-2.5 py-1.5 text-[11px] text-zinc-100 placeholder-zinc-600 outline-none focus:border-[#007acc] transition-colors"
                      />
                      <button
                        onClick={handleSendChatMessage}
                        disabled={chatLoading || !chatMessage.trim()}
                        className="rounded bg-[#007acc] px-4 py-1.5 text-[10px] text-white font-bold hover:bg-[#0062a3] transition-colors disabled:bg-[#333333] disabled:text-zinc-600"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Right: Verification & Output panel */}
            <aside className="w-80 shrink-0 bg-[#252526] p-4 overflow-y-auto space-y-4 text-zinc-400 select-text">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-3 flex items-center gap-1.5 border-b border-[#2d2d2d] pb-2 select-none">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" /> MILESTONE VERIFICATION
              </h3>

              <div className="space-y-4 text-[10px] font-mono">
                {/* Expected Output Card */}
                <div className="bg-[#1e1e1e] p-3 rounded border border-[#2d2d2d] space-y-1">
                  <div className="text-zinc-555 font-bold uppercase text-[9px] tracking-wide text-[#007acc]">Expected Output</div>
                  <p className="text-zinc-350 leading-relaxed">{milestone.test?.expectedSerialOutput || "Check objectives."}</p>
                </div>

                {/* Pass Criteria Card */}
                <div className="bg-[#1e1e1e] p-3 rounded border border-[#2d2d2d] space-y-1">
                  <div className="text-zinc-555 font-bold uppercase text-[9px] tracking-wide text-[#007acc]">Verification Criteria</div>
                  <p className="text-zinc-350 leading-relaxed">{milestone.test?.passCondition || "Success verification check."}</p>
                </div>

                {/* Serial Output validation input */}
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wide block select-none">Capture Serial Output</label>
                  <textarea
                    value={serialInput}
                    onChange={(e) => setSerialInput(e.target.value)}
                    placeholder="Paste UART terminal / serial monitor outputs here to confirm..."
                    rows={4}
                    className="w-full rounded border border-[#3c3c3c] bg-black p-2 text-[10px] text-zinc-200 placeholder-zinc-700 outline-none focus:border-[#007acc] transition-colors resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wide block select-none">Verification Notes</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional developer comments..."
                    className="w-full rounded border border-[#3c3c3c] bg-black px-2.5 py-1.5 text-[10px] text-zinc-200 placeholder-zinc-700 outline-none focus:border-[#007acc] transition-colors"
                  />
                </div>

                <div className="space-y-2 pt-2 select-none">
                  <button
                    onClick={handleConfirm}
                    className="w-full rounded bg-[#007acc] px-4 py-2 text-[10px] font-bold text-white hover:bg-[#0062a3] transition-all flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-white" /> Confirm & Complete Step
                  </button>
                  
                  <button
                    onClick={handleSkip}
                    className="w-full rounded border border-[#3c3c3c] bg-[#333333] px-4 py-1.5 text-[10px] font-semibold text-zinc-300 hover:bg-[#444444] transition-all"
                  >
                    Bypass & Unlock Step
                  </button>
                </div>
              </div>
            </aside>

          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-500">
            Select a milestone to load firmware workspace.
          </div>
        )}
      </div>

      {/* VSCode-style Status Bar (Bottom) */}
      <footer className="h-6 shrink-0 bg-[#007acc] text-white flex items-center justify-between px-3 text-[10px] z-20 select-none">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            <span>Step Curriculum Active</span>
          </div>
          <span>Board: Arduino MCU</span>
          <span>Status: Verified</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Language: Arduino C++</span>
          <span>Spaces: 2</span>
          <span>UTF-8</span>
        </div>
      </footer>

      {/* REPORT CONNECTION ISSUE MODAL */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded border border-[#3c3c3c] bg-[#1e1e1e] p-5 space-y-4">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Report Hardware Connection Problem</h3>
              <p className="text-[10px] text-zinc-500 mt-1">Specify which component is failing and describe the symptoms.</p>
            </div>

            <div className="space-y-3 text-[10px]">
              <div className="space-y-1">
                <label className="text-zinc-400 font-semibold uppercase text-[9px]">Component Key</label>
                <input
                  type="text"
                  placeholder="e.g. DHT11 or LED1"
                  value={issueComponent}
                  onChange={(e) => setIssueComponent(e.target.value)}
                  className="w-full rounded border border-[#3c3c3c] bg-black px-3 py-2 text-zinc-100 outline-none focus:border-[#007acc]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 font-semibold uppercase text-[9px]">Issue Description</label>
                <textarea
                  placeholder="Describe the wiring issue, pin mixup, or hardware problem..."
                  rows={4}
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  className="w-full rounded border border-[#3c3c3c] bg-black p-3 text-zinc-100 outline-none focus:border-[#007acc] resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 text-[10px]">
              <button
                onClick={() => setShowIssueModal(false)}
                className="rounded bg-[#333333] hover:bg-[#444444] px-3.5 py-1.5 font-semibold text-zinc-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReportIssue}
                disabled={reportingIssue || !issueComponent || !issueDescription.trim()}
                className="rounded bg-[#007acc] px-4 py-1.5 font-bold text-white hover:bg-[#0062a3] transition-colors disabled:bg-[#333333] disabled:text-zinc-600"
              >
                Report Issue
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
