import React, { useState } from "react";
import {
  Terminal,
  Cpu,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  HardDrive,
  PlayCircle,
  LayoutDashboard,
  Copy,
  Sparkles,
  // ??$$$ newer code
  Folder,
  File,
  ChevronDown,
  ChevronRight,
  Settings,
  Activity,
  Code,
  Layers,
  BookOpen
} from "lucide-react";
import { ProgressTracker } from "../panels/ProgressTracker";
import { AgentConsole } from "../panels/AgentConsole";
import { HardwareAssembly } from "../panels/HardwareAssembly";
import { MilestonesPanel } from "../panels/MilestonesPanel";
import { BomPanel } from "../panels/BomPanel";

interface FormulationPhaseProps {
  dark: boolean;
  // state
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
  // handlers
  handleRestart: () => void;
  handleGoToSimulator: () => void;
  handleExportLocal: () => void;
  handleCopyAllData: () => void;
  handleResume: () => void;
  handleRescue: () => void;
  resolveConflict: (choice: string) => void;
  // ??$$$ newer code - Behavior Sim handler
  handleGoToBehaviorSim: () => void;
  // ??$$$ newer code
  blueprint: any;
  requirementsDoc: string;
  setShowContextModal: (show: boolean) => void;
  sessionId: string | null;
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
  // ??$$$ newer code - Behavior Sim handler
  handleGoToBehaviorSim,
  // ??$$$ newer code
  blueprint,
  requirementsDoc,
  setShowContextModal,
  sessionId,
}) => {
  // ??$$$ newer code
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<"explorer" | "progress" | "rationale">("explorer");

  return (
    <div className="flex h-full w-full bg-[#1e1e1e] text-[#d4d4d4] font-mono text-xs overflow-hidden select-none">
      
      {/* VSCode Left Activity Bar */}
      <div className="w-12 shrink-0 bg-[#333333] border-r border-[#252526] flex flex-col justify-between items-center py-2 z-10">
        <div className="flex flex-col gap-4 w-full items-center">
          
          {/* Explorer tab button */}
          <button
            onClick={() => {
              setSidebarOpen(true);
              setSidebarTab("explorer");
            }}
            className={`relative p-2 rounded text-zinc-400 hover:text-white transition-colors ${
              sidebarOpen && sidebarTab === "explorer" ? "text-white bg-[#252526]" : ""
            }`}
          >
            <Folder className="w-5 h-5" />
            {sidebarOpen && sidebarTab === "explorer" && (
              <div className="absolute left-0 top-2 bottom-2 w-[2px] bg-[#007acc]" />
            )}
          </button>

          {/* Progress tab button */}
          <button
            onClick={() => {
              setSidebarOpen(true);
              setSidebarTab("progress");
            }}
            className={`relative p-2 rounded text-zinc-400 hover:text-white transition-colors ${
              sidebarOpen && sidebarTab === "progress" ? "text-white bg-[#252526]" : ""
            }`}
          >
            <Activity className="w-5 h-5" />
            {sidebarOpen && sidebarTab === "progress" && (
              <div className="absolute left-0 top-2 bottom-2 w-[2px] bg-[#007acc]" />
            )}
          </button>

          {/* Rationale tab button */}
          <button
            onClick={() => {
              setSidebarOpen(true);
              setSidebarTab("rationale");
            }}
            className={`relative p-2 rounded text-zinc-400 hover:text-white transition-colors ${
              sidebarOpen && sidebarTab === "rationale" ? "text-white bg-[#252526]" : ""
            }`}
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
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* VSCode Sidebar */}
      {sidebarOpen && (
        <div className="w-64 shrink-0 bg-[#252526] border-r border-[#2d2d2d] flex flex-col overflow-hidden text-zinc-400">
          
          {sidebarTab === "explorer" && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="h-9 flex items-center justify-between px-3 text-[10px] uppercase font-bold tracking-wider text-zinc-500 border-b border-[#2d2d2d]">
                <span>Explorer: Project BOM</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 select-text">
                
                {/* Project Constraints */}
                <div className="space-y-3">
                  <div className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider">Project Scope</div>
                  <div className="space-y-2.5">
                    {[
                      { label: "Brain", value: context.mcu },
                      { label: "Power", value: context.powerSource },
                      {
                        label: "Connectivity",
                        value: Array.isArray(context.connectivity)
                          ? context.connectivity.join(", ")
                          : context.connectivity
                      },
                      { label: "Form", value: context.formFactor },
                      { label: "Budget", value: context.estimatedBudget }
                    ]
                      .filter((f) => f.value && (typeof f.value !== "string" || f.value.trim() !== ""))
                      .map(({ label, value }) => (
                        <div key={label} className="border-b border-[#2d2d2d] pb-1.5">
                          <span className="text-[9px] text-[#007acc] uppercase font-bold">{label}: </span>
                          <span className="text-zinc-350 text-[10px]">{value}</span>
                        </div>
                      ))}
                    {!context.mcu && !context.powerSource && (
                      <div className="text-xs italic text-zinc-600">Extracting constraints...</div>
                    )}
                  </div>
                </div>

                {/* BOM Panel wrapper */}
                <div className="pt-2 border-t border-[#2d2d2d]">
                  <BomPanel bom={bom} candidates={candidates} dark={dark} />
                </div>
              </div>
            </div>
          )}

          {sidebarTab === "progress" && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="h-9 flex items-center justify-between px-3 text-[10px] uppercase font-bold tracking-wider text-zinc-500 border-b border-[#2d2d2d]">
                <span>Build Pipeline Tracker</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider mb-2">Stages Status</div>
                <ProgressTracker
                  isCompleted={isCompleted}
                  isFailed={isFailed}
                  activeStage={activeStage}
                  dark={dark}
                />
                <div className="border-t border-[#2d2d2d] pt-3 mt-4 space-y-2">
                  <div className="text-[9px] font-bold text-zinc-500 uppercase">Current Stage</div>
                  <div className="p-2 rounded bg-[#1e1e1e] border border-[#2d2d2d] text-white font-bold text-center">
                    {activeStage ? activeStage.toUpperCase() : "IDLE"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {sidebarTab === "rationale" && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="h-9 flex items-center justify-between px-3 text-[10px] uppercase font-bold tracking-wider text-zinc-500 border-b border-[#2d2d2d]">
                <span>AI Architectural Rationale</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 select-text">
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

      {/* Workspace Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#1e1e1e] relative">
        
        {/* Editor Tabs bar */}
        <div className="h-9 shrink-0 bg-[#2d2d2d] border-b border-[#1e1e1e] flex items-center justify-between px-2">
          <div className="flex items-center overflow-x-auto h-full">
            <button
              onClick={() => setWorkspaceTab("visual")}
              className={`h-full flex items-center gap-2 px-4 border-r border-[#1e1e1e] text-[11px] font-sans transition-colors ${
                workspaceTab === "visual"
                  ? "bg-[#1e1e1e] text-white border-t-2 border-[#007acc] font-semibold"
                  : "bg-[#2d2d2d] text-zinc-500 hover:bg-[#2b2b2b] hover:text-zinc-350"
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>assembly_preview.json</span>
            </button>
            
            <button
              onClick={() => setWorkspaceTab("console")}
              className={`h-full flex items-center gap-2 px-4 border-r border-[#1e1e1e] text-[11px] font-sans transition-colors ${
                workspaceTab === "console"
                  ? "bg-[#1e1e1e] text-white border-t-2 border-[#007acc] font-semibold"
                  : "bg-[#2d2d2d] text-zinc-500 hover:bg-[#2b2b2b] hover:text-zinc-350"
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>agent_console.log</span>
            </button>
          </div>

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

        {/* Panel Main Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {workspaceTab === "visual" ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              
              {/* Alert Card layouts */}
              {isCompleted && (
                <div className="rounded border border-emerald-500/35 bg-emerald-950/10 p-4 space-y-3 shadow-md">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                    <div>
                      <h4 className="text-xs font-bold text-white">Formulation Pipeline Completed Successfully!</h4>
                      <p className="text-[10px] text-zinc-450 mt-0.5">Firmware logic netlists and BOM sourcing compiled.</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      onClick={handleExportLocal}
                      disabled={exporting}
                      className="flex items-center gap-1.5 rounded bg-[#2d2d2d] border border-[#3c3c3c] hover:bg-[#333333] px-2.5 py-1 text-[10px] text-zinc-300 transition-all"
                    >
                      <HardDrive className="h-3 w-3 text-emerald-400" />
                      {exporting ? "Exporting..." : "Export to Local E:"}
                    </button>
                    <button
                      onClick={handleCopyAllData}
                      className="flex items-center gap-1.5 rounded bg-[#2d2d2d] border border-[#3c3c3c] hover:bg-[#333333] px-2.5 py-1 text-[10px] text-zinc-300 transition-all"
                    >
                      <Copy className="h-3 w-3 text-zinc-400" />
                      Copy Workspace Data
                    </button>
                    <button
                      onClick={handleGoToSimulator}
                      className="flex items-center gap-1.5 rounded bg-[#007acc] hover:bg-[#0062a3] px-3 py-1 text-[10px] text-white font-bold transition-all"
                    >
                      <PlayCircle className="h-3 w-3" />
                      Open 3D Simulator
                    </button>
                  </div>
                </div>
              )}

              {conflictDetails && (
                <div className="rounded border border-amber-500/35 bg-amber-950/10 p-4 space-y-3 shadow-md">
                  <div className="flex items-center gap-2 text-amber-400 font-bold">
                    <AlertTriangle className="h-4 w-4 animate-pulse" />
                    <span>{conflictDetails.title}</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed select-text">{conflictDetails.description}</p>
                  <div className="space-y-2 pt-1">
                    <div className="text-[9px] text-zinc-550 font-bold uppercase tracking-wider">Select Resolution Option:</div>
                    {conflictDetails.options.map((opt, idx) => (
                      <button
                        key={idx}
                        onClick={() => resolveConflict(opt)}
                        disabled={loading}
                        className="w-full text-left rounded bg-[#2d2d2d] hover:bg-[#37373d] border border-[#3c3c3c] p-2.5 text-[11px] text-zinc-300 transition-all active:scale-[0.99]"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isFailed && !isCompleted && !conflictDetails && (
                <div className="rounded border border-red-500/35 bg-red-950/10 p-4 space-y-3 shadow-md">
                  <div className="flex items-center gap-2 text-red-400 font-bold">
                    <AlertTriangle className="h-4 w-4" />
                    <span>AI Agent Interrupted</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">The formulation sequence halted. You can attempt to rescue the execution.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleResume}
                      disabled={loading || rescuing}
                      className="flex items-center gap-1 rounded bg-[#007acc] hover:bg-[#0062a3] px-3 py-1 text-[10px] text-white font-bold transition-all"
                    >
                      <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                      {loading ? "Resuming..." : "Resume Formulation"}
                    </button>
                    <button
                      onClick={handleRescue}
                      disabled={loading || rescuing}
                      className="flex items-center gap-1 rounded bg-amber-600 hover:bg-amber-500 px-3 py-1 text-[10px] text-zinc-950 font-bold transition-all"
                    >
                      <Cpu className="h-3 w-3" />
                      {rescuing ? "Rescuing..." : "API Rescue Link"}
                    </button>
                  </div>
                </div>
              )}

              {/* Hardware Preview Grid */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="space-y-2 p-3 bg-[#181818] rounded border border-[#2d2d2d]">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Hardware Assembly Preview</div>
                  <HardwareAssembly bom={bom} wiring={wiring} context={context} />
                </div>
                <div className="p-3 bg-[#181818] rounded border border-[#2d2d2d]">
                  <MilestonesPanel milestones={milestones} />
                </div>
              </div>

            </div>
          ) : (
            <div className="flex-1 overflow-hidden flex flex-col">
              <AgentConsole
                logs={logs}
                selectedLog={selectedLog}
                setSelectedLog={setSelectedLog}
                scrollContainerRef={scrollContainerRef}
                finalSketch={finalSketch}
                handleCopyAllData={handleCopyAllData}
              />
            </div>
          )}

          {/* Bottom Panel terminal activity log */}
          <div className="h-40 shrink-0 bg-[#1e1e1e] border-t border-[#2d2d2d] flex flex-col overflow-hidden">
            <div className="h-8 bg-[#2d2d2d] border-b border-[#1e1e1e] flex items-center justify-between px-4 text-[10px] text-zinc-400 select-none">
              <span className="font-bold text-zinc-550 uppercase">TERMINAL: Live AI Activity Log</span>
              {logs.some((l) => l.type === "thinking" || l.type === "tool_call") && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </div>
            
            <div className="flex-1 p-3 bg-black text-[#85e89d] font-mono text-[10px] overflow-y-auto space-y-1 select-text leading-normal">
              {logs.length === 0 ? (
                <div className="text-zinc-750 italic">Terminal idle. Sourcing thread listener inactive...</div>
              ) : (
                logs.slice(-20).map((log, i) => {
                  const timestampStr = log.timestamp
                    ? new Date(log.timestamp).toLocaleTimeString()
                    : "";
                  if (log.type === "thinking") {
                    return (
                      <div key={i} className="text-zinc-400 whitespace-pre-wrap">
                        <span className="text-zinc-650">[{timestampStr}]</span>{" "}
                        <span className="text-[#007acc] font-bold">THINK:</span> {log.text}
                      </div>
                    );
                  }
                  if (log.type === "tool_call") {
                    return (
                      <div key={i} className="text-zinc-350">
                        <span className="text-zinc-600">[{timestampStr}]</span>{" "}
                        <span className="text-amber-400 font-bold">TOOL INVOKE:</span> {log.name} ({log.status})
                      </div>
                    );
                  }
                  return null;
                })
              )}
            </div>
          </div>

        </div>

      </div>

      {/* VSCode-style Status Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-6 bg-[#007acc] text-white flex items-center justify-between px-3 text-[10px] z-20 select-none">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            <span>Formulating...</span>
          </div>
          <span>Active Stage: {activeStage ? activeStage.toUpperCase() : "SETUP"}</span>
          <span>BOM Size: {bom.length} items</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Target MCU: {context.mcu || "Detecting..."}</span>
          <span>Logs: {logs.length}</span>
          <span>UTF-8</span>
          <span>JSON Context</span>
        </div>
      </div>

    </div>
  );
};
