// ??$$$ group 2 - Ideation Stage (Phase 1)
// ??$$$ NEW FLOW
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { axiosInstance } from "../lib/axios";
// ??$$$ old code
// import { X, Send, Play, Terminal, Cpu, Database, Layers, CheckCircle, AlertTriangle, RefreshCw, EyeOff, Eye } from "lucide-react";
// ??$$$ newer code
import { X, Send, Play, Terminal, Cpu, Database, Layers, CheckCircle, AlertTriangle, RefreshCw, EyeOff, Eye, HardDrive, PlayCircle, LayoutDashboard, Braces, Code, Copy, ChevronRight, ChevronDown, BookOpen } from "lucide-react";
import toast from "react-hot-toast";

// ??$$$ NEW FLOW — Beautiful countdown timer component for rate limit pauses
const RateLimitTimer: React.FC<{ delaySeconds: number; timestamp: string }> = ({ delaySeconds, timestamp }) => {
  const targetTime = useMemo(() => {
    const start = timestamp ? new Date(timestamp).getTime() : Date.now();
    return start + (delaySeconds || 60) * 1000;
  }, [delaySeconds, timestamp]);

  const [timeLeft, setTimeLeft] = useState(() => Math.max(0, Math.ceil((targetTime - Date.now()) / 1000)));

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((targetTime - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [targetTime]);

  const percentage = delaySeconds ? (timeLeft / delaySeconds) * 100 : 0;

  return (
    <div className="p-5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-400 max-w-2xl flex flex-col gap-3">
      <div className="flex items-center gap-2 font-bold text-xs">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
        </span>
        <span>Groq API Rate Limit Exceeded — formulation pipeline is temporarily paused</span>
      </div>

      <div className="flex items-center gap-4 pt-1">
        <div className="text-xl font-mono font-black tracking-wider text-amber-500 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
          {Math.floor(timeLeft / 60)}m {timeLeft % 60}s
        </div>
        <div className="flex-1 space-y-1.5">
          <p className="text-xs text-zinc-300 leading-relaxed">
            {timeLeft > 0
              ? "We are waiting for the API reset window to clear. Formulation will automatically resume. Do not close this modal."
              : "API limit cooldown cleared! Resuming formulation pipeline..."}
          </p>
          <div className="h-1.5 w-full bg-zinc-800/80 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-1000"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};// ??$$$ newer code - MilestoneCard component
const MilestoneCard: React.FC<{ m: any; idx: number }> = ({ m, idx }) => {
  const [expanded, setExpanded] = useState(false);
  const [showCode, setShowCode] = useState(false);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 overflow-hidden transition-all duration-300">
      <div
        onClick={() => setExpanded(!expanded)}
        className="p-4 flex justify-between items-center cursor-pointer hover:bg-zinc-900/30 select-none"
      >
        <div className="flex gap-3 items-center">
          <div className="h-6 w-6 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-400 font-bold text-xs flex items-center justify-center">
            {idx + 1}
          </div>
          <div>
            <div className="text-xs font-bold text-zinc-150">{m.title}</div>
            <div className="text-[10px] text-zinc-500">{m.objective || "Milestone objective"}</div>
          </div>
        </div>
        <span className="text-[10px] text-zinc-500 font-mono">{expanded ? "COLLAPSE" : "EXPAND"}</span>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-zinc-800/50 space-y-3 text-[11px] text-zinc-300 leading-relaxed font-sans">
          <div>
            <span className="text-zinc-500 font-bold uppercase text-[9px] tracking-wider block mb-0.5 font-mono">Overview</span>
            <p className="text-zinc-400">{m.explanation || "No detailed explanation generated."}</p>
          </div>

          {m.wiringInstructions && (
            <div>
              <span className="text-zinc-500 font-bold uppercase text-[9px] tracking-wider block mb-0.5 font-mono">Wiring</span>
              <pre className="font-mono bg-zinc-950/60 p-2 rounded border border-zinc-900 text-zinc-400 overflow-x-auto text-[10px]">
                {m.wiringInstructions}
              </pre>
            </div>
          )}

          {(m.expectedOutput || m.passCondition) && (
            <div>
              <span className="text-zinc-500 font-bold uppercase text-[9px] tracking-wider block mb-0.5 font-mono">Testing</span>
              <div className="space-y-1 bg-zinc-900/30 p-2 rounded border border-zinc-850">
                {m.expectedOutput && (
                  <div>
                    <span className="text-zinc-500">Expected:</span> {m.expectedOutput}
                  </div>
                )}
                {m.passCondition && (
                  <div>
                    <span className="text-zinc-500">Pass:</span> {m.passCondition}
                  </div>
                )}
              </div>
            </div>
          )}

          {m.code && (
            <div className="pt-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCode(!showCode);
                }}
                className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors"
              >
                {showCode ? "Hide Firmware Code" : "Open Full Code"}
              </button>
              {showCode && (
                <pre className="mt-2 font-mono text-[10px] bg-black/60 p-3 rounded border border-zinc-900 text-zinc-300 overflow-x-auto max-h-48 cursor-text">
                  <code>{m.code}</code>
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface DiscoveryModalProps {
  initialIdea?: string;
  projectId?: string;
  initialPhase?: 1 | 2;
  onClose: () => void;
}

export const DiscoveryModal: React.FC<DiscoveryModalProps> = ({
  initialIdea = "",
  projectId,
  initialPhase,
  onClose
}) => {
  const navigate = useNavigate();
  const virtualPlaygroundUrl = (import.meta.env.VITE_VIRTUAL_PLAYGROUND_URL || "http://localhost:5174").replace(/\/$/, "");
  // ??$$$ NEW FLOW
  const [model, setModel] = useState("meta-llama/llama-4-scout-17b-16e-instruct");
  // ??$$$ newer code - hybrid primary provider selection
  const [hybridPrimary, setHybridPrimary] = useState("meta-llama/llama-4-scout-17b-16e-instruct");
  const [phase, setPhase] = useState<1 | 2>(1);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false); // ??$$$ newer code - track if discovery has started
  const [submitting, setSubmitting] = useState(false);
  // ??$$$ NEW FLOW
  const [restarting, setRestarting] = useState(false);
  // ??$$$ NEW FLOW
  const [shouldAutoFormulate, setShouldAutoFormulate] = useState(false);

  // Phase 1 (Discovery) State
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [answerText, setAnswerText] = useState("");
  const [context, setContext] = useState<any>({
    corePurpose: "",
    mcu: "",
    subsystems: [],
    constraints: [],
    powerSource: "",
    connectivity: "",
    openQuestions: []
  });

  // Phase 2 (Formulation) State
  const [activeTab, setActiveTab] = useState<"thinking" | "tools">("thinking");
  const [logs, setLogs] = useState<any[]>([]);
  const [bom, setBom] = useState<any[]>([]);
  const [wiring, setWiring] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  // ??$$$ newer code — Completion & local export states
  const [isCompleted, setIsCompleted] = useState(false);
  const [completedProjectId, setCompletedProjectId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [isFailed, setIsFailed] = useState(false); // ??$$$ newer code
  const [rescuing, setRescuing] = useState(false); // ??$$$ newer code - API rescue state
  // ??$$$ newer code
  const [workspaceTab, setWorkspaceTab] = useState<"visual" | "console">("visual");
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [finalSketch, setFinalSketch] = useState<string>("");

  const socketRef = useRef<Socket | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);
  // ??$$$ NEW FLOW
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // ??$$$ newer code — Visual Progress Calculations
  const progressPercent = useMemo(() => {
    if (isCompleted) return 100;
    if (isFailed) return 0;

    let base = 5;
    if (bom && bom.length > 0) {
      base = 25;
      if (wiring && wiring.length > 0) {
        base = 50;
        if (milestones && milestones.length > 0) {
          base = 75;
          if (logs.some(l => l.type === "tool_call" && l.name === "generate_diagram_json" && l.status === "done")) {
            base = 90;
          }
        }
      }
    }
    return base;
  }, [bom, wiring, milestones, logs, isCompleted, isFailed]);

  const progressStatus = useMemo(() => {
    if (isCompleted) return "Formulation completed successfully!";
    if (isFailed) return "Formulation paused/interrupted.";

    if (progressPercent === 5) return "Discovering and sourcing components...";
    if (progressPercent === 25) return "Generating wiring connection matrix...";
    if (progressPercent === 50) return "Structuring code milestones and test parameters...";
    if (progressPercent === 75) return "Mapping Wokwi schematic layout and diagrams...";
    if (progressPercent === 90) return "Finalizing formulation payload...";
    return "Initializing formulation assistant...";
  }, [progressPercent, isCompleted, isFailed]);

  // ??$$$ newer code - Derived UI states for candidates, reasoning, active pipeline stage, and conflicts
  const candidates = useMemo(() => {
    const searchLogs = logs.filter(l => l.type === "tool_call" && l.name === "search_library" && l.status === "done");
    const foundParts = new Set<string>();
    searchLogs.forEach(l => {
      const results = l.output;
      if (Array.isArray(results)) {
        results.forEach((r: any) => {
          if (r.mpn) foundParts.add(r.mpn);
        });
      }
    });
    const bomMpns = new Set(bom.map(b => b.mpn));
    return Array.from(foundParts).filter(p => !bomMpns.has(p)).slice(0, 4);
  }, [logs, bom]);

  const decisions = useMemo(() => {
    const reasoningLogs = logs.filter(l => l.type === "thinking" || l.type === "decision");
    const extracted: string[] = [];
    reasoningLogs.forEach(l => {
      const text = l.text || "";
      const lines = text.split("\n");
      lines.forEach((line: string) => {
        const clean = line.trim();
        if (
          clean.toLowerCase().includes("selected") ||
          clean.toLowerCase().includes("choose") ||
          clean.toLowerCase().includes("because") ||
          clean.toLowerCase().includes("rejected")
        ) {
          const bulletFree = clean.replace(/^[\s\-\*\d\.\✓\?]+/, "").trim();
          if (bulletFree.length > 10 && bulletFree.length < 150) {
            extracted.push(bulletFree);
          }
        }
      });
    });
    return Array.from(new Set(extracted)).slice(0, 3);
  }, [logs]);

  const activeStage = useMemo(() => {
    if (isCompleted) return "curriculum";
    if (isFailed) return "validation";
    const latestTool = [...logs].reverse().find(l => l.type === "tool_call" && l.status === "running");
    if (latestTool) {
      if (latestTool.name === "search_library" || latestTool.name === "get_component_details") {
        return "components";
      }
      if (latestTool.name === "generate_wiring" || latestTool.name === "validate_wiring") {
        return "wiring";
      }
      if (latestTool.name === "generate_milestones" || latestTool.name === "generate_milestone") {
        return "curriculum";
      }
    }
    if (bom.length === 0) return "components";
    if (wiring.length === 0) return "wiring";
    if (milestones.length === 0) return "curriculum";
    return "validation";
  }, [logs, bom, wiring, milestones, isCompleted, isFailed]);

  const conflictDetails = useMemo(() => {
    const errorLog = logs.find(l => l.type === "error" || (l.type === "tool_call" && l.status === "failed"));
    if (errorLog) {
      const msg = (errorLog.text || JSON.stringify(errorLog.output) || "").toLowerCase();
      if (msg.includes("conflict") || msg.includes("constraint") || msg.includes("power") || msg.includes("limit")) {
        return {
          title: "Constraint Conflict Detected",
          description: errorLog.text || "The formulation agent detected conflicting requirements in your constraints (e.g. WiFi connectivity vs low battery life targets).",
          options: [
            "Optimize for low power (reduce WiFi updates)",
            "Increase battery capacity spec",
            "Change to low power BLE connectivity"
          ]
        };
      }
    }
    return null;
  }, [logs]);

  const resolveConflict = async (choice: string) => {
    setLoading(true);
    try {
      toast.success(`Conflict resolved: ${choice}. Restarting formulation...`);
      await axiosInstance.post("/new-flow/restart", {
        sessionId,
        context: {
          ...context,
          constraints: [...(context.constraints || []), `Resolved conflict by choosing: ${choice}`]
        },
        model
      });
    } catch (e) {
      toast.error("Failed to submit conflict resolution.");
    } finally {
      setLoading(false);
    }
  };

  const renderInspectorContent = () => {
    if (!selectedLog) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
          <Braces className="h-10 w-10 text-zinc-600 animate-pulse" />
          <h5 className="text-zinc-400 font-bold">Log Inspector</h5>
          <p className="text-[11px] text-zinc-500 max-w-xs leading-relaxed">
            Select any entry from the execution log feed on the left to inspect its input arguments, database updates, and response outputs.
          </p>
        </div>
      );
    }

    if (selectedLog.type === "code") {
      return (
        <div>
          <div className="flex justify-between items-center text-zinc-500 text-[10px] border-b border-zinc-800 pb-2 mb-3">
            <span>INTEGRATED ARDUINO SKETCH (.INO)</span>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(selectedLog.text);
                toast.success("Sketch copied to clipboard!");
              }}
              className="flex items-center gap-1 hover:text-zinc-300 transition-colors font-bold"
            >
              <Copy className="h-3 w-3" /> Copy Sketch
            </button>
          </div>
          <pre className="bg-zinc-950/80 p-4 rounded-lg border border-zinc-900/60 text-zinc-200 overflow-x-auto text-[11px] leading-relaxed cursor-text select-text">
            <code>{selectedLog.text}</code>
          </pre>
        </div>
      );
    }

    if (selectedLog.type === "thinking") {
      return (
        <div>
          <div className="flex justify-between items-center text-zinc-500 text-[10px] border-b border-zinc-800 pb-2 mb-3">
            <span>AI CHAIN OF THOUGHT</span>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(selectedLog.text);
                toast.success("Chain of thought copied!");
              }}
              className="flex items-center gap-1 hover:text-zinc-300 transition-colors font-bold"
            >
              <Copy className="h-3 w-3" /> Copy
            </button>
          </div>
          <div className="text-zinc-300 leading-relaxed whitespace-pre-wrap font-sans text-xs">
            {selectedLog.text}
          </div>
        </div>
      );
    }

    if (selectedLog.type === "tool_call") {
      return (
        <div className="space-y-4">
          <div>
            <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2 font-mono flex justify-between items-center">
              <span>Input Parameters</span>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(selectedLog.input, null, 2));
                  toast.success("Input arguments copied!");
                }}
                className="flex items-center gap-1 text-zinc-500 hover:text-zinc-300 transition-colors normal-case font-normal"
              >
                <Copy className="h-2.5 w-2.5" /> Copy JSON
              </button>
            </div>
            <pre className="bg-zinc-950 p-3 rounded-lg border border-zinc-900 text-blue-300 overflow-x-auto text-[11px]">
              {selectedLog.input ? JSON.stringify(selectedLog.input, null, 2) : "No inputs provided"}
            </pre>
          </div>
          <div>
            <div className="text-[10px] text-zinc-550 font-bold uppercase tracking-wider mb-2 font-mono flex justify-between items-center">
              <span>Output Response</span>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(selectedLog.output, null, 2));
                  toast.success("Output response copied!");
                }}
                className="flex items-center gap-1 text-zinc-500 hover:text-zinc-300 transition-colors normal-case font-normal"
              >
                <Copy className="h-2.5 w-2.5" /> Copy JSON
              </button>
            </div>
            <pre className="bg-zinc-950 p-3 rounded-lg border border-zinc-900 text-emerald-300 overflow-x-auto text-[11px]">
              {selectedLog.output ? JSON.stringify(selectedLog.output, null, 2) : "Execution in progress..."}
            </pre>
          </div>
        </div>
      );
    }

    return (
      <div>
        <div className="flex justify-between items-center text-zinc-550 text-[10px] border-b border-zinc-800 pb-2 mb-3">
          <span>EVENT DETAILS</span>
          <button 
            onClick={() => {
              navigator.clipboard.writeText(selectedLog.text || JSON.stringify(selectedLog.input || selectedLog.output || {}, null, 2));
              toast.success("Event details copied!");
            }}
            className="flex items-center gap-1 hover:text-zinc-300 transition-colors font-bold"
          >
            <Copy className="h-3 w-3" /> Copy
          </button>
        </div>
        <p className="text-zinc-300 leading-relaxed font-sans text-xs">{selectedLog.text}</p>
        {(selectedLog.input || selectedLog.output) && (
          <pre className="bg-zinc-950 p-3 mt-3 rounded-lg border border-zinc-900 text-zinc-400 overflow-x-auto text-[11px]">
            {JSON.stringify(selectedLog.input || selectedLog.output, null, 2)}
          </pre>
        )}
      </div>
    );
  };

  const renderStepper = () => {
    const stages = [
      { key: "requirements", label: "Requirements Analyzed" },
      { key: "components", label: "Component Selection" },
      { key: "wiring", label: "Wiring Design" },
      { key: "validation", label: "Wiring & Pin Validation" },
      { key: "curriculum", label: "Curriculum Generation" }
    ];

    return (
      <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] items-center">
        {stages.map((stage, idx) => {
          let status = "upcoming";
          if (isCompleted) {
            status = "done";
          } else if (isFailed && stage.key === activeStage) {
            status = "failed";
          } else if (stage.key === activeStage) {
            status = "active";
          } else {
            const stageOrder = ["requirements", "components", "wiring", "validation", "curriculum"];
            const currentIdx = stageOrder.indexOf(activeStage);
            const thisIdx = stageOrder.indexOf(stage.key);
            if (thisIdx < currentIdx) {
              status = "done";
            }
          }

          return (
            <div key={stage.key} className="flex items-center gap-1">
              {idx > 0 && <span className="text-zinc-700 mr-1">→</span>}
              {status === "done" && <span className="text-emerald-500 font-bold">✓</span>}
              {status === "active" && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
                </span>
              )}
              {status === "upcoming" && <span className="text-zinc-650">○</span>}
              {status === "failed" && <span className="text-red-500">⚠</span>}
              <span className={status === "active" ? "text-zinc-100 font-bold" : status === "done" ? "text-zinc-400" : "text-zinc-600"}>
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderHardwareAssembly = () => {
    return (
      <div className="border border-zinc-800 bg-zinc-900/10 rounded-xl p-6 min-h-[220px] flex flex-col justify-between">
        <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-4 flex justify-between items-center select-none">
          <span>Live Assembly Canvas</span>
          <span className="text-zinc-400">Total BOM Parts: {bom.length}</span>
        </div>

        {bom.length === 0 ? (
          <div className="flex-grow flex items-center justify-center text-zinc-600 text-xs italic py-10">
            Waiting for agent to source components...
          </div>
        ) : (
          <div className="flex-grow flex flex-col sm:flex-row gap-6 items-center justify-around py-2 w-full">
            {/* Compute Brain (ESP32/MCU) */}
            <div className="flex flex-col items-center gap-2 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 min-w-[120px] shadow-lg shadow-blue-500/5 select-none">
              <Cpu className="h-6 w-6 text-blue-400" />
              <div className="text-xs font-bold text-zinc-200">MCU</div>
              <div className="text-[9px] text-zinc-400 font-mono">{context.mcu || "ESP32"}</div>
            </div>

            {/* Connection Vectors */}
            <div className="flex-1 max-w-[200px] flex flex-col gap-2 font-mono text-[9px] text-zinc-500 border-y border-dashed border-zinc-800 py-3 w-full select-none">
              {wiring.length === 0 ? (
                bom.filter(b => b.key !== "mcu" && b.key !== "brain").map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-zinc-600 italic">
                    <span>mcu</span>
                    <span className="text-zinc-700 animate-pulse">- - - -</span>
                    <span>{item.key}</span>
                  </div>
                ))
              ) : (
                wiring.slice(0, 5).map((w, idx) => (
                  <div key={idx} className="flex justify-between items-center">
                    <span className="text-blue-400">{w.from.split(".")[1] || w.from}</span>
                    <span className="text-zinc-750 font-sans">════</span>
                    <span className="text-emerald-450">{w.to.split(".")[0] || w.to}</span>
                  </div>
                ))
              )}
              {wiring.length > 5 && (
                <div className="text-center text-[8px] text-zinc-650 italic pt-1 border-t border-zinc-900/60">
                  +{wiring.length - 5} more connections active
                </div>
              )}
            </div>

            {/* Connected Subsystems */}
            <div className="flex flex-col gap-2.5 min-w-[150px]">
              {bom.filter(b => b.key !== "mcu" && b.key !== "brain").length === 0 ? (
                <div className="text-zinc-650 text-[10px] italic select-none">No peripheral components added.</div>
              ) : (
                bom.filter(b => b.key !== "mcu" && b.key !== "brain").map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-zinc-850 bg-zinc-900/25 select-none">
                    <Database className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-zinc-300 truncate">{item.displayName}</div>
                      <div className="text-[9px] text-zinc-500 truncate font-mono">{item.purpose}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Setup Socket URL
  const getSocketUrl = () => {
    const envUrl = import.meta.env.VITE_API_URL || "";
    if (envUrl) {
      return envUrl.replace(/\/api$/, "");
    }
    return window.location.hostname === "localhost" ? "http://localhost:5000" : "";
  };

  // Auto-scroll logs
  // ??$$$ NEW FLOW
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      const threshold = 150; // pixels from bottom
      const isNearBottom = container.scrollHeight - container.clientHeight - container.scrollTop < threshold;
      if (isNearBottom) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [logs]);

  // Start discovery session on mount
  // ??$$$ NEW FLOW
  // ??$$$ old code
  /*
  useEffect(() => {
    const startSession = async () => {
      setLoading(true);
      try {
        if (projectId) {
          ...
        } else {
          // Start brand new session
          const res = await axiosInstance.post("/new-flow/start", {
            idea: initialIdea,
            model
          });
          setSessionId(res.data.sessionId);
          setQuestion(res.data.question);
          setOptions(res.data.options || []);
          setContext(res.data.context || {});
          setShouldAutoFormulate(true);
          if (res.data.done) {
            handleProceed();
          }
        }
      } catch (err: any) {
        toast.error("Failed to initiate agent session.");
        onClose();
      } finally {
        setLoading(false);
      }
    };
    startSession();
  }, [projectId]);
  */

  // ??$$$ newer code — start discovery session on mount supporting localStorage caching & restore on reload
  useEffect(() => {
    const startSession = async () => {
      setLoading(true);
      try {
        if (projectId) {
          // Resume existing project session
          const res = await axiosInstance.get(`/new-flow/project-session/${projectId}`);
          setSessionId(res.data._id);
          setQuestion(res.data.question || "");
          setOptions(res.data.options || []);
          setContext(res.data.context || {});
          setBom(res.data.bom || []);
          setWiring(res.data.wiring || []);
          setMilestones(res.data.milestones || []);
          setLogs(res.data.agentLog || []);
          setStarted(true); // ??$$$ newer code - mark as started

          /* old code
          if (res.data.phase2Complete) {
            setIsCompleted(true);
            setCompletedProjectId(projectId);
          }

          if (initialPhase) {
            setPhase(initialPhase);
            if (initialPhase === 2 && (!res.data.agentLog || res.data.agentLog.length === 0)) {
              setShouldAutoFormulate(true);
            } else {
              setShouldAutoFormulate(false);
            }
          } else {
            const nextPhase = res.data.phase1Complete ? 2 : 1;
            setPhase(nextPhase);
            if (nextPhase === 2 && (!res.data.agentLog || res.data.agentLog.length === 0)) {
              setShouldAutoFormulate(true);
            } else {
              setShouldAutoFormulate(false);
            }
          }
          */

          // ??$$$ newer code - force Phase 2 if phase2Complete is true to show the completion view correctly
          if (res.data.phase2Complete) {
            setIsCompleted(true);
            setCompletedProjectId(projectId);
            setPhase(2);
            setShouldAutoFormulate(false);
          } else {
            if (initialPhase) {
              setPhase(initialPhase);
              if (initialPhase === 2 && (!res.data.agentLog || res.data.agentLog.length === 0)) {
                setShouldAutoFormulate(true);
              } else {
                setShouldAutoFormulate(false);
              }
            } else {
              const nextPhase = res.data.phase1Complete ? 2 : 1;
              setPhase(nextPhase);
              if (nextPhase === 2 && (!res.data.agentLog || res.data.agentLog.length === 0)) {
                setShouldAutoFormulate(true);
              } else {
                setShouldAutoFormulate(false);
              }
            }
          }
        } else {
          // Try to resume from cached localStorage session first
          const cachedSessionId = localStorage.getItem("wireup_discovery_session_id");
          if (cachedSessionId) {
            try {
              const res = await axiosInstance.get(`/new-flow/session/${cachedSessionId}`);
              const ideaMatch = res.data.idea?.trim().toLowerCase() === initialIdea?.trim().toLowerCase();
              if (ideaMatch) {
                setSessionId(res.data._id);
                setQuestion(res.data.question || "");
                setOptions(res.data.options || []);
                setContext(res.data.context || {});
                setBom(res.data.bom || []);
                setWiring(res.data.wiring || []);
                setMilestones(res.data.milestones || []);
                setLogs(res.data.agentLog || []);
                if (res.data.finalSketch) setFinalSketch(res.data.finalSketch);
                setStarted(true); // ??$$$ newer code - mark as started
                /* old code
                if (res.data.phase2Complete) {
                  setIsCompleted(true);
                  if (res.data.projectId) {
                    setCompletedProjectId(res.data.projectId);
                  }
                }
                const nextPhase = res.data.phase1Complete ? 2 : 1;
                setPhase(nextPhase);
                if (nextPhase === 2 && (!res.data.agentLog || res.data.agentLog.length === 0)) {
                  setShouldAutoFormulate(true);
                } else {
                  setShouldAutoFormulate(false);
                }
                */

                // ??$$$ newer code - force Phase 2 if phase2Complete is true to show completion view correctly
                if (res.data.phase2Complete) {
                  setIsCompleted(true);
                  setPhase(2);
                  setShouldAutoFormulate(false);
                  if (res.data.projectId) {
                    setCompletedProjectId(res.data.projectId);
                  }
                } else {
                  const nextPhase = res.data.phase1Complete ? 2 : 1;
                  setPhase(nextPhase);
                  if (nextPhase === 2 && (!res.data.agentLog || res.data.agentLog.length === 0)) {
                    setShouldAutoFormulate(true);
                  } else {
                    setShouldAutoFormulate(false);
                  }
                }
                setLoading(false);
                return;
              }
            } catch (err) {
              console.error("Failed to restore cached session:", err);
              localStorage.removeItem("wireup_discovery_session_id");
            }
          }

          // ??$$$ newer code - don't start brand new session automatically, let user select AI first
          setStarted(false);
        }
      } catch (err: any) {
        toast.error("Failed to initiate agent session.");
        onClose();
      } finally {
        setLoading(false);
      }
    };
    startSession();
  }, [projectId]);

  // ??$$$ newer code — Handle starting a brand new session with selected model
  const handleStartSession = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.post("/new-flow/start", {
        idea: initialIdea,
        // ??$$$ newer code - send hybridPrimary as the model value when hybrid mode, else send model directly
        model: model === "hybrid" ? `hybrid:${hybridPrimary}` : model
      });

      setSessionId(res.data.sessionId);
      localStorage.setItem("wireup_discovery_session_id", res.data.sessionId);
      setQuestion(res.data.question);
      setOptions(res.data.options || []);
      setContext(res.data.context || {});
      setStarted(true);
      setShouldAutoFormulate(true);
      if (res.data.done) {
        handleProceed();
      }
    } catch (err: any) {
      toast.error("Failed to initiate agent session.");
    } finally {
      setLoading(false);
    }
  };

  // Socket connection for Phase 2
  // ??$$$ NEW FLOW
  useEffect(() => {
    if (phase === 2 && sessionId) {
      const socketUrl = getSocketUrl();
      const socket = io(socketUrl, { withCredentials: true });
      socketRef.current = socket;

      socket.emit("join", sessionId);

      socket.on("agent2:log", (logItem: any) => {
        setLogs(prev => [...prev, logItem]);
      });

      socket.on("agent2:bom_update", (data: any) => {
        if (data.bom) setBom(data.bom);
      });

      socket.on("agent2:wiring_update", (data: any) => {
        if (data.wiring) setWiring(data.wiring);
      });

      socket.on("agent2:milestone_update", (data: any) => {
        if (data.milestones) setMilestones(data.milestones);
      });

      // ??$$$ old code
      /*
      socket.on("agent2:complete", (data: any) => {
        toast.success("Project formulation complete!");
        if (data.projectId) {
          navigate(`/project/${data.projectId}/build?tab=simulator&view=3d`);
        } else {
          onClose();
        }
      });
      */

      /* old code
      // ??$$$ newer code — Handle socket complete without auto-redirecting
      socket.on("agent2:complete", (data: any) => {
        toast.success("Project formulation complete!");
        setIsCompleted(true);
        setIsFailed(false); // ??$$$ newer code
        if (data.projectId) {
          setCompletedProjectId(data.projectId);
        }
      });
      */
      // ??$$$
      socket.on("agent2:final_sketch_update", (data: any) => {
        if (data.finalSketch) setFinalSketch(data.finalSketch);
      });

      socket.on("agent2:complete", (data: any) => {
        toast.success("Project formulation complete!");
        setIsCompleted(true);
        setIsFailed(false);
        if (data.projectId) {
          setCompletedProjectId(data.projectId);
        }
        if (data.finalSketch) {
          setFinalSketch(data.finalSketch);
        }
      });

      // ??$$$ newer code — Handle socket error and resume listeners
      socket.on("agent2:error", (data: any) => {
        toast.error(data.message || "An error occurred during formulation.");
        setIsFailed(true);
      });

      socket.on("agent2:resumed", (data: any) => {
        toast.success("Formulation resumed!");
        setIsFailed(false);
      });

      socket.on("agent2:model_changed", (data: any) => {
        // ??$$$ newer code - update dropdown model name, alert the user, and beep!
        if (data.model) {
          setModel(data.model);
          /* old code
          toast.info(`Agent failed over to fallback: ${data.model}`);
          */
          // ??$$$ newer code
          toast(`Agent failed over to fallback: ${data.model}`);

          // Beep once using Web Audio API
          try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
              const audioCtx = new AudioContextClass();
              const oscillator = audioCtx.createOscillator();
              const gainNode = audioCtx.createGain();

              oscillator.connect(gainNode);
              gainNode.connect(audioCtx.destination);

              oscillator.type = "sine";
              oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // 440Hz (A4 note)
              gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);

              oscillator.start();
              oscillator.stop(audioCtx.currentTime + 0.15); // beep for 150ms
            }
          } catch (e) {
            console.error("Audio Context beep failed:", e);
          }
        }
      });

      socket.on("disconnect", () => {
        console.warn("[DiscoveryModal] Socket disconnected.");
        setIsFailed(true);
      });

      socket.on("connect_error", () => {
        console.error("[DiscoveryModal] Socket connection error.");
        setIsFailed(true);
      });

      // Trigger formulation trigger call
      const triggerFormulation = async () => {
        if (!shouldAutoFormulate) return;
        setShouldAutoFormulate(false);
        try {
          await axiosInstance.post("/new-flow/formulate", { sessionId });
        } catch (err) {
          toast.error("Failed to start automated formulation.");
        }
      };
      triggerFormulation();

      return () => {
        socket.disconnect();
      };
    }
  }, [phase, sessionId, shouldAutoFormulate]);

  // ??$$$ newer code — Fallback polling for session completion (every 5 seconds)
  useEffect(() => {
    if (!sessionId || isCompleted || phase !== 2) return;

    const interval = setInterval(async () => {
      try {
        const res = await axiosInstance.get(`/new-flow/session/${sessionId}`);
        if (res.data.phase2Complete) {
          setIsCompleted(true);
          setIsFailed(false);
          if (res.data.projectId) {
            setCompletedProjectId(res.data.projectId);
          }
          // Sync final session updates
          if (res.data.bom) setBom(res.data.bom);
          if (res.data.wiring) setWiring(res.data.wiring);
          if (res.data.milestones) setMilestones(res.data.milestones);
          if (res.data.agentLog) setLogs(res.data.agentLog);
          if (res.data.finalSketch) setFinalSketch(res.data.finalSketch);
          clearInterval(interval);
        } else {
          // Sync live finalSketch if generated during runtime
          if (res.data.finalSketch) setFinalSketch(res.data.finalSketch);
          // Sync live logs/bom/wiring/milestones occasionally
          if (res.data.bom) setBom(res.data.bom);
          if (res.data.wiring) setWiring(res.data.wiring);
          if (res.data.milestones) setMilestones(res.data.milestones);
          if (res.data.agentLog) setLogs(res.data.agentLog);
        }
      } catch (err) {
        console.error("Fallback polling failed:", err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [sessionId, isCompleted, phase]);

  // Submit Answer (Phase 1)
  const handleAnswer = async (selectedAnswer: string) => {
    if (submitting || !sessionId) return;
    setSubmitting(true);
    try {
      const res = await axiosInstance.post("/new-flow/answer", {
        sessionId,
        answer: selectedAnswer,
        currentQuestion: question,
        currentOptions: options
      });
      setQuestion(res.data.question);
      setOptions(res.data.options || []);
      setContext(res.data.context || {});
      setAnswerText("");
      if (res.data.done) {
        setPhase(2);
      }
    } catch (err: any) {
      toast.error("Failed to send answer.");
    } finally {
      setSubmitting(false);
    }
  };

  // Proceed directly to Phase 2 (Skip questions)
  // ??$$$ old code
  /*
  const handleProceed = async () => {
    if (submitting || !sessionId) return;
    setSubmitting(true);
    try {
      await axiosInstance.post("/new-flow/proceed", { sessionId });
      setPhase(2);
    } catch (err: any) {
      toast.error("Failed to skip discovery.");
    } finally {
      setSubmitting(false);
    }
  };
  */

  // ??$$$ newer code — Handle proceed (skip Q&A and auto-start formulation, preserving unsent inputs)
  const handleProceed = async () => {
    if (submitting || !sessionId) return;
    setSubmitting(true);
    try {
      // If user typed an answer, submit it first to store as many answered questions as possible
      if (answerText.trim()) {
        try {
          const answerRes = await axiosInstance.post("/new-flow/answer", {
            sessionId,
            answer: answerText,
            currentQuestion: question,
            currentOptions: options
          });
          setQuestion(answerRes.data.question);
          setOptions(answerRes.data.options || []);
          setContext(answerRes.data.context || {});
          setAnswerText("");
        } catch (e) {
          console.error("Failed to submit final typed answer before skipping:", e);
        }
      }
      const res = await axiosInstance.post("/new-flow/proceed", { sessionId });
      if (res.data && res.data.context) {
        setContext(res.data.context);
      }
      setPhase(2);
      setShouldAutoFormulate(true);
    } catch (err: any) {
      toast.error("Failed to skip discovery.");
    } finally {
      setSubmitting(false);
    }
  };

  // ??$$$ newer code — Export data to local drive E:
  const handleExportLocal = async () => {
    if (!sessionId) return;
    setExporting(true);
    try {
      const res = await axiosInstance.post("/new-flow/export-local", { sessionId });
      toast.success(res.data.message || "Successfully exported to E: drive!");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to export data locally.");
    } finally {
      setExporting(false);
    }
  };

  // ??$$$ newer code — Copy all logs, inputs, outputs, thoughts and code
  const handleCopyAllData = () => {
    try {
      let text = `# WIREUP.AI - AI FORMULATION DATA EXPORT\n\n`;

      text += `## Project Idea / Core Purpose:\\n`;
      text += `${initialIdea || context.corePurpose || "Not specified"}\\n\\n`;

      text += `## Compute Brain (MCU):\\n`;
      text += `${context.mcu || "Determining..."}\\n\\n`;

      text += `## Confirmed BOM:\\n`;
      if (bom && bom.length > 0) {
        bom.forEach((item, idx) => {
          text += `- ${idx + 1}. ${item.displayName || item.name} (${item.purpose || "No purpose specified"})\\n`;
        });
      } else {
        text += `No parts finalized yet.\\n`;
      }
      text += `\\n`;

      text += `## Wiring Connections:\\n`;
      if (wiring && wiring.length > 0) {
        wiring.forEach((w, idx) => {
          text += `- ${idx + 1}. ${w.from} ===> ${w.to}\\n`;
        });
      } else {
        text += `No wiring connections designed yet.\\n`;
      }
      text += `\\n`;

      text += `## Deep Agent Log Feed:\\n\\n`;
      if (logs && logs.length > 0) {
        logs.forEach((log, idx) => {
          const timestampStr = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : "";
          text += `--- LOG #${idx + 1} [${timestampStr}] ---\\n`;
          text += `Type: ${String(log.type || "").toUpperCase()}\\n`;
          if (log.type === "thinking") {
            text += `Thinking:\\n${log.text || ""}\\n`;
          } else if (log.type === "tool_call") {
            text += `Tool Name: ${log.name || ""}\\n`;
            text += `Status: ${log.status || "running"}\\n`;
            if (log.input) {
              text += `Input Params:\\n${JSON.stringify(log.input, null, 2)}\\n`;
            }
            if (log.output) {
              text += `Output Response:\\n${JSON.stringify(log.output, null, 2)}\\n`;
            }
          } else {
            text += `Text: ${log.text || ""}\\n`;
          }
          text += `\\n`;
        });
      } else {
        text += `No execution logs yet.\\n`;
      }
      text += `\\n`;

      if (finalSketch) {
        text += `## Generated Arduino Code:\\n\\n\`\`\`cpp\\n${finalSketch}\\n\`\`\`\\n`;
      }

      navigator.clipboard.writeText(text);
      toast.success("All formulation data copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy formulation data:", err);
      toast.error("Failed to copy data.");
    }
  };

  // ??$$$ newer code — Go to simulator workspace
  const handleGoToSimulator = () => {
    if (!sessionId) {
      onClose();
      return;
    }

    const params = new URLSearchParams({
      sessionId,
      source: "wireup"
    });

    if (completedProjectId) {
      params.set("projectId", completedProjectId);
    }

    localStorage.removeItem("wireup_discovery_session_id");
    onClose();
    window.location.href = `${virtualPlaygroundUrl}/?${params.toString()}`;
  };

  // ??$$$ NEW FLOW
  const handleRestart = async () => {
    if (!sessionId || restarting) return;
    setRestarting(true);
    setLogs([]);
    setBom([]);
    setWiring([]);
    setMilestones([]);
    try {
      await axiosInstance.post("/new-flow/restart", {
        sessionId,
        context,
        model // ??$$$ newer code - pass currently selected model on restart
      });
      toast.success("Agent restarted with current context!");
    } catch (err: any) {
      toast.error("Failed to restart formulation agent.");
    } finally {
      setRestarting(false);
    }
  };

  // ??$$$ newer code — Trigger resumption of automated formulation
  const handleResume = async () => {
    if (!sessionId) return;
    setLoading(true);
    setIsFailed(false);
    try {
      await axiosInstance.post("/new-flow/resume", { sessionId });
      toast.success("Triggered formulation resumption!");
    } catch (err: any) {
      console.error("handleResume failed:", err);
      toast.error(err.response?.data?.error || "Failed to trigger resumption.");
      setIsFailed(true);
    } finally {
      setLoading(false);
    }
  };

  // ??$$$ newer code — Trigger API Rescue to bypass Ollama constraints and failover to cloud APIs
  const handleRescue = async () => {
    if (!sessionId) return;
    setRescuing(true);
    setIsFailed(false);
    try {
      await axiosInstance.post("/new-flow/rescue", { sessionId });
      toast.success("Triggered API Rescue with Groq/Cerebras/Gemini failover!");
    } catch (err: any) {
      console.error("handleRescue failed:", err);
      toast.error(err.response?.data?.error || "Failed to trigger API Rescue.");
      setIsFailed(true);
    } finally {
      setRescuing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 font-sans text-zinc-100 antialiased overflow-hidden">
      {/* Glow effects */}
      <div className="absolute top-0 left-1/4 h-[350px] w-[500px] -translate-y-1/2 rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 h-[350px] w-[500px] translate-y-1/2 rounded-full bg-blue-500/10 blur-[120px] pointer-events-none" />

      {/* Top Header */}
      <header className="flex h-16 items-center justify-between border-b border-zinc-800 bg-zinc-900/60 px-6 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Cpu className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">
              ✦ AI Build Session
            </h1>
            <p className="text-xs text-zinc-500">
              {phase === 1 ? "Discovery Loop" : "Autonomous Formulation Pipeline"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Model Selector */}
          {started && ( // ??$$$ newer code - show model selector in both phases once started
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400">Agent Brain:</span>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-emerald-500 transition-colors"
              >
                /* old code
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="meta-llama/llama-4-scout-17b-16e-instruct">Groq Llama 4 Scout</option>
                <option value="qwen/qwen3-32b">Groq Qwen2.5-32B</option>
                <option value="deepseek-chat">DeepSeek V3 (Chat)</option>
                <option value="ollama/qwen2.5:3b">Ollama Local (qwen2.5:3b)</option>
                <option value="ollama/llama3.2:3b">Ollama Local (llama3.2:3b)</option>
                <option value="ollama/qwen2.5-coder:14b">Ollama Local (qwen2.5-coder:14b)</option>
                <option value="ollama/qwen2.5-coder:7b">Ollama Local (qwen2.5-coder:7b)</option>
                <option value="ollama/deepseek-r1:8b">Ollama Local (deepseek-r1:8b)</option>
                */
                {/* ??$$$ newer code */}
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="gpt-oss-120b">Cerebras gpt-oss-120b</option>
                <option value="zai-glm-4.7">Cerebras zai-glm-4.7</option>
                <option value="meta-llama/llama-4-scout-17b-16e-instruct">Groq Llama 4 Scout</option>
                <option value="qwen/qwen3-32b">Groq Qwen2.5-32B</option>
                <option value="deepseek-chat">DeepSeek V3 (Chat)</option>
                <option value="ollama/qwen2.5:3b">Ollama Local (qwen2.5:3b)</option>
                <option value="ollama/llama3.2:3b">Ollama Local (llama3.2:3b)</option>
                <option value="ollama/qwen2.5-coder:14b">Ollama Local (qwen2.5-coder:14b)</option>
                <option value="ollama/qwen2.5-coder:7b">Ollama Local (qwen2.5-coder:7b)</option>
                <option value="ollama/deepseek-r1:8b">Ollama Local (deepseek-r1:8b)</option>
              </select>
            </div>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
            <p className="text-sm text-zinc-400">Booting discovery pipelines...</p>
          </div>
        ) : !started ? (
          /* ??$$$ newer code — Pre-start setup screen to select AI Brain */
          <div className="flex h-full flex-col items-center justify-center gap-6 max-w-md mx-auto text-center px-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Cpu className="h-6 w-6 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-zinc-100">Ready to build your idea?</h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                You've specified the project idea: <span className="text-emerald-450 font-semibold font-mono">"{initialIdea}"</span>.
                Choose the AI model you'd like to use for the discovery and formulation, then start.
              </p>
            </div>
            {/* ??$$$ newer code - Two mode cards: Pure Ollama + Hybrid */}
            <div className="w-full space-y-3">
              <label className="text-xs font-semibold text-zinc-400 block text-left">Choose Formulation Mode:</label>

              {/* Card 1: Pure Ollama */}
              <button
                id="mode-pure-ollama"
                onClick={() => setModel("ollama/minimax-m3:cloud")}
                className={`w-full flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${model === "ollama/minimax-m3:cloud"
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700"
                  }`}
              >
                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border ${model === "ollama/minimax-m3:cloud"
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : "bg-zinc-800 text-zinc-400 border-zinc-700"
                  }`}>
                  <HardDrive className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className={`text-sm font-bold ${model === "ollama/minimax-m3:cloud" ? "text-emerald-300" : "text-zinc-200"
                    }`}>Pure Ollama</div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">minimax-m3:cloud:cloud · 100% local · Zero API limits</div>
                </div>
                {model === "ollama/minimax-m3:cloud" && (
                  <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                )}
              </button>

              {/* Card 2: Hybrid */}
              <div className={`w-full rounded-xl border transition-all overflow-hidden ${model === "hybrid"
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-zinc-800 bg-zinc-900/60"
                }`}>
                <button
                  id="mode-hybrid"
                  onClick={() => setModel("hybrid")}
                  className="w-full flex items-center gap-3 p-4 text-left"
                >
                  <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border ${model === "hybrid"
                      ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                      : "bg-zinc-800 text-zinc-400 border-zinc-700"
                    }`}>
                    <Layers className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className={`text-sm font-bold ${model === "hybrid" ? "text-blue-300" : "text-zinc-200"
                      }`}>Hybrid</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">GROQ_KEY → GROQ_FALLBACK → Cerebras → Ollama</div>
                  </div>
                  {model === "hybrid" && (
                    <CheckCircle className="h-4 w-4 text-blue-400 flex-shrink-0" />
                  )}
                </button>
                {/* Sub-dropdown only visible when Hybrid is selected */}
                {model === "hybrid" && (
                  <div className="px-4 pb-4 border-t border-blue-500/20">
                    <label className="text-[10px] font-semibold text-zinc-500 block mt-3 mb-1.5 uppercase tracking-wider">Primary Cloud Provider:</label>
                    <select
                      id="hybrid-primary-select"
                      value={hybridPrimary}
                      onChange={(e) => setHybridPrimary(e.target.value)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-blue-500 transition-colors"
                    >
                      <option value="meta-llama/llama-4-scout-17b-16e-instruct">Groq · Llama 4 Scout</option>
                      <option value="qwen/qwen3-32b">Groq · Qwen3-32B</option>
                      <option value="gpt-oss-120b">Cerebras · gpt-oss-120b</option>
                      <option value="zai-glm-4.7">Cerebras · zai-glm-4.7</option>
                    </select>
                    <p className="text-[9px] text-zinc-600 mt-2 leading-relaxed">
                      Auto-failover chain: GROQ_API_KEY → GROQ_API_FALLBACK → CEREBRAS_API_KEY → minimax-m3:cloud:cloud
                    </p>
                  </div>
                )}
              </div>
              <button
                onClick={handleStartSession}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 transition-colors active:scale-[0.98]"
              >
                <Play className="h-4 w-4" /> Start AI Build
              </button>
            </div>
          </div>
        ) : phase === 1 ? (
          /* PHASE 1: DISCOVERY SCREEN */
          <div className="flex h-full overflow-hidden">
            {/* Q&A Left Stage */}
            <div className="flex-1 flex flex-col justify-between p-10 overflow-y-auto">
              <div className="max-w-xl mx-auto w-full my-auto space-y-8">
                {question ? (
                  <>
                    <div className="space-y-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                        Question
                      </span>
                      <h2 className="text-2xl font-bold tracking-tight text-zinc-100">
                        {question}
                      </h2>
                    </div>

                    {/* Option Chips */}
                    {options.length > 0 && (
                      <div className="grid grid-cols-2 gap-3">
                        {/* ??$$$ old code */}
                        {/*
                        {options.map((opt, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleAnswer(opt)}
                            disabled={submitting}
                            className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-left text-sm font-medium text-zinc-300 hover:border-emerald-500/50 hover:bg-zinc-900 transition-all active:scale-[0.98]"
                          >
                            {opt}
                          </button>
                        ))}
                        */}
                        {/* ??$$$ newer code */}
                        {[...options, "Other / Custom"].map((opt, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              if (opt === "Other / Custom") {
                                const inputEl = document.getElementById("custom-input-field");
                                if (inputEl) inputEl.focus();
                              } else {
                                handleAnswer(opt);
                              }
                            }}
                            disabled={submitting}
                            className={`rounded-xl border p-4 text-left text-sm font-medium transition-all active:scale-[0.98] ${opt === "Other / Custom"
                                ? "border-dashed border-zinc-700 bg-zinc-950/20 text-zinc-400 hover:border-emerald-500/50 hover:text-emerald-450"
                                : "border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:border-emerald-500/50 hover:bg-zinc-900"
                              }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Custom Text Answer input */}
                    <div className="space-y-4">
                      <div className="flex gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 focus-within:border-emerald-500 transition-colors">
                        {/* ??$$$ old code */}
                        {/*
                        <input
                          type="text"
                          value={answerText}
                          onChange={(e) => setAnswerText(e.target.value)}
                        */}
                        {/* ??$$$ newer code */}
                        <input
                          id="custom-input-field"
                          type="text"
                          value={answerText}
                          onChange={(e) => setAnswerText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && answerText.trim()) {
                              handleAnswer(answerText);
                            }
                          }}
                          placeholder="Type custom response here..."
                          disabled={submitting}
                          className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none"
                        />
                        <button
                          onClick={() => handleAnswer(answerText)}
                          disabled={submitting || !answerText.trim()}
                          className="rounded-lg bg-emerald-500 p-2 text-zinc-950 hover:bg-emerald-400 transition-colors disabled:bg-zinc-800 disabled:text-zinc-600"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <button
                          onClick={handleProceed}
                          disabled={submitting}
                          className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors font-semibold"
                        >
                          <Play className="h-3 w-3" /> Skip Q&A & Formulation
                        </button>
                        <span className="text-[10px] text-zinc-600">Phase 1 of 2</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 space-y-6">
                    <div className="space-y-2">
                      <h2 className="text-xl font-bold text-emerald-400">Discovery Completed</h2>
                      <p className="text-sm text-zinc-400">
                        The AI agent has gathered enough context to formulate this project. You can review the parameters on the right, or initiate the formulation now.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={() => {
                          setPhase(2);
                          setShouldAutoFormulate(true);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 transition-colors active:scale-[0.98]"
                      >
                        <Play className="h-4 w-4" />
                        Proceed to AI Build
                      </button>

                      <button
                        onClick={async () => {
                          if (!sessionId) return;
                          setLoading(true);
                          try {
                            const res = await axiosInstance.post("/new-flow/restart", { sessionId });
                            setQuestion(res.data.question || "");
                            setOptions(res.data.options || []);
                            setContext(res.data.context || {});
                            setPhase(1);
                            toast.success("Discovery Q&A restarted!");
                          } catch (err) {
                            toast.error("Failed to restart discovery.");
                          } finally {
                            setLoading(false);
                          }
                        }}
                        className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-5 py-3 text-sm font-medium text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900 transition-all"
                      >
                        Restart Q&A
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Live Context Right Sidebar */}
            <aside className="w-80 border-l border-zinc-800 bg-zinc-900/30 p-6 overflow-y-auto space-y-6">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-4">
                  Live Project Context
                </h3>
                <div className="space-y-4 text-xs">
                  <div>
                    <div className="text-zinc-400 font-semibold mb-1">Core Purpose</div>
                    <div className="text-zinc-200 bg-zinc-900/50 p-2.5 rounded-lg border border-zinc-800/80">
                      {context.corePurpose || "Extracting..."}
                    </div>
                  </div>

                  <div>
                    <div className="text-zinc-400 font-semibold mb-1">Compute Brain (MCU)</div>
                    <div className="text-zinc-200 bg-zinc-900/50 p-2.5 rounded-lg border border-zinc-800/80 flex items-center gap-2">
                      <Cpu className="h-3.5 w-3.5 text-blue-400" />
                      {context.mcu || "Determining..."}
                    </div>
                  </div>

                  <div>
                    <div className="text-zinc-400 font-semibold mb-1.5">Subsystems</div>
                    <div className="flex flex-wrap gap-1">
                      {context.subsystems?.length > 0 ? (
                        context.subsystems.map((sub: string, i: number) => (
                          <span key={i} className="rounded bg-zinc-900 px-2 py-1 text-[10px] text-zinc-300 border border-zinc-800">
                            {sub}
                          </span>
                        ))
                      ) : (
                        <span className="text-zinc-600 italic">None identified</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-zinc-400 font-semibold mb-1">Power Source</div>
                    <div className="text-zinc-300">
                      {context.powerSource || "Not specified"}
                    </div>
                  </div>

                  <div>
                    <div className="text-zinc-400 font-semibold mb-1">Connectivity</div>
                    <div className="text-zinc-300">
                      {context.connectivity || "Not specified"}
                    </div>
                  </div>

                  {context.constraints?.length > 0 && (
                    <div>
                      <div className="text-zinc-400 font-semibold mb-1.5">Constraints</div>
                      <ul className="list-disc list-inside space-y-1 text-zinc-300 pl-1">
                        {context.constraints.map((c: string, i: number) => (
                          <li key={i} className="leading-relaxed">{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {context.openQuestions?.length > 0 && (
                    <div>
                      <div className="text-amber-400 font-semibold mb-1.5 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Remaining Concerns
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-zinc-400 pl-1">
                        {context.openQuestions.map((q: string, i: number) => (
                          <li key={i} className="leading-relaxed">{q}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </aside>
          </div>
        ) : (
          /* PHASE 2: AUTOMATED FORMULATION LOOP */
          // ??$$$ newer code
          <div className="flex h-full overflow-hidden">
            {/* Left/Center Main Workspace (Main panel for progress) */}
            <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden border-r border-zinc-800">
              {/* Stepper progress & controls */}
              <div className="border-b border-zinc-800 bg-zinc-900/20 px-6 py-4 flex flex-col md:flex-row justify-between gap-4 select-none">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">AI Sourcing Pipeline</div>
                  {renderStepper()}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex rounded-lg bg-zinc-950 p-0.5 border border-zinc-800">
                    <button
                      onClick={() => setWorkspaceTab("visual")}
                      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all ${
                        workspaceTab === "visual"
                          ? "bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/10"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      <LayoutDashboard className="h-3 w-3" />
                      Visual Overview
                    </button>
                    <button
                      onClick={() => setWorkspaceTab("console")}
                      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all ${
                        workspaceTab === "console"
                          ? "bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/10"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      <Terminal className="h-3 w-3" />
                      Deep Agent Console
                    </button>
                  </div>
                  <button
                    onClick={handleRestart}
                    disabled={restarting}
                    className="flex items-center gap-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${restarting ? "animate-spin text-emerald-400" : "text-zinc-400"}`} />
                    Restart Build
                  </button>

                  {isCompleted && (
                    <button
                      onClick={handleGoToSimulator}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-450 px-3 py-1.5 text-[11px] font-bold text-zinc-950 transition-all shadow-md shadow-emerald-500/20"
                    >
                      <PlayCircle className="h-3.5 w-3.5" />
                      Launch Playground
                    </button>
                  )}
                </div>
              </div>

              {/* Main Workspace View Panels */}
              {workspaceTab === "visual" ? (
                <>
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Completion card */}
                    {isCompleted && (
                      <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-5 text-zinc-300 space-y-4 shadow-xl">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0">
                            <CheckCircle className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-zinc-100">Formulation Completed Successfully!</h4>
                            <p className="text-[11px] text-zinc-450">BOM, wiring netlists, and code curriculum are generated.</p>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={handleExportLocal}
                            disabled={exporting}
                            className="flex items-center gap-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-all"
                          >
                            <HardDrive className="h-3.5 w-3.5 text-emerald-400" />
                            {exporting ? "Exporting..." : "Export Data to local E:"}
                          </button>
                          <button
                            onClick={handleCopyAllData}
                            className="flex items-center gap-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-all"
                          >
                            <Copy className="h-3.5 w-3.5 text-emerald-450" />
                            Copy All Data
                          </button>
                          <button
                            onClick={handleGoToSimulator}
                            className="flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-450 px-4 py-1.5 text-xs font-bold text-zinc-950 transition-all"
                          >
                            <PlayCircle className="h-3.5 w-3.5" />
                            Open Virtual Playground
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Constraint conflict card */}
                    {conflictDetails && (
                      <div className="rounded-xl border border-amber-500/30 bg-amber-955/15 p-5 text-zinc-300 space-y-3 shadow-lg">
                        <div className="flex items-center gap-2.5 text-amber-400 font-bold text-xs">
                          <AlertTriangle className="h-4 w-4 animate-pulse" />
                          <span>{conflictDetails.title}</span>
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          {conflictDetails.description}
                        </p>
                        <div className="space-y-2 pt-2">
                          <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider font-mono">Choose Resolution Path:</div>
                          {conflictDetails.options.map((opt, idx) => (
                            <button
                              key={idx}
                              onClick={() => resolveConflict(opt)}
                              disabled={loading}
                              className="w-full text-left rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 hover:border-amber-550/50 p-3 text-xs text-zinc-300 transition-all active:scale-[0.99]"
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Failure card */}
                    {isFailed && !isCompleted && !conflictDetails && (
                      <div className="rounded-xl border border-red-500/20 bg-red-950/10 p-5 text-zinc-300 space-y-3 shadow-lg">
                        <div className="flex items-center gap-2.5 text-red-400 font-bold text-xs">
                          <AlertTriangle className="h-4 w-4" />
                          <span>Formulation Interrupted</span>
                        </div>
                        <p className="text-xs text-zinc-450 leading-relaxed font-sans">
                          The formulation loop stopped. You can resume from where it was left off.
                        </p>
                        <div className="flex flex-wrap gap-2.5">
                          <button
                            onClick={handleResume}
                            disabled={loading || rescuing}
                            className="flex items-center gap-1.5 rounded-lg bg-red-500 hover:bg-red-450 px-4 py-2 text-xs font-bold text-zinc-950 transition-all disabled:opacity-50"
                          >
                            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                            {loading ? "Resuming..." : "Resume Formulation"}
                          </button>

                          <button
                            onClick={handleRescue}
                            disabled={loading || rescuing}
                            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-550 hover:to-amber-450 px-4 py-2 text-xs font-bold text-zinc-950 shadow-md shadow-amber-600/20 transition-all disabled:opacity-50"
                          >
                            <Cpu className={`h-3.5 w-3.5 ${rescuing ? "animate-pulse" : ""}`} />
                            {rescuing ? "Rescuing..." : "API Rescue (Groq/Cerebras/Gemini)"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Section 1: Live Hardware Assembly */}
                    <div className="space-y-3">
                      <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-mono">Assembly Preview</div>
                      {renderHardwareAssembly()}
                    </div>

                    {/* Section 2: Milestone Timeline */}
                    <div className="space-y-3">
                      <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-mono">Project Roadmap</div>
                      {milestones.length > 0 ? (
                        <div className="space-y-2">
                          {milestones.map((m, idx) => (
                            <MilestoneCard key={idx} m={m} idx={idx} />
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-xs text-zinc-650 italic">
                          Roadmap milestones will appear as they are designed.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom drawer/tray (Live AI activity log) */}
                  <div className="h-44 border-t border-zinc-800 bg-zinc-955 flex flex-col">
                    <div className="flex h-9 border-b border-zinc-850 bg-zinc-900/10 px-4 items-center justify-between select-none">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Live AI Activity Log</span>
                      {logs.some(l => l.type === "thinking" || l.type === "tool_call") && (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                      )}
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-[10px] leading-relaxed text-zinc-400">
                      {logs.length === 0 && <div className="text-zinc-600 italic">No logs initialized.</div>}
                      {logs.slice(-15).map((log, i) => {
                        const timestampStr = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : "";
                        if (log.type === "thinking") {
                          return (
                            <div key={i} className="text-zinc-400 truncate">
                              <span className="text-zinc-600">[{timestampStr}]</span> <span className="text-blue-400 font-bold">THINK:</span> {log.text}
                            </div>
                          );
                        }
                        if (log.type === "tool_call") {
                          return (
                            <div key={i} className="text-zinc-300">
                              <span className="text-zinc-500">[{timestampStr}]</span> <span className="text-emerald-400 font-bold">TOOL:</span> {log.name} ({log.status})
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                </>
              ) : (
                /* DEEP AGENT CONSOLE */
                <div className="flex-1 flex overflow-hidden h-[calc(100vh-280px)]">
                  {/* Left Column: Log Feed */}
                  <div className="w-[42%] flex flex-col border-r border-zinc-800 bg-zinc-950/40 overflow-hidden">
                    <div className="p-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/10">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-zinc-400 font-bold uppercase tracking-wider">Execution Feed ({logs.length} logs)</span>
                        {logs.some(l => l.type === "thinking" || l.type === "tool_call") && (
                          <span className="flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[9px] font-mono text-zinc-505">Live</span>
                          </span>
                        )}
                      </div>
                      <button
                        onClick={handleCopyAllData}
                        className="flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-805 hover:text-zinc-100 px-2 py-0.5 text-[9px] font-bold text-zinc-350 transition-colors"
                      >
                        <Copy className="h-2.5 w-2.5 text-emerald-400" />
                        Copy All Data
                      </button>
                    </div>
                    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 font-mono">
                      {logs.length === 0 && (
                        <div className="text-zinc-600 text-xs italic text-center py-10">No execution logs yet.</div>
                      )}
                      {logs.map((log, idx) => {
                        const timestampStr = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : "";
                        const isSelected = selectedLog === log;

                        if (log.type === "thinking") {
                          return (
                            <div 
                              key={idx} 
                              onClick={() => setSelectedLog(log)}
                              className={`p-3 rounded-lg border text-[11px] cursor-pointer transition-all hover:bg-zinc-900/40 ${
                                isSelected ? "border-blue-500/50 bg-blue-500/5" : "border-zinc-800 bg-zinc-900/20"
                              }`}
                            >
                              <div className="flex justify-between items-center text-[9px] text-zinc-500 mb-1.5">
                                <span className="font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1">
                                  <Cpu className="h-3 w-3" /> Thinking Process
                                </span>
                                <span>{timestampStr}</span>
                              </div>
                              <p className="text-zinc-350 line-clamp-3 leading-relaxed whitespace-pre-wrap font-sans">
                                {log.text}
                              </p>
                              <div className="text-[9px] text-blue-400/70 mt-1 hover:underline font-bold text-right">Inspect full thought →</div>
                            </div>
                          );
                        }

                        if (log.type === "tool_call") {
                          const statusColors = 
                            log.status === "failed" ? "border-red-500/35 bg-red-950/10 text-red-300" :
                            log.status === "done" ? "border-emerald-500/35 bg-emerald-950/10 text-emerald-300" :
                            "border-amber-500/35 bg-amber-950/10 text-amber-300 animate-pulse";
                          
                          const badge = 
                            log.status === "failed" ? "bg-red-500/10 text-red-400 border border-red-500/25" :
                            log.status === "done" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25" :
                            "bg-amber-500/10 text-amber-400 border border-amber-500/25";

                          return (
                            <div 
                              key={idx} 
                              onClick={() => setSelectedLog(log)}
                              className={`p-3 rounded-lg border text-[11px] cursor-pointer transition-all hover:opacity-95 ${statusColors} ${
                                isSelected ? "ring-1 ring-emerald-500" : ""
                              }`}
                            >
                              <div className="flex justify-between items-center text-[9px] mb-1.5">
                                <span className="font-bold uppercase tracking-wider flex items-center gap-1 text-zinc-400">
                                  <Braces className="h-3 w-3" /> Tool Invocation
                                </span>
                                <span>{timestampStr}</span>
                              </div>
                              <div className="font-bold font-mono text-zinc-100 text-[12px] mb-1">{log.name}</div>
                              <div className="flex justify-between items-center mt-2 pt-1 border-t border-zinc-800/40">
                                <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${badge}`}>
                                  {log.status || "running"}
                                </span>
                                <span className="text-[9px] text-zinc-500 hover:text-zinc-355 underline">Inspect details →</span>
                              </div>
                            </div>
                          );
                        }

                        if (log.type === "decision") {
                          return (
                            <div 
                              key={idx}
                              onClick={() => setSelectedLog(log)}
                              className={`p-3 rounded-lg border text-[11px] cursor-pointer transition-all bg-purple-500/5 hover:bg-purple-500/10 ${
                                isSelected ? "border-purple-500 bg-purple-500/10" : "border-purple-500/20"
                              }`}
                            >
                              <div className="flex justify-between items-center text-[9px] text-purple-400 mb-1">
                                <span className="font-bold uppercase tracking-wider flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3" /> Decision Logged
                                </span>
                                <span>{timestampStr}</span>
                              </div>
                              <p className="text-zinc-300 leading-relaxed font-sans">{log.text}</p>
                            </div>
                          );
                        }

                        if (log.type === "rate_limit") {
                          return (
                            <div 
                              key={idx}
                              onClick={() => setSelectedLog(log)}
                              className={`p-3 rounded-lg border text-[11px] cursor-pointer transition-all bg-amber-500/5 hover:bg-amber-500/10 ${
                                isSelected ? "border-amber-500 bg-amber-500/10" : "border-amber-500/20"
                              }`}
                            >
                              <div className="flex justify-between items-center text-[9px] text-amber-400 mb-1">
                                <span className="font-bold uppercase tracking-wider flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" /> Rate Limit Pause
                                </span>
                                <span>{timestampStr}</span>
                              </div>
                              <p className="text-zinc-300 leading-relaxed font-sans">{log.text}</p>
                            </div>
                          );
                        }

                        if (log.type === "error") {
                          return (
                            <div 
                              key={idx}
                              onClick={() => setSelectedLog(log)}
                              className={`p-3 rounded-lg border text-[11px] cursor-pointer transition-all bg-red-500/5 hover:bg-red-500/10 ${
                                isSelected ? "border-red-500 bg-red-500/10" : "border-red-500/20"
                              }`}
                            >
                              <div className="flex justify-between items-center text-[9px] text-red-400 mb-1">
                                <span className="font-bold uppercase tracking-wider flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" /> Pipeline Error
                                </span>
                                <span>{timestampStr}</span>
                              </div>
                              <p className="text-zinc-300 leading-relaxed font-mono whitespace-pre-wrap">{log.text}</p>
                            </div>
                          );
                        }

                        return null;
                      })}
                    </div>
                  </div>

                  {/* Right Column: Deep Inspector / Details View */}
                  <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden">
                    <div className="flex h-9 border-b border-zinc-800 px-4 items-center justify-between bg-zinc-900/10">
                      <span className="text-[10px] font-mono text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Terminal className="h-3.5 w-3.5 text-emerald-400" />
                        Parameters & Execution Inspector
                      </span>
                      {finalSketch && (
                        <div className="flex items-center gap-1 text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider font-mono">
                          <Code className="h-2.5 w-2.5" /> Sketch Generated
                        </div>
                      )}
                    </div>

                    <div className="flex-1 flex flex-col overflow-hidden p-6 space-y-4">
                      {/* Tabs inside Inspector: Selected Log vs final code */}
                      <div className="flex gap-2 border-b border-zinc-850 pb-2">
                        <button
                          onClick={() => {
                            // Reset selected log if we were on code
                            if (selectedLog?.type === "code" && logs.length > 0) {
                              setSelectedLog(logs[logs.length - 1]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                            selectedLog && selectedLog.type !== "code"
                              ? "bg-zinc-850 text-zinc-100 border border-zinc-700" 
                              : "bg-zinc-900/40 text-zinc-500 hover:text-zinc-300"
                          }`}
                          disabled={!selectedLog}
                        >
                          <Braces className="h-3.5 w-3.5 text-blue-400" />
                          {selectedLog && selectedLog.type !== "code" ? `${selectedLog.name || selectedLog.type.toUpperCase()}` : "Selected Tool"}
                        </button>
                        <button
                          onClick={() => {
                            if (finalSketch) {
                              setSelectedLog({ type: "code", text: finalSketch });
                            } else {
                              toast.error("Arduino code has not been generated yet.");
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                            selectedLog?.type === "code"
                              ? "bg-emerald-500 text-zinc-950 font-bold" 
                              : (finalSketch ? "bg-zinc-900 hover:bg-zinc-855 text-emerald-400 border border-zinc-800" : "bg-zinc-900/20 text-zinc-650 cursor-not-allowed")
                          }`}
                        >
                          <Code className="h-3.5 w-3.5" />
                          Generated Arduino Code
                        </button>
                      </div>

                      {/* Inspector Content Body */}
                      <div className="flex-1 overflow-y-auto bg-black/40 rounded-xl border border-zinc-850 p-4 font-mono text-xs select-text">
                        {renderInspectorContent()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Sidebar: Context summaries, locked constraints, and decisions */}
            <aside className="w-80 border-l border-zinc-800 bg-zinc-900/10 p-6 overflow-y-auto space-y-6">
              {/* Project Goals */}
              <div className="space-y-5 text-xs">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 font-mono">Project Constraints</h3>
                  <div className="space-y-2.5">
                    <div>
                      <div className="text-zinc-400 font-semibold mb-0.5">Core Purpose</div>
                      <div className="text-zinc-300 bg-zinc-900/40 p-2 rounded border border-zinc-800/80">
                        {context.corePurpose || "Extracting..."}
                      </div>
                    </div>
                    {context.mcu && (
                      <div>
                        <div className="text-zinc-400 font-semibold mb-0.5">Compute Brain</div>
                        <div className="text-zinc-300 font-mono text-[10px]">{context.mcu}</div>
                      </div>
                    )}
                    {context.powerSource && (
                      <div>
                        <div className="text-zinc-400 font-semibold mb-0.5">Power Source</div>
                        <div className="text-zinc-350">{context.powerSource}</div>
                      </div>
                    )}
                    {context.connectivity && (
                      <div>
                        <div className="text-zinc-400 font-semibold mb-0.5">Connectivity</div>
                        <div className="text-zinc-350">{context.connectivity}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Confirmed BOM */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 font-mono">Confirmed BOM</h3>
                  {bom.length > 0 ? (
                    <div className="space-y-1">
                      {bom.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-zinc-900/30 px-2.5 py-1.5 rounded border border-zinc-850">
                          <span className="text-zinc-300 font-medium font-mono text-[10px] truncate max-w-[140px]">{item.displayName}</span>
                          <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Confirmed</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-zinc-650 italic text-[11px] font-sans">No parts finalized yet.</div>
                  )}
                </div>

                {/* Candidate alternatives */}
                {candidates.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 font-mono">Evaluating Candidates</h3>
                    <div className="space-y-1">
                      {candidates.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-zinc-900/10 px-2.5 py-1.5 rounded border border-dashed border-zinc-800">
                          <span className="text-zinc-450 font-mono text-[10px] truncate max-w-[140px]">{item}</span>
                          <span className="text-[9px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Evaluating</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Rationale / Reasoning */}
                {decisions.length > 0 && (
                  <div className="pt-2 border-t border-zinc-800/80">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 font-mono">AI Rationale</h3>
                    <div className="space-y-2">
                      {decisions.map((dec, idx) => (
                        <div key={idx} className="p-2.5 rounded bg-zinc-900/40 border border-zinc-850 text-zinc-400 leading-relaxed text-[10px] font-sans">
                          {dec}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </div>

        )}
      </div>
    </div>
  );
};
