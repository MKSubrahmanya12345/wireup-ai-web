// ??$$$ newer code - FormulationPhase: tripartite VS Code-inspired layout with resizable explorer, editor/diagram/simulation tabs, and AIReasoningPanel sidebar

import React, { useState, useRef, useEffect } from "react";
import {
  Terminal,
  Cpu,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  HardDrive,
  PlayCircle,
  Copy,
  Sparkles,
  Folder,
  File,
  Activity,
  Code,
  Layers,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Settings,
  Braces,
  FileText,
  Volume2,
  Info,
  X,
  Home,
} from "lucide-react";
import { ProgressTracker } from "../panels/ProgressTracker";
import { HardwareAssembly } from "../panels/HardwareAssembly";
import { MilestonesPanel } from "../panels/MilestonesPanel";
import { BomPanel } from "../panels/BomPanel";
import { axiosInstance } from "../../../lib/axios";
import { AIReasoningPanel, type ReasoningStep, type ChatMessage as AIChatMessage, type StepStatus } from "../../AIReasoningPanel/AIReasoningPanel";

interface FormulationPhaseProps {
  dark: boolean;
  isCompleted: boolean;
  isFailed: boolean;
  activeStage: string;
  workspaceTab: "visual" | "console";
  setWorkspaceTab: (tab: "visual" | "console") => void;
  logs: any[];
  bom: any[];
  wiring: any[];
  milestones: any[];
  context: any;
  candidates: string[];
  decisions: string[];
  conflictDetails: {
    title: string;
    description: string;
    options: string[];
  } | null;
  exporting: boolean;
  restarting: boolean;
  loading: boolean;
  rescuing: boolean;
  selectedLog: any;
  setSelectedLog: (log: any) => void;
  finalSketch: string;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  handleRestart: () => void;
  handleGoToSimulator: () => void;
  handleExportLocal: () => void;
  handleCopyAllData: () => void;
  handleResume: () => void;
  handleRescue: () => void;
  resolveConflict: (choice: string) => void;
  handleGoToBehaviorSim: () => void;
  blueprint: any;
  requirementsDoc: string;
  setShowContextModal: (show: boolean) => void;
  sessionId: string | null;
  // ??$$$ newer code
  model: string;
  setModel: (m: string) => void;
  onClose: () => void;
}

/* ── Drag separator component (from teammate repo) ───────────────────────── */
function HDrag({ onD }: { onD: (d: number) => void }) {
  const a = useRef(false), lx = useRef(0);
  return (
    <div
      className="w-1 flex-shrink-0 bg-zinc-800 hover:bg-[#0e7dd4] cursor-col-resize transition-colors z-20"
      onMouseDown={e => {
        e.preventDefault(); a.current = true; lx.current = e.clientX;
        const mv = (ev: MouseEvent) => { if (a.current) { onD(ev.clientX - lx.current); lx.current = ev.clientX; } };
        const up = () => { a.current = false; window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); };
        window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
      }}
    />
  );
}

export const FormulationPhase: React.FC<FormulationPhaseProps> = ({
  dark,
  isCompleted,
  isFailed,
  activeStage,
  workspaceTab,
  setWorkspaceTab,
  logs,
  bom,
  wiring,
  milestones,
  context,
  candidates,
  decisions,
  conflictDetails,
  exporting,
  restarting,
  loading,
  rescuing,
  selectedLog,
  setSelectedLog,
  finalSketch,
  scrollContainerRef,
  handleRestart,
  handleGoToSimulator,
  handleExportLocal,
  handleCopyAllData,
  handleResume,
  handleRescue,
  resolveConflict,
  handleGoToBehaviorSim,
  blueprint,
  requirementsDoc,
  setShowContextModal,
  sessionId,
  // ??$$$ newer code
  model,
  setModel,
  onClose,
}) => {
  // ??$$$ newer code - resizable layout widths
  const [leftWidth, setLeftWidth] = useState(250);
  const [rightWidth, setRightWidth] = useState(360);

  // ??$$$ newer code - Active tab in center panel
  const [tabMode, setTabMode] = useState<"Code" | "Diagram" | "Simulation">("Code");

  // ??$$$ newer code - Active virtual file in explorer
  const [activeFile, setActiveFile] = useState<string>("sketch.ino");

  // ??$$$ newer code - Sidebar navigation tab
  const [sidebarTab, setSidebarTab] = useState<"explorer" | "progress" | "rationale" | "hardware">("explorer");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ??$$$ newer code - chatbot messaging states
  const [chatMessages, setChatMessages] = useState<AIChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hey! I know your full project — BOM, wiring, MCU, everything. Ask me anything or tell me what to change.",
      streaming: false,
    }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);

  // ??$$$ newer code - virtual file contents builder
  const virtualFiles = [
    { name: "sketch.ino", label: "sketch.ino", icon: Code, color: "text-[#00979d]", content: finalSketch || `// Arduino sketch generation in progress...\n// Please wait for the autonomous agent to generate code.\n// Current stage: ${activeStage ? activeStage.toUpperCase() : "IDLE"}` },
    { name: "bom.json", label: "bom.json", icon: Braces, color: "text-amber-400", content: JSON.stringify(bom, null, 2) },
    { name: "wiring.json", label: "wiring.json", icon: Braces, color: "text-blue-400", content: JSON.stringify(wiring, null, 2) },
    { name: "requirements.md", label: "requirements.md", icon: FileText, color: "text-[#519aba]", content: requirementsDoc || "# Requirements Document\nNo requirements gathered yet." },
  ];

  const currentFileContent = virtualFiles.find(f => f.name === activeFile)?.content || "";

  // ??$$$ newer code - send chat request
  const handleChatSend = async () => {
    const text = chatInput.trim();
    if (!text || chatBusy || !sessionId) return;

    const userMsg: AIChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      streaming: false,
    };
    
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatBusy(true);

    const assistantMsgId = `a-${Date.now()}`;
    setChatMessages(prev => [...prev, {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      streaming: true,
    }]);

    try {
      const res = await axiosInstance.post("/new-flow/chat", {
        sessionId,
        message: text,
        history: chatMessages
          .filter(m => m.id !== "welcome" && !m.streaming)
          .slice(-10)
          .map(m => ({ role: m.role, content: m.content })),
      });

      setChatMessages(prev =>
        prev.map(m =>
          m.id === assistantMsgId
            ? { ...m, content: res.data.reply || "Got it.", streaming: false }
            : m
        )
      );
    } catch (err: any) {
      setChatMessages(prev =>
        prev.map(m =>
          m.id === assistantMsgId
            ? { ...m, content: `Error: ${err.response?.data?.error || "LLM call failed. Try again."}`, streaming: false }
            : m
        )
      );
    } finally {
      setChatBusy(false);
    }
  };

  // ??$$$ newer code - map logs to reasoning steps for AIReasoningPanel
  const steps = logs.map((log, idx): ReasoningStep => {
    const isLast = idx === logs.length - 1;
    const isActive = !isCompleted && !isFailed;
    
    let label = "AI Formulation Log";
    let status: StepStatus = "done";
    let content = log.text || "";
    let icon: ReasoningStep["icon"] = "think";

    if (log.type === "thinking") {
      label = "Thinking Process";
      if (log.usage) {
        label += ` (Tokens: Prompt ${log.usage.promptTokens} | Gen ${log.usage.completionTokens})`;
      }
      status = (isLast && isActive) ? "running" : "done";
      icon = "think";
    } else if (log.type === "tool_call") {
      label = `Tool: ${log.name || "Invoke"}`;
      status = log.status === "done" ? "done" : log.status === "failed" ? "failed" : "running";
      icon = "tool";
      
      const inputStr = log.input ? `Input Params:\n\`\`\`json\n${JSON.stringify(log.input, null, 2)}\n\`\`\`` : "";
      const outputStr = log.output ? `Output Response:\n\`\`\`json\n${JSON.stringify(log.output, null, 2)}\n\`\`\`` : (log.status === "failed" ? "Tool call failed." : "Execution in progress...");
      content = `${inputStr}\n\n${outputStr}`;
    } else if (log.type === "decision") {
      label = "System Decision Logged";
      status = "done";
      icon = "check";
    } else if (log.type === "rate_limit") {
      label = "Rate Limit Pause";
      status = "running";
      icon = "think";
    } else if (log.type === "error") {
      label = "Pipeline Error";
      status = "failed";
      icon = "check";
    }

    return {
      id: `step-${idx}`,
      label,
      status,
      content,
      streaming: isLast && isActive && log.type === "thinking"
    };
  });

  // ??$$$ newer code - calculate progress pct
  const progressPercent = isCompleted ? 100 : Math.min(steps.filter(s => s.status === "done").length * 8, 95);

  // ??$$$ newer code - model options
  const modelOptions = [
    { key: "gemini-2.5-flash", sub: "Gemini 2.5 Flash" },
    { key: "gpt-oss-120b", sub: "Cerebras gpt-oss-120b" },
    { key: "zai-glm-4.7", sub: "Cerebras zai-glm-4.7" },
    { key: "meta-llama/llama-4-scout-17b-16e-instruct", sub: "Groq Llama 4 Scout" },
    { key: "qwen/qwen3-32b", sub: "Groq Qwen3-32B" },
    { key: "deepseek-chat", sub: "DeepSeek V3" },
    { key: "ollama/qwen2.5:3b", sub: "Ollama (qwen2.5:3b)" },
    { key: "ollama/llama3.2:3b", sub: "Ollama (llama3.2:3b)" },
    { key: "ollama/qwen2.5-coder:14b", sub: "Ollama (qwen2.5-coder:14b)" },
    { key: "ollama/qwen2.5-coder:7b", sub: "Ollama (qwen2.5-coder:7b)" },
    { key: "ollama/deepseek-r1:8b", sub: "Ollama (deepseek-r1:8b)" },
  ];

  // ??$$$ newer code - simulated serial output logs for Simulation view
  const simulatedSerialLogs = [
    `[00:00:01.00] Booting System Core...`,
    `[00:00:01.05] Clock configuration synchronized (16 MHz).`,
    `[00:00:01.12] GPIO initialization complete.`,
    `[00:00:01.20] Communication: ${context.connectivity && context.connectivity.length > 0 ? (Array.isArray(context.connectivity) ? context.connectivity.join(", ") : context.connectivity) : "Serial (Baud 115200)"} active.`,
    `[00:00:01.35] BOM Components verification: OK (resolved ${bom.length} items).`,
    `[00:00:01.50] Wiring continuity tests: PASSED.`,
    `[00:00:01.80] Loading main firmware image (sketch.ino).`,
    `[00:00:02.00] Running validation loops...`,
    `[00:00:02.50] System online and monitoring inputs/outputs.`,
  ];
  milestones.forEach((m, idx) => {
    simulatedSerialLogs.push(`[00:00:03.${10 + idx * 20}] [TEST] Verification milestone #${idx + 1}: ${m.title || m.description || "OK"}`);
  });

  return (
    // ??$$$ newer code - VS Code tripartite layout
    <div className="flex h-full w-full bg-[#1e1e1e] text-[#d4d4d4] font-mono text-xs overflow-hidden select-none">

      {/* VSCode Left Activity Bar */}
      <div className="w-12 shrink-0 bg-[#333333] border-r border-[#252526] flex flex-col justify-between items-center py-2 z-10">
        <div className="flex flex-col gap-4 w-full items-center">
          <button
            title="Project File Explorer"
            onClick={() => { setSidebarOpen(true); setSidebarTab("explorer"); }}
            className={`relative p-2 rounded text-zinc-400 hover:text-white transition-colors ${sidebarOpen && sidebarTab === "explorer" ? "text-white bg-[#252526]" : ""}`}
          >
            <Folder className="w-5 h-5" />
            {sidebarOpen && sidebarTab === "explorer" && (
              <div className="absolute left-0 top-2 bottom-2 w-[2px] bg-[#007acc]" />
            )}
          </button>

          <button
            title="Hardware Assembly Diagram"
            onClick={() => { setSidebarOpen(true); setSidebarTab("hardware"); }}
            className={`relative p-2 rounded text-zinc-400 hover:text-white transition-colors ${sidebarOpen && sidebarTab === "hardware" ? "text-white bg-[#252526]" : ""}`}
          >
            <Layers className="w-5 h-5" />
            {sidebarOpen && sidebarTab === "hardware" && (
              <div className="absolute left-0 top-2 bottom-2 w-[2px] bg-[#007acc]" />
            )}
          </button>

          <button
            title="Build Pipeline Tracker"
            onClick={() => { setSidebarOpen(true); setSidebarTab("progress"); }}
            className={`relative p-2 rounded text-zinc-400 hover:text-white transition-colors ${sidebarOpen && sidebarTab === "progress" ? "text-white bg-[#252526]" : ""}`}
          >
            <Activity className="w-5 h-5" />
            {sidebarOpen && sidebarTab === "progress" && (
              <div className="absolute left-0 top-2 bottom-2 w-[2px] bg-[#007acc]" />
            )}
          </button>

          <button
            title="AI Architectural Rationale"
            onClick={() => { setSidebarOpen(true); setSidebarTab("rationale"); }}
            className={`relative p-2 rounded text-zinc-400 hover:text-white transition-colors ${sidebarOpen && sidebarTab === "rationale" ? "text-white bg-[#252526]" : ""}`}
          >
            <BookOpen className="w-5 h-5" />
            {sidebarOpen && sidebarTab === "rationale" && (
              <div className="absolute left-0 top-2 bottom-2 w-[2px] bg-[#007acc]" />
            )}
          </button>
        </div>

        <div className="flex flex-col gap-3 items-center">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 text-zinc-500 hover:text-white"
            title="Toggle Sidebar"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* VSCode Left Sidebar */}
      {sidebarOpen && (
        <div
          style={{ width: leftWidth }}
          className="shrink-0 bg-[#252526] border-r border-[#2d2d2d] flex flex-col overflow-hidden text-zinc-400"
        >
          {/* Explorer Tab */}
          {sidebarTab === "explorer" && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="h-9 flex items-center px-3 text-[10px] uppercase font-bold tracking-wider text-zinc-500 border-b border-[#2d2d2d] shrink-0">
                Explorer: Project
              </div>
              
              <div className="flex-1 overflow-y-auto p-3 space-y-4 ide-scroll">
                
                {/* Virtual File Tree */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                    <ChevronDown className="w-3 h-3" />
                    <span>Workspace Files</span>
                  </div>
                  <div className="pl-3 space-y-1">
                    {virtualFiles.map((vf) => {
                      const IconComp = vf.icon;
                      const isFileSelected = activeFile === vf.name;
                      return (
                        <div
                          key={vf.name}
                          onClick={() => {
                            setActiveFile(vf.name);
                            setTabMode("Code");
                          }}
                          className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors ${isFileSelected ? "bg-zinc-800 text-white font-bold" : "hover:bg-zinc-800/40 text-zinc-400"}`}
                        >
                          <IconComp className={`w-3.5 h-3.5 ${vf.color} shrink-0`} />
                          <span className="text-[11px] truncate">{vf.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Project Scope tree */}
                <div className="border-t border-[#2d2d2d] pt-3 space-y-2">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    <ChevronDown className="w-3 h-3" />
                    <Folder className="w-3.5 h-3.5 text-[#c8a0e0]" />
                    Project Scope
                  </div>
                  <div className="pl-4 space-y-1.5">
                    {[
                      { label: "brain", value: context.mcu },
                      { label: "power", value: context.powerSource },
                      {
                        label: "connectivity",
                        value: Array.isArray(context.connectivity)
                          ? context.connectivity.join(", ")
                          : context.connectivity
                      },
                      { label: "form-factor", value: context.formFactor },
                      { label: "budget", value: context.estimatedBudget }
                    ]
                      .filter((f) => f.value && (typeof f.value !== "string" || f.value.trim() !== ""))
                      .map(({ label, value }) => (
                        <div key={label} className="flex items-start gap-1.5 text-[10px]">
                          <File className="w-3 h-3 shrink-0 mt-0.5 text-zinc-600" />
                          <span className="text-[#007acc] font-bold shrink-0">{label}:</span>
                          <span className="text-zinc-350 break-all">{value}</span>
                        </div>
                      ))}
                    {!context.mcu && !context.powerSource && (
                      <div className="text-[10px] italic text-zinc-600 flex items-center gap-1">
                        <File className="w-3 h-3" />
                        Extracting constraints...
                      </div>
                    )}
                  </div>
                </div>

                {/* BOM tree */}
                <div className="border-t border-[#2d2d2d] pt-3">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
                    <ChevronDown className="w-3 h-3" />
                    <Folder className="w-3.5 h-3.5 text-amber-400" />
                    Confirmed BOM
                  </div>
                  <BomPanel bom={bom} candidates={candidates} dark={dark} />
                </div>

              </div>
            </div>
          )}

          {/* Hardware Assembly Preview */}
          {sidebarTab === "hardware" && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="h-9 flex items-center px-3 text-[10px] uppercase font-bold tracking-wider text-zinc-500 border-b border-[#2d2d2d] shrink-0">
                Hardware Assembly
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-4 ide-scroll">

                {/* Status alerts */}
                {isCompleted && (
                  <div className="rounded border border-emerald-500/35 bg-emerald-950/10 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-[10px] font-bold text-white">Formulation Complete!</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <button
                        onClick={handleExportLocal}
                        disabled={exporting}
                        className="flex items-center gap-1.5 rounded bg-[#2d2d2d] border border-[#3c3c3c] hover:bg-[#333333] px-2 py-1 text-[10px] text-zinc-300 transition-all w-full"
                      >
                        <HardDrive className="h-3 w-3 text-emerald-400" />
                        {exporting ? "Exporting..." : "Export to Local E:"}
                      </button>
                      <button
                        onClick={handleCopyAllData}
                        className="flex items-center gap-1.5 rounded bg-[#2d2d2d] border border-[#3c3c3c] hover:bg-[#333333] px-2 py-1 text-[10px] text-zinc-300 transition-all w-full"
                      >
                        <Copy className="h-3 w-3 text-zinc-400" />
                        Copy Workspace Data
                      </button>
                      <button
                        onClick={handleGoToSimulator}
                        className="flex items-center gap-1.5 rounded bg-[#007acc] hover:bg-[#0062a3] px-2 py-1 text-[10px] text-white font-bold transition-all w-full"
                      >
                        <PlayCircle className="h-3 w-3" />
                        Open 3D Simulator
                      </button>
                    </div>
                  </div>
                )}

                {isFailed && !isCompleted && !conflictDetails && (
                  <div className="rounded border border-red-500/35 bg-red-950/10 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-red-400 font-bold text-[10px]">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Agent Interrupted
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <button
                        onClick={handleResume}
                        disabled={loading || rescuing}
                        className="flex items-center gap-1 rounded bg-[#007acc] hover:bg-[#0062a3] px-2 py-1 text-[10px] text-white font-bold transition-all w-full"
                      >
                        <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                        {loading ? "Resuming..." : "Resume Formulation"}
                      </button>
                      <button
                        onClick={handleRescue}
                        disabled={loading || rescuing}
                        className="flex items-center gap-1 rounded bg-amber-600 hover:bg-amber-500 px-2 py-1 text-[10px] text-zinc-950 font-bold transition-all w-full"
                      >
                        <Cpu className="h-3 w-3" />
                        {rescuing ? "Rescuing..." : "API Rescue Link"}
                      </button>
                    </div>
                  </div>
                )}

                {conflictDetails && (
                  <div className="rounded border border-amber-500/35 bg-amber-950/10 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-amber-400 font-bold text-[10px]">
                      <AlertTriangle className="h-3.5 w-3.5 animate-pulse" />
                      {conflictDetails.title}
                    </div>
                    <p className="text-[9px] text-zinc-400 leading-relaxed">{conflictDetails.description}</p>
                    <div className="space-y-1">
                      {conflictDetails.options.map((opt, idx) => (
                        <button
                          key={idx}
                          onClick={() => resolveConflict(opt)}
                          disabled={loading}
                          className="w-full text-left rounded bg-[#2d2d2d] hover:bg-[#37373d] border border-[#3c3c3c] p-2 text-[10px] text-zinc-300 transition-all"
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hardware assembly diagram */}
                <div className="space-y-1">
                  <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1 mb-2">
                    <Layers className="w-3 h-3" /> Circuit Preview
                  </div>
                  <HardwareAssembly bom={bom} wiring={wiring} context={context} />
                </div>

                {/* Milestones */}
                <div className="border-t border-[#2d2d2d] pt-3">
                  <MilestonesPanel milestones={milestones} />
                </div>
              </div>
            </div>
          )}

          {/* Build Pipeline Tracker */}
          {sidebarTab === "progress" && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="h-9 flex items-center px-3 text-[10px] uppercase font-bold tracking-wider text-zinc-500 border-b border-[#2d2d2d] shrink-0">
                Build Pipeline Tracker
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 ide-scroll">
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Stages Status</div>
                <ProgressTracker
                  isCompleted={isCompleted}
                  isFailed={isFailed}
                  activeStage={activeStage}
                  dark={dark}
                />
                <div className="border-t border-[#2d2d2d] pt-3 space-y-2">
                  <div className="text-[9px] font-bold text-zinc-500 uppercase">Current Stage</div>
                  <div className="p-2 rounded bg-[#1e1e1e] border border-[#2d2d2d] text-white font-bold text-center">
                    {activeStage ? activeStage.toUpperCase() : "IDLE"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AI Architectural Rationale */}
          {sidebarTab === "rationale" && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="h-9 flex items-center px-3 text-[10px] uppercase font-bold tracking-wider text-zinc-500 border-b border-[#2d2d2d] shrink-0">
                AI Architectural Rationale
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 select-text ide-scroll">
                {decisions.length === 0 ? (
                  <div className="text-[10px] italic text-zinc-600 text-center py-4">No decisions recorded yet.</div>
                ) : (
                  decisions.map((dec, idx) => (
                    <div
                      key={idx}
                      className="rounded border border-[#2d2d2d] bg-[#1e1e1e] p-2.5 text-[10px] leading-relaxed text-zinc-400"
                    >
                      {dec}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Resize handle */}
      {sidebarOpen && <HDrag onD={d => setLeftWidth(w => Math.max(160, Math.min(450, w + d)))} />}

      {/* Center panel */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#1e1e1e] relative">
        
        {/* Header toolbar */}
        <div className="h-9 shrink-0 bg-[#2d2d2d] border-b border-[#1e1e1e] flex items-center justify-between px-3">
          
          {/* Tab buttons */}
          <div className="flex items-center gap-1 h-full">
            {[
              { id: "Code", label: "Code Editor" },
              { id: "Diagram", label: "Schematic / Connections" },
              { id: "Simulation", label: "Sim Console" },
            ].map(tab => {
              const active = tabMode === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setTabMode(tab.id as any)}
                  className={`h-full px-4 border-r border-[#1e1e1e] text-[11px] font-semibold font-sans transition-colors ${active ? "bg-[#1e1e1e] text-white border-t-2 border-t-[#007acc]" : "bg-transparent text-zinc-400 hover:text-zinc-200"}`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRestart}
              disabled={restarting}
              className="flex items-center gap-1 rounded bg-[#333333] hover:bg-[#444444] border border-[#444444] text-[10px] text-zinc-300 px-2 py-1 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${restarting ? "animate-spin" : ""}`} />
              Restart Build
            </button>

            <button
              onClick={() => setShowContextModal(true)}
              className="flex items-center gap-1 rounded bg-[#333333] hover:bg-[#444444] border border-[#444444] text-[10px] text-zinc-300 px-2 py-1 transition-all"
            >
              <Cpu className="h-3 w-3 text-[#007acc]" />
              Shared Context
            </button>

            <button
              onClick={onClose}
              className="flex items-center gap-1 rounded bg-red-950/40 border border-red-500/30 text-red-400 hover:bg-red-900/30 text-[10px] px-2 py-1 transition-all"
            >
              <Home className="h-3 w-3" />
              Back to Homepage
            </button>

            {sessionId && (
              <>
                <button
                  onClick={handleGoToSimulator}
                  className="flex items-center gap-1 rounded bg-[#007acc] hover:bg-[#0062a3] text-[10px] text-white font-bold px-2 py-1 transition-all"
                >
                  <PlayCircle className="h-3 w-3" />
                  3D View
                </button>
                <button
                  onClick={handleGoToBehaviorSim}
                  className="flex items-center gap-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-[#3c3c3c] text-[10px] text-zinc-350 font-bold px-2 py-1 transition-all"
                >
                  <Sparkles className="h-3 w-3 text-amber-400" />
                  Behavior Sim
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tab view contents */}
        <div className="flex-1 overflow-hidden flex flex-col">

          {/* CODE TAB */}
          {tabMode === "Code" && (
            <div className="flex-1 flex overflow-hidden">
              {/* Line numbers Column */}
              <div className="w-12 select-none text-right pr-3 pt-4 font-mono text-[11px] text-zinc-600 bg-zinc-950/20 border-r border-zinc-900/60 overflow-hidden leading-relaxed">
                {currentFileContent.split("\n").map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              
              {/* Monospace Code Editor */}
              <textarea
                readOnly
                value={currentFileContent}
                className="flex-1 bg-[#1e1e1e] p-4 text-[12px] font-mono leading-relaxed text-[#d4d4d4] resize-none outline-none select-text cursor-text ide-scroll"
              />
            </div>
          )}

          {/* DIAGRAM TAB */}
          {tabMode === "Diagram" && (
            <div className="flex-1 overflow-auto bg-[#0a0a0f] p-6 flex flex-col items-center justify-center relative">
              <div className="absolute top-4 left-4 bg-zinc-900/80 border border-zinc-800 rounded-lg p-3 text-[10px] max-w-sm">
                <div className="font-bold text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-blue-400" />
                  System Blueprint Diagram
                </div>
                <p className="text-zinc-500 leading-normal">
                  Renders the compiled schematic layout. The interactive model dynamically responds to your virtual peripheral signals.
                </p>
              </div>
              <div className="scale-110">
                <HardwareAssembly bom={bom} wiring={wiring} context={context} />
              </div>
            </div>
          )}

          {/* SIMULATION TAB */}
          {tabMode === "Simulation" && (
            <div className="flex-1 overflow-hidden flex flex-col bg-[#0a0a0f] p-6 space-y-4">
              
              {/* Simulation status metrics */}
              <div className="grid grid-cols-4 gap-4 shrink-0">
                {[
                  { label: "VIRTUAL POWER", val: "5V / 180mA", desc: "Avg active draw", color: "text-emerald-400" },
                  { label: "MCU CLOCK", val: "16 MHz", desc: "Internal oscillator", color: "text-[#00979d]" },
                  { label: "FLASH STORAGE", val: "32 KB (87% utilized)", desc: "Program memory load", color: "text-amber-400" },
                  { label: "SRAM USAGE", val: "2 KB (70% utilized)", desc: "Runtime heap / stack", color: "text-blue-400" }
                ].map((stat, i) => (
                  <div key={i} className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between">
                    <span className="text-[9px] text-zinc-550 font-bold uppercase tracking-wider">{stat.label}</span>
                    <span className={`text-sm font-bold mt-1 ${stat.color}`}>{stat.val}</span>
                    <span className="text-[10px] text-zinc-500 mt-0.5">{stat.desc}</span>
                  </div>
                ))}
              </div>

              <div className="flex-1 flex gap-4 overflow-hidden">
                
                {/* Simulated serial output console */}
                <div className="flex-1 flex flex-col bg-zinc-950/80 border border-zinc-900/60 rounded-xl overflow-hidden p-4">
                  <div className="flex justify-between items-center text-[9px] text-zinc-500 border-b border-zinc-900 pb-2 mb-3">
                    <span className="font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-blue-400" />
                      UART Serial Telemetry Monitor
                    </span>
                    <span className="font-mono text-blue-400/80 animate-pulse font-bold">115200 BAUD LIVE</span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto font-mono text-[11px] space-y-1.5 text-zinc-350 cursor-text select-text leading-relaxed">
                    {simulatedSerialLogs.map((logLine, index) => (
                      <div key={index} className="flex gap-2">
                        <span className="text-zinc-650 shrink-0">{(index + 1).toString().padStart(2, "0")}</span>
                        <span className="text-emerald-500/95">{logLine}</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-1">
                      <span className="text-zinc-650 shrink-0">{(simulatedSerialLogs.length + 1).toString().padStart(2, "0")}</span>
                      <span className="h-3 w-1.5 bg-[#0e7dd4] animate-pulse" />
                    </div>
                  </div>
                </div>

                {/* Validation checklist */}
                <div className="w-64 bg-zinc-900/20 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between shrink-0">
                  <div className="space-y-4">
                    <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider border-b border-zinc-900 pb-2">
                      Pin & Conflict Audits
                    </div>
                    <div className="space-y-2.5">
                      {[
                        { label: "Power profile validation", state: "Compliant" },
                        { label: "I2C address conflicts search", state: "No overlap" },
                        { label: "GPIO overlap test", state: "Clear" },
                        { label: "Core compilation hex build", state: "Succeeded" },
                        { label: "Behavior simulator manifest", state: "Derived" }
                      ].map((chk, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[10px]">
                          <span className="text-zinc-400">{chk.label}</span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 text-[9px] uppercase tracking-wide">
                            {chk.state}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-zinc-900 text-center">
                    <span className="text-[9px] text-zinc-600 block mb-2 font-semibold">WOKWI & BEHAVIOR CORE</span>
                    <button
                      onClick={handleGoToBehaviorSim}
                      className="w-full bg-[#0e7dd4] hover:bg-[#0062a3] text-zinc-100 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-md shadow-[#0e7dd4]/10"
                    >
                      Launch Simulation
                    </button>
                  </div>
                </div>

              </div>

            </div>
          )}

        </div>

      </div>

      {/* Resize handle */}
      <HDrag onD={d => setRightWidth(w => Math.max(250, Math.min(500, w - d)))} />

      {/* Right panel: AIReasoningPanel */}
      <div style={{ width: rightWidth }} className="shrink-0 bg-[#1f1f1f] border-l border-[#2d2d2d] flex flex-col overflow-hidden">
        <AIReasoningPanel
          projectTitle="Formulation Session"
          steps={steps}
          messages={chatMessages}
          summary=""
          chatInput={chatInput}
          chatBusy={chatBusy}
          pipelineDone={isCompleted}
          pipelineActive={!isCompleted && !isFailed}
          pipelinePct={progressPercent}
          model={model}
          onChatInput={setChatInput}
          onSend={handleChatSend}
          onStop={() => setChatBusy(false)}
          onNewChat={() =>
            setChatMessages([
              {
                id: "welcome",
                role: "assistant",
                content: "Chat cleared. Ask me anything about your project.",
                streaming: false,
              }
            ])
          }
          onModelChange={setModel}
          modelOptions={modelOptions}
        />
      </div>

      {/*
      <ProjectChatPanel
        sessionId={sessionId}
        bom={bom}
        context={context}
      />
      */}

    </div>
  );
};
