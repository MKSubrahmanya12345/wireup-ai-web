// ??$$$ NEW FLOW
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { axiosInstance } from "../lib/axios";
// ??$$$ old code
// import { X, Send, Play, Terminal, Cpu, Database, Layers, CheckCircle, AlertTriangle, RefreshCw, EyeOff, Eye } from "lucide-react";
// ??$$$ newer code
import { X, Send, Play, Terminal, Cpu, Database, Layers, CheckCircle, AlertTriangle, RefreshCw, EyeOff, Eye, HardDrive, PlayCircle } from "lucide-react";
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
                setStarted(true); // ??$$$ newer code - mark as started
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
        model
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

      // ??$$$ newer code — Handle socket complete without auto-redirecting
      socket.on("agent2:complete", (data: any) => {
        toast.success("Project formulation complete!");
        setIsCompleted(true);
        setIsFailed(false); // ??$$$ newer code
        if (data.projectId) {
          setCompletedProjectId(data.projectId);
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
          clearInterval(interval);
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
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="meta-llama/llama-4-scout-17b-16e-instruct">Groq Llama 4 Scout</option>
                {/* old code
                <option value="meta-llama/llama-4-scout-17b-16e-instruct">Groq Qwen2.5-32B</option>
                */}
                {/* ??$$$ newer code */}
                <option value="qwen/qwen3-32b">Groq Qwen2.5-32B</option>
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
            <div className="w-full space-y-4">
              <div className="flex flex-col items-start gap-1.5 text-left">
                <label className="text-xs font-semibold text-zinc-400">Select AI Brain:</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-emerald-500 transition-colors"
                >
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                  <option value="meta-llama/llama-4-scout-17b-16e-instruct">Groq Llama 4 Scout</option>
                  {/* old code
                  <option value="meta-llama/llama-4-scout-17b-16e-instruct">Groq Qwen2.5-32B</option>
                  */}
                  {/* ??$$$ newer code */}
                  <option value="qwen/qwen3-32b">Groq Qwen2.5-32B</option>
                </select>
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
                      </div>
                    )}

                    {/* Custom Text Answer input */}
                    <div className="space-y-4">
                      <div className="flex gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 focus-within:border-emerald-500 transition-colors">
                        <input
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
          <div className="flex h-full overflow-hidden">
            {/* Agent Live Log - Left Panel */}
            <div className="flex-1 flex flex-col border-r border-zinc-800 bg-zinc-950 overflow-hidden">
              {/* ??$$$ */}
              {/*
              // Tabs
              <div className="flex h-12 border-b border-zinc-800 bg-zinc-900/20 px-4 items-center justify-between">
                <div className="flex h-full">
                  <button
                    onClick={() => setActiveTab("thinking")}
                    className={`flex items-center gap-1.5 border-b-2 px-4 text-xs font-semibold transition-colors ${
                      activeTab === "thinking"
                        ? "border-emerald-500 text-emerald-400"
                        : "border-transparent text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <Cpu className="h-3.5 w-3.5" /> Agent Thinking
                  </button>
                  <button
                    onClick={() => setActiveTab("tools")}
                    className={`flex items-center gap-1.5 border-b-2 px-4 text-xs font-semibold transition-colors ${
                      activeTab === "tools"
                        ? "border-emerald-500 text-emerald-400"
                        : "border-transparent text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <Terminal className="h-3.5 w-3.5" /> Tool Executions
                  </button>
                </div>

                <button
                  onClick={handleRestart}
                  disabled={restarting}
                  className="flex items-center gap-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${restarting ? "animate-spin text-emerald-400" : "text-zinc-400"}`} />
                  {restarting ? "Restarting..." : "Restart formulation"}
                </button>
              </div>

              // Log Stage
              <div className="flex-1 overflow-y-auto p-6 font-mono text-xs leading-relaxed space-y-4">
                {activeTab === "thinking" ? (
                  ...
                ) : (
                  ...
                )}
              </div>
              */}

              {/* ??$$$ NEW FLOW */}
              <div className="flex h-12 border-b border-zinc-800 bg-zinc-900/20 px-4 items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-xs font-semibold text-zinc-300">✦ AI Build Assistant</span>
                </div>

                <button
                  onClick={handleRestart}
                  disabled={restarting}
                  className="flex items-center gap-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${restarting ? "animate-spin text-emerald-400" : "text-zinc-400"}`} />
                  {restarting ? "Restarting..." : "Restart formulation"}
                </button>
              </div>

              {/* ??$$$ newer code — Visual Progress Bar */}
              <div className="bg-zinc-900/40 border-b border-zinc-800/60 px-6 py-3 space-y-1.5 select-none">
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-zinc-400 font-medium">Formulation Progress</span>
                  <span className="text-emerald-400 font-bold">{progressPercent}%</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-800/80 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 transition-all duration-1000 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="text-[10px] text-zinc-500 font-medium font-sans">
                  Current Stage: <span className="text-zinc-300 font-semibold">{progressStatus}</span>
                </div>
              </div>

              <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto p-6 space-y-5"
              >
                {/* ??$$$ newer code — completion actions block */}
                {isCompleted && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-5 text-zinc-300 space-y-4 shadow-xl mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-zinc-100">Formulation Completed Successfully!</h4>
                        <p className="text-[11px] text-zinc-400">All components, wiring layouts, and instructions are finalized.</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-3 border-t border-zinc-800/80">
                      <button
                        onClick={handleExportLocal}
                        disabled={exporting}
                        className="flex items-center gap-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 px-3.5 py-2 text-xs font-semibold text-zinc-200 transition-all disabled:opacity-50 active:scale-[0.98]"
                      >
                        <HardDrive className="h-3.5 w-3.5 text-emerald-400" />
                        {exporting ? "Exporting..." : "Export Data to local E:"}
                      </button>
                      <button
                        onClick={handleGoToSimulator}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-4 py-2 text-xs font-bold text-zinc-950 transition-all active:scale-[0.98]"
                      >
                        <PlayCircle className="h-3.5 w-3.5" />
                        Open Virtual Playground
                      </button>
                    </div>
                  </div>
                )}

                {logs.length === 0 && (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-500 text-xs italic">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-transparent" />
                    Waiting for agent to initialize loop...
                  </div>
                )}
                {logs.map((log, i) => {
                  const key = i;
                  const timestampStr = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : "";

                  if (log.type === "context_received") {
                    const input = log.input || {};
                    return (
                      <div key={key} className="p-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-zinc-300 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                            <Cpu className="h-4 w-4 text-emerald-400 animate-pulse" />
                            <span>✦ AI Received Formulation Context</span>
                          </div>
                          <span className="text-[10px] text-zinc-500 font-mono">{timestampStr}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-zinc-800/60">
                          <div>
                            <span className="text-zinc-500 font-semibold">Core Purpose:</span>
                            <p className="text-zinc-300 mt-0.5">{input.corePurpose || "N/A"}</p>
                          </div>
                          <div>
                            <span className="text-zinc-500 font-semibold">Compute Brain (MCU):</span>
                            <p className="text-zinc-300 mt-0.5">{input.mcu || "N/A"}</p>
                          </div>
                        </div>

                        <div className="text-xs space-y-1">
                          <span className="text-zinc-500 font-semibold">Subsystems:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {input.subsystems?.length > 0 ? (
                              input.subsystems.map((sub: string, sIdx: number) => (
                                <span key={sIdx} className="rounded bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300">
                                  {sub}
                                </span>
                              ))
                            ) : (
                              <span className="text-zinc-650 italic">None</span>
                            )}
                          </div>
                        </div>

                        {input.constraints?.length > 0 && (
                          <div className="text-xs pt-1">
                            <span className="text-zinc-500 font-semibold">Constraints:</span>
                            <ul className="list-disc list-inside space-y-0.5 text-zinc-400 mt-1 pl-1">
                              {input.constraints.map((c: string, cIdx: number) => (
                                <li key={cIdx}>{c}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  }

                  if (log.type === "thinking") {
                    return (
                      <div key={key} className="flex gap-3 items-start max-w-2xl">
                        <div className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                          AI
                        </div>
                        <div className="flex-1 p-4 rounded-xl bg-zinc-900/40 border border-zinc-850 text-zinc-200 space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                            <span>Thinking Monologue</span>
                            <span>{timestampStr}</span>
                          </div>
                          <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap font-sans text-xs">{log.text}</p>
                        </div>
                      </div>
                    );
                  }

                  if (log.type === "tool_call") {
                    const isRunning = log.status === "running";
                    const isFailed = log.status === "failed";
                    const isDone = log.status === "done";

                    return (
                      <div key={key} className="flex gap-3 items-start max-w-2xl pl-10">
                        <div className="h-6 w-6 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                          &gt;_
                        </div>
                        <div className="flex-1 p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-900 space-y-2 font-mono">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="inline-flex items-center gap-1 rounded bg-zinc-900 border border-zinc-800 px-2 py-0.5 font-bold text-emerald-400">
                              {log.name}
                            </span>
                            <span className={`font-semibold ${isRunning ? "text-amber-400" : isFailed ? "text-red-400" : "text-zinc-400"
                              }`}>
                              {log.status?.toUpperCase()}
                            </span>
                          </div>

                          {log.input && (
                            <details className="text-[10px] text-zinc-500 cursor-pointer" open>
                              <summary className="hover:text-zinc-400 select-none">Arguments</summary>
                              <pre className="overflow-x-auto text-[10px] bg-black/40 p-2 rounded border border-zinc-900 mt-1 cursor-text">
                                {JSON.stringify(log.input, null, 2)}
                              </pre>
                            </details>
                          )}

                          {log.output && (
                            <details className="text-[10px] text-zinc-500 cursor-pointer" open>
                              <summary className="hover:text-zinc-400 select-none">Output</summary>
                              <pre className="overflow-x-auto text-[10px] bg-zinc-900/20 p-2 rounded border border-zinc-900/60 mt-1 cursor-text max-h-40">
                                {JSON.stringify(log.output, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    );
                  }

                  if (log.type === "decision") {
                    return (
                      <div key={key} className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 text-blue-300 max-w-2xl">
                        <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono mb-2">
                          <span>DECISION</span>
                          <span>{timestampStr}</span>
                        </div>
                        <p className="font-sans text-xs">{log.text}</p>
                      </div>
                    );
                  }

                  if (log.type === "error") {
                    return (
                      <div key={key} className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 max-w-2xl">
                        <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono mb-2">
                          <span>ERROR</span>
                          <span>{timestampStr}</span>
                        </div>
                        <p className="font-sans text-xs">{log.text}</p>
                      </div>
                    );
                  }

                  if (log.type === "rate_limit") {
                    return (
                      <div key={key} className="max-w-2xl">
                        <RateLimitTimer
                          delaySeconds={log.input?.delaySeconds || 60}
                          timestamp={log.timestamp}
                        />
                      </div>
                    );
                  }

                  return null;
                })}
                {isFailed && !isCompleted && (
                  <div className="rounded-xl border border-red-500/20 bg-red-950/10 p-5 max-w-2xl text-zinc-300 space-y-3">
                    <div className="flex items-center gap-2.5 text-red-400 font-bold text-xs">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Formulation Interrupted</span>
                    </div>
                    <p className="text-xs text-zinc-450 leading-relaxed">
                      The formulation loop stopped. You can resume from where it was left off without starting from scratch.
                    </p>
                    <button
                      onClick={handleResume}
                      disabled={loading}
                      className="flex items-center gap-1.5 rounded-lg bg-red-500 hover:bg-red-450 px-4 py-2 text-xs font-bold text-zinc-950 transition-all active:scale-[0.98]"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                      {loading ? "Resuming..." : "Resume Formulation"}
                    </button>
                  </div>
                )}
                <div ref={logEndRef} />
              </div>
            </div>

            {/* Spec / Preview - Right Panel */}
            <div className="w-1/2 flex flex-col bg-zinc-900/20 overflow-hidden">
              <div className="flex h-12 items-center justify-between border-b border-zinc-800 bg-zinc-900/40 px-6">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Spec Formulation Preview
                </span>
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* BOM Panel */}
                <div className="space-y-3">
                  <h4 className="flex items-center gap-2 text-xs font-bold text-zinc-300">
                    <Database className="h-4 w-4 text-emerald-400" /> Bill of Materials
                  </h4>
                  {bom.length > 0 ? (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 divide-y divide-zinc-850">
                      {bom.map((item, idx) => (
                        <div key={idx} className="p-3 text-xs flex justify-between items-center">
                          <div>
                            <div className="font-semibold text-zinc-200">{item.displayName}</div>
                            <div className="text-[10px] text-zinc-500">Key: {item.key} · Role: {item.purpose}</div>
                          </div>
                          <span className="rounded bg-zinc-800 px-2 py-0.5 text-zinc-400">
                            Qty: {item.qty}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-xs text-zinc-600">
                      No components finalized yet.
                    </div>
                  )}
                </div>

                {/* Wiring List */}
                <div className="space-y-3">
                  <h4 className="flex items-center gap-2 text-xs font-bold text-zinc-300">
                    <Layers className="h-4 w-4 text-blue-400" /> Wiring Connection Matrix
                  </h4>
                  {wiring.length > 0 ? (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 divide-y divide-zinc-850 max-h-48 overflow-y-auto">
                      {wiring.map((conn, idx) => (
                        <div key={idx} className="p-3 text-[11px] font-mono flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-400">{conn.from}</span>
                            <span className="text-zinc-650">→</span>
                            <span className="text-emerald-400">{conn.to}</span>
                          </div>
                          <span
                            className="rounded px-1.5 py-0.5 text-[9px] font-bold text-zinc-950"
                            style={{ backgroundColor: conn.color || "#888888" }}
                          >
                            {conn.net}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-xs text-zinc-600">
                      Wiring netlists not generated.
                    </div>
                  )}
                </div>

                {/* Milestone Curriculum */}
                <div className="space-y-3">
                  <h4 className="flex items-center gap-2 text-xs font-bold text-zinc-300">
                    <CheckCircle className="h-4 w-4 text-purple-400" /> Milestone Curriculum
                  </h4>
                  {milestones.length > 0 ? (
                    <div className="space-y-2">
                      {milestones.map((m, idx) => (
                        <div key={idx} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 flex gap-3 items-start">
                          <div className="h-6 w-6 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 font-bold text-xs flex items-center justify-center flex-shrink-0">
                            {idx + 1}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-zinc-200">{m.title}</div>
                            <p className="text-[10px] text-zinc-500 mt-0.5">{m.objective}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-xs text-zinc-600">
                      Milestone steps not generated.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
