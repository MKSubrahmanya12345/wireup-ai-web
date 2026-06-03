// ??$$$ group 4 - Build & Firmware Compilation (Phase 3)
// ??$$$ NEW FLOW
import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { useProjectStore, Milestone } from "../store/useProjectStore";
import WokwiSimulator from "../components/WokwiSimulator";
import {
  ArrowLeft, Cpu, Code, Terminal, MessageSquare, Play, RefreshCw, CheckCircle2,
  Lock, AlertTriangle, AlertCircle, Sparkles, HelpCircle, HardDrive, PlayCircle
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

  const saveTimer = useRef<NodeJS.Timeout | null>(null);

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

  return (
    <div className="flex h-screen flex-col bg-zinc-950 font-sans text-zinc-100 antialiased overflow-hidden">
      {/* Top Header */}
      <header className="flex h-14 items-center justify-between border-b border-zinc-850 bg-zinc-900/60 px-6 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/home")} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors">
            <ArrowLeft className="h-4.5 w-4.5" />
          </button>
          <div>
            <h1 className="text-sm font-bold tracking-tight bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">
              {project.description || "Autonomous Project Space"}
            </h1>
            <p className="text-[10px] text-zinc-500">Autonomous Runner Stage</p>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] text-zinc-500 block">Workspace Health</span>
            <span className="text-xs font-bold text-emerald-400">Online</span>
          </div>
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
      </header>

      {/* Main Workspace Grid */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Milestones Sidebar */}
        <aside className="w-80 border-r border-zinc-850 bg-zinc-900/10 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-zinc-850 bg-zinc-900/20">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-zinc-400" /> Milestone Curriculum
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {project.milestones?.map((m, idx) => {
              const isActive = m.id === activeMilestoneId;
              const isLocked = m.status === "locked";
              const isPassed = m.status === "passed" || m.userConfirmed;
              
              return (
                <button
                  key={m.id}
                  disabled={isLocked && !isActive}
                  onClick={() => setActiveMilestoneId(m.id)}
                  className={`w-full rounded-xl border text-left p-3.5 transition-all flex items-start gap-3 relative overflow-hidden ${
                    isActive
                      ? "border-emerald-500/50 bg-zinc-900/60 shadow-[0_0_12px_rgba(16,185,129,0.05)]"
                      : isLocked
                      ? "border-zinc-900/60 bg-zinc-950/20 opacity-40 cursor-not-allowed"
                      : "border-zinc-850 bg-zinc-900/20 hover:border-zinc-750 hover:bg-zinc-900/40"
                  }`}
                >
                  {/* Status Indicator Indicator */}
                  <div className={`h-6 w-6 rounded-full flex-shrink-0 text-xs font-bold flex items-center justify-center border ${
                    isPassed
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : isActive
                      ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                      : "bg-zinc-850 border-zinc-800 text-zinc-400"
                  }`}>
                    {isPassed ? "✓" : idx + 1}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-zinc-200 truncate flex items-center gap-1">
                      {m.title}
                      {isLocked && <Lock className="h-2.5 w-2.5 text-zinc-650 flex-shrink-0" />}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5 truncate">{m.objective}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Central Stage & Interactive Editor */}
        {milestone ? (
          <div className="flex-1 flex overflow-hidden bg-zinc-950">
            {/* Center: Details & Editor */}
            <div className="flex-1 flex flex-col border-r border-zinc-850 overflow-hidden">
              {/* Milestone Details Card */}
              <div className="p-5 border-b border-zinc-850 bg-zinc-900/10 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      Step {milestone.order} · {milestone.subsystem || "Core"}
                    </span>
                    <h2 className="text-base font-bold text-zinc-100 mt-2">{milestone.title}</h2>
                  </div>
                  <button
                    onClick={() => setShowIssueModal(true)}
                    className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 transition-all"
                  >
                    Report Hardware Issue
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1 bg-zinc-900/30 p-3 rounded-lg border border-zinc-850/80">
                    <div className="text-zinc-500 font-semibold">Objective</div>
                    <p className="text-zinc-300 leading-relaxed">{milestone.objective}</p>
                  </div>
                  <div className="space-y-1 bg-zinc-900/30 p-3 rounded-lg border border-zinc-850/80">
                    <div className="text-zinc-500 font-semibold">Components Involved</div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {milestone.componentsInvolved?.map((comp, idx) => (
                        <span key={idx} className="rounded bg-zinc-850 px-2 py-0.5 text-[10px] text-zinc-300 border border-zinc-800">
                          {comp}
                        </span>
                      )) || <span className="text-zinc-600 italic">None</span>}
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900/30 p-3.5 rounded-lg border border-zinc-850/80 text-xs">
                  <div className="text-zinc-500 font-semibold mb-1">Wiring Instructions</div>
                  <p className="text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap">{milestone.wiringInstructions}</p>
                </div>
              </div>

              {/* Tabs for Stage */}
              <div className="flex h-11 border-b border-zinc-850 bg-zinc-900/10 px-4">
                <button
                  onClick={() => setActiveTab("code")}
                  className={`flex items-center gap-1.5 border-b-2 px-4 text-xs font-semibold transition-colors ${
                    activeTab === "code"
                      ? "border-emerald-500 text-emerald-400"
                      : "border-transparent text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <Code className="h-3.5 w-3.5" /> Firmware Sketch
                </button>
                <button
                  onClick={() => setActiveTab("simulator")}
                  className={`flex items-center gap-1.5 border-b-2 px-4 text-xs font-semibold transition-colors ${
                    activeTab === "simulator"
                      ? "border-emerald-500 text-emerald-400"
                      : "border-transparent text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <PlayCircle className="h-3.5 w-3.5" /> Live Simulation
                </button>
                <button
                  onClick={() => setActiveTab("coach")}
                  className={`flex items-center gap-1.5 border-b-2 px-4 text-xs font-semibold transition-colors ${
                    activeTab === "coach"
                      ? "border-emerald-500 text-emerald-400"
                      : "border-transparent text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <MessageSquare className="h-3.5 w-3.5" /> Debug Coach Chat
                </button>
              </div>

              {/* Active Tab Panel */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {activeTab === "code" ? (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 relative overflow-hidden bg-zinc-950">
                      <Editor
                        height="100%"
                        defaultLanguage="cpp"
                        theme="vs-dark"
                        value={localCode}
                        onChange={(v) => handleCodeChange(v || "")}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 13,
                          lineNumbers: "on",
                          scrollbar: { vertical: "visible" },
                          tabSize: 2,
                          wordWrap: "on"
                        }}
                      />
                    </div>

                    {/* Console & Compile Panel */}
                    <div className="h-60 border-t border-zinc-850 bg-zinc-950 flex flex-col overflow-hidden">
                      <div className="flex h-10 items-center justify-between border-b border-zinc-850 bg-zinc-900/20 px-4">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                          <Terminal className="h-3.5 w-3.5 text-zinc-500" /> Build Console
                        </span>
                        <button
                          onClick={handleCompile}
                          disabled={compiling}
                          className="flex items-center gap-1.5 rounded bg-emerald-500 px-3 py-1 text-[11px] font-bold text-zinc-950 hover:bg-emerald-400 transition-colors disabled:bg-zinc-800 disabled:text-zinc-650"
                        >
                          {compiling ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <Play className="h-3 w-3" />
                          )}
                          Verify & Compile Code
                        </button>
                      </div>
                      <div className="flex-1 p-4 font-mono text-xs text-zinc-400 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                        {compilationConsole || "Console idle. Ready for compilation."}
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
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-zinc-500 bg-[#1a1a1a]">
                        <HardDrive className="h-10 w-10 text-zinc-700 mb-3" />
                        <h3 className="text-sm font-bold text-zinc-350">Simulator Locked</h3>
                        <p className="text-xs text-zinc-600 mt-1 max-w-sm">
                          Please run compilation in the Firmware tab successfully before starting simulation.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  /* COACH CHAT PANEL */
                  <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950">
                    <div className="flex h-10 items-center justify-between border-b border-zinc-850 bg-zinc-900/10 px-4">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1">
                        <Sparkles className="h-3.5 w-3.5" /> AI Debug Coach
                      </span>
                      <button
                        onClick={handleRegenCode}
                        className="rounded border border-purple-500/20 bg-purple-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-purple-400 hover:bg-purple-500/20 transition-all"
                      >
                        Auto-Fix Sketch Code
                      </button>
                    </div>

                    {/* Chat Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 leading-relaxed">
                      {milestone.debugMessages && milestone.debugMessages.length > 0 ? (
                        milestone.debugMessages.map((msg, idx) => (
                          <div
                            key={idx}
                            className={`p-3.5 rounded-xl border max-w-[85%] text-xs font-mono whitespace-pre-wrap ${
                              msg.role === "model"
                                ? "bg-purple-950/10 border-purple-950/20 text-purple-200 self-start mr-auto"
                                : "bg-zinc-900 border-zinc-800 text-zinc-300 self-end ml-auto"
                            }`}
                          >
                            <div className="text-[9px] text-zinc-550 mb-1">
                              {msg.role === "model" ? "COACH" : "USER"}
                            </div>
                            {msg.content}
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-xs text-zinc-650 p-10 font-mono">
                          Describe any compiling errors, wiring problems, or serial issues to the Debug Coach above.
                        </div>
                      )}
                    </div>

                    {/* Send Input */}
                    <div className="p-3 border-t border-zinc-850 bg-zinc-900/20 flex gap-2">
                      <input
                        type="text"
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSendChatMessage();
                        }}
                        placeholder="Ask the coach for assistance..."
                        className="flex-1 rounded-lg border border-zinc-850 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-purple-500 transition-colors"
                      />
                      <button
                        onClick={handleSendChatMessage}
                        disabled={chatLoading || !chatMessage.trim()}
                        className="rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold hover:bg-purple-500 transition-colors disabled:bg-zinc-800 disabled:text-zinc-600"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Verification & Output Stage */}
            <aside className="w-80 bg-zinc-900/10 p-5 overflow-y-auto space-y-6">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-4 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Milestone Verification
                </h3>

                <div className="space-y-4 text-xs font-mono">
                  {/* Expected Output Card */}
                  <div className="bg-zinc-900/40 p-3.5 rounded-lg border border-zinc-850/80 space-y-1">
                    <div className="text-zinc-500 font-bold uppercase text-[9px] tracking-wide">Expected Output</div>
                    <p className="text-zinc-300 leading-relaxed">{milestone.test?.expectedSerialOutput || "Check objectives."}</p>
                  </div>

                  {/* Pass Condition Card */}
                  <div className="bg-zinc-900/40 p-3.5 rounded-lg border border-zinc-850/80 space-y-1">
                    <div className="text-zinc-500 font-bold uppercase text-[9px] tracking-wide">Verification Criteria</div>
                    <p className="text-zinc-300 leading-relaxed">{milestone.test?.passCondition || "Success verification check."}</p>
                  </div>

                  {/* Serial Output validation input */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Capture Serial Output</label>
                    <textarea
                      value={serialInput}
                      onChange={(e) => setSerialInput(e.target.value)}
                      placeholder="Paste terminal / serial monitor output here to confirm..."
                      rows={4}
                      className="w-full rounded-lg border border-zinc-850 bg-zinc-950/60 p-2.5 text-xs text-zinc-200 placeholder-zinc-650 outline-none focus:border-emerald-500 transition-colors resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Verification Notes</label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Optional notes or details..."
                      className="w-full rounded-lg border border-zinc-850 bg-zinc-950/60 px-2.5 py-2 text-xs text-zinc-200 placeholder-zinc-650 outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>

                  <div className="space-y-2 pt-2">
                    <button
                      onClick={handleConfirm}
                      className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-xs font-bold text-zinc-950 hover:bg-emerald-400 transition-all flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Confirm & Complete Step
                    </button>
                    
                    <button
                      onClick={handleSkip}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-2 text-xs font-semibold text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 transition-all"
                    >
                      Bypass & Unlock Step
                    </button>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-500">
            Select a milestone to begin firmware compilation.
          </div>
        )}
      </div>

      {/* REPORT ISSUE MODAL */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-zinc-100">Report Hardware Connection Problem</h3>
              <p className="text-xs text-zinc-500 mt-1">Specify which component is failing and describe the symptoms.</p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-zinc-400 font-semibold">Component Key</label>
                <input
                  type="text"
                  placeholder="e.g. DHT11 or LED1"
                  value={issueComponent}
                  onChange={(e) => setIssueComponent(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 font-semibold">Issue Description</label>
                <textarea
                  placeholder="Describe the wiring issue, pin mixup, or hardware problem..."
                  rows={4}
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-zinc-100 outline-none focus:border-purple-500 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => setShowIssueModal(false)}
                className="rounded-lg bg-zinc-800 px-3.5 py-2 font-semibold hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReportIssue}
                disabled={reportingIssue || !issueComponent || !issueDescription.trim()}
                className="rounded-lg bg-purple-600 px-4 py-2 font-bold hover:bg-purple-500 transition-colors disabled:bg-zinc-850 disabled:text-zinc-600"
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
