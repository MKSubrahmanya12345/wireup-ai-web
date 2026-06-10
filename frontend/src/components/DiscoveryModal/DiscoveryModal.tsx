// ??$$$ group 2 - Ideation Stage (Phase 1)
// ??$$$ NEW FLOW
import React, { useState, useEffect, useRef, useMemo } from "react";
import { Socket } from "socket.io-client";
import { axiosInstance } from "../../lib/axios";
import { useThemeStore } from "../../store/useThemeStore.ts";
import { DiscoveryPhase } from "./phases/DiscoveryPhase";
import { X, HardDrive, Layers, Cpu } from "lucide-react"; // ??$$$ newer code
import toast from "react-hot-toast";
import { FormulationPhase } from "./phases/FormulationPhase";
import { useSessionRestore } from "./hooks/useSessionRestore";
import { useFormulationSocket } from "./hooks/useFormulationSocket";
import { useDiscoverySession } from "./hooks/useDiscoverySession";
import { getProgressPercent, getProgressStatus } from "./selectors/progress.selectors";
import { getCandidateParts, getDecisionReasons } from "./selectors/decision.selectors";
import { getActiveStage } from "./selectors/stage.selectors";
import { getConflictDetails } from "./selectors/conflict.selectors";
import { ModelSelector } from "./components/ModelSelector";

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
  const { theme } = useThemeStore();
  const dark = theme === "dark";
  const virtualPlaygroundUrl = (import.meta.env.VITE_VIRTUAL_PLAYGROUND_URL || "http://localhost:5174").replace(/\/$/, "");
  // ??$$$ NEW FLOW
  const [model, setModel] = useState("qwen/qwen3-32b");
  // ??$$$ newer code - hybrid primary provider selection
  const [hybridPrimary, setHybridPrimary] = useState("qwen/qwen3-32b");
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
  const [requirementsDoc, setRequirementsDoc] = useState("");
  const [qaHistory, setQaHistory] = useState<any[]>([]);
  const [context, setContext] = useState({
    corePurpose: "",
    mcu: "",
    subsystems: {
      inputs: [],
      outputs: [],
      communication: [],
      storage: [],
      power: []
    },
    formFactor: "",
    powerSource: "",
    connectivity: [],
    estimatedBudget: "",
    constraints: [],
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

  // ??$$$ newer code
  const [blueprint, setBlueprint] = useState<any>(null);
  const [showContextModal, setShowContextModal] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // ??$$$ newer code — Visual Progress Calculations
  const progressPercent = useMemo(
    () =>
      getProgressPercent(
        bom,
        wiring,
        milestones,
        logs,
        isCompleted,
        isFailed
      ),
    [bom, wiring, milestones, logs, isCompleted, isFailed]
  );

  const progressStatus = useMemo(
    () =>
      getProgressStatus(
        progressPercent,
        isCompleted,
        isFailed
      ),
    [progressPercent, isCompleted, isFailed]
  );

  const candidates = useMemo(
    () => getCandidateParts(logs, bom),
    [logs, bom]
  );

  const decisions = useMemo(
    () => getDecisionReasons(logs),
    [logs]
  );

  const activeStage = useMemo(
    () =>
      getActiveStage(
        logs,
        bom,
        wiring,
        milestones,
        isCompleted,
        isFailed
      ),
    [
      logs,
      bom,
      wiring,
      milestones,
      isCompleted,
      isFailed
    ]
  );

  const conflictDetails = useMemo(
    () => getConflictDetails(logs),
    [logs]
  );

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


  // ??$$$ newer code — start discovery session on mount supporting localStorage caching & restore on reload
  useSessionRestore({
    projectId,
    initialIdea,
    initialPhase,

    onClose,

    setLoading,
    setSessionId,

    setQuestion,
    setOptions,
    setContext,
    setRequirementsDoc,
    setQaHistory,

    setBom,
    setWiring,
    setMilestones,
    setLogs,

    setStarted,
    setPhase,
    setShouldAutoFormulate,

    setIsCompleted,
    setCompletedProjectId,
    setFinalSketch,
    setBlueprint
  });

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
      setRequirementsDoc(res.data.requirementsDoc || "");
      setQaHistory(res.data.qaHistory || []);
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

  const handleRestartDiscovery = async () => {
    if (!sessionId) return;

    setLoading(true);

    try {
      const res = await axiosInstance.post("/new-flow/restart", {
        sessionId,
      });

      setQuestion(res.data.question || "");
      setOptions(res.data.options || []);
      setContext(res.data.context || {});
      setRequirementsDoc(res.data.requirementsDoc || "");
      setQaHistory(res.data.qaHistory || []);

      setPhase(1);

      toast.success("Discovery Q&A restarted!");
    } catch {
      toast.error("Failed to restart discovery.");
    } finally {
      setLoading(false);
    }
  };

  useFormulationSocket({
    phase,
    sessionId,

    shouldAutoFormulate,
    setShouldAutoFormulate,

    setLogs,
    setBom,
    setWiring,
    setMilestones,

    setFinalSketch,

    setIsCompleted,
    setIsFailed,

    setCompletedProjectId,

    setModel,

    socketRef,

    getSocketUrl,
    setBlueprint
  });

  // ??$$$ newer code — Fallback polling for session completion (every 5 seconds)
  useDiscoverySession({
    sessionId,
    phase,
    isCompleted,

    setIsCompleted,
    setIsFailed,
    setCompletedProjectId,

    setBom,
    setWiring,
    setMilestones,
    setLogs,
    setFinalSketch,
    setBlueprint
  });

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
      setRequirementsDoc(res.data.requirementsDoc || "");
      setQaHistory(res.data.qaHistory || []);
      setAnswerText("");
      if (res.data.done) {
        setQuestion("");
      }
    } catch (err: any) {
      toast.error("Failed to send answer.");
    } finally {
      setSubmitting(false);
    }
  };



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
          setRequirementsDoc(answerRes.data.requirementsDoc || "");
          setQaHistory(answerRes.data.qaHistory || []);
          setAnswerText("");
        } catch (e) {
          console.error("Failed to submit final typed answer before skipping:", e);
        }
      }
      const res = await axiosInstance.post("/new-flow/proceed", { sessionId });
      if (res.data) {
        if (res.data.context) setContext(res.data.context);
        if (res.data.requirementsDoc) setRequirementsDoc(res.data.requirementsDoc);
        if (res.data.qaHistory) setQaHistory(res.data.qaHistory);
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
  const handleGoToSimulator = async () => {
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

    try {
      await axiosInstance.post("/new-flow/export-local", { sessionId });
    } catch (err) {
      console.error("Failed to export formulation before opening the playground:", err);
      toast.error("Failed to export formulation data for the playground.");
      return;
    }

    localStorage.removeItem("wireup_discovery_session_id");
    onClose();
    window.location.href = `${virtualPlaygroundUrl}/?${params.toString()}`;
  };

  // ??$$$ newer code - Launch Behavior simulation directly without local E: export
  const handleGoToBehaviorSim = () => {
    if (!sessionId) return;
    const params = new URLSearchParams({ sessionId, mode: "behavior" });
    if (completedProjectId) params.set("projectId", completedProjectId);
    localStorage.removeItem("wireup_discovery_session_id");
    onClose();
    window.open(`${virtualPlaygroundUrl}/?${params.toString()}`, "_blank");
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

  // ── Derived theme tokens ──────────────────────────────────────────────────
  // ??$$$ newer code - VSCode monochromatic styling
  const modalBg = "bg-[#1e1e1e]";
  const headerBg = "bg-[#252526] border-[#2d2d2d]";
  const textHead = "text-white";
  const textSub = "text-zinc-500";
  const selectCls = "rounded border border-[#3c3c3c] bg-[#1e1e1e] px-2 py-1 text-xs text-zinc-200 outline-none focus:border-[#007acc] transition-colors";

  return (
    <div className={`fixed inset-0 z-50 flex flex-col font-sans antialiased overflow-hidden text-zinc-350 bg-[#1e1e1e]`}>
      
      {/* ── Top Header ── */}
      <header className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b border-[#2d2d2d] px-6 bg-[#252526]">
        
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-[#1e1e1e] border border-[#2d2d2d] text-[#007acc]">
            <Cpu className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-xs font-bold text-white uppercase tracking-wider">
              AI Build Session
            </h1>
            <p className="text-[10px] text-zinc-500 font-mono">
              {phase === 1 ? "Discovery Loop" : "Autonomous Formulation Pipeline"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Model Selector */}
          {started && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-400 font-mono">Agent Brain:</span>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className={selectCls}
              >
                {/* ??$$$ newer code */}
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="gpt-oss-120b">Cerebras gpt-oss-120b</option>
                <option value="zai-glm-4.7">Cerebras zai-glm-4.7</option>
                <option value="qwen/qwen3-32b">Groq Llama 4 Scout</option>
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
            className="flex h-7 w-7 items-center justify-center rounded text-zinc-400 hover:bg-[#333333] hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 overflow-hidden">
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <div className={`h-8 w-8 animate-spin rounded-full border-[3px] border-t-transparent ${dark ? "border-indigo-500" : "border-indigo-400"}`} />
            <p className={`text-sm ${textSub}`}>Booting discovery pipelines…</p>
          </div>
        ) : !started ? (
          <ModelSelector
            dark={dark}
            textHead={textHead}
            textSub={textSub}
            initialIdea={initialIdea}

            model={model}
            setModel={setModel}

            hybridPrimary={hybridPrimary}
            setHybridPrimary={setHybridPrimary}

            handleStartSession={handleStartSession}
          />

        ) : phase === 1 ? (
          <DiscoveryPhase
            question={question}
            options={options}
            answerText={answerText}
            setAnswerText={setAnswerText}
            submitting={submitting}
            loading={loading}
            sessionId={sessionId}
            context={context}
            requirementsDoc={requirementsDoc}
            qaHistory={qaHistory}
            initialIdea={initialIdea}
            dark={dark}
            textHead={textHead}
            textSub={textSub}
            model={model}
            setModel={setModel}
            hybridPrimary={hybridPrimary}
            setHybridPrimary={setHybridPrimary}
            handleAnswer={handleAnswer}
            handleProceed={handleProceed}
            handleStartSession={handleStartSession}
            handleRestartDiscovery={handleRestartDiscovery}
            setPhase={setPhase}
            setShouldAutoFormulate={setShouldAutoFormulate}
          />
        ) : (
          <FormulationPhase
            dark={dark}
            isCompleted={isCompleted}
            isFailed={isFailed}
            activeStage={activeStage}
            workspaceTab={workspaceTab}
            setWorkspaceTab={setWorkspaceTab}
            logs={logs}
            bom={bom}
            wiring={wiring}
            milestones={milestones}
            context={context}
            candidates={candidates}
            decisions={decisions}
            conflictDetails={conflictDetails}
            exporting={exporting}
            restarting={restarting}
            loading={loading}
            rescuing={rescuing}
            selectedLog={selectedLog}
            setSelectedLog={setSelectedLog}
            finalSketch={finalSketch}
            scrollContainerRef={scrollContainerRef}
            handleRestart={handleRestart}
            handleGoToSimulator={handleGoToSimulator}
            // ??$$$ newer code - Behavior Sim handler
            handleGoToBehaviorSim={handleGoToBehaviorSim}
            handleExportLocal={handleExportLocal}
            handleCopyAllData={handleCopyAllData}
            handleResume={handleResume}
            handleRescue={handleRescue}
            resolveConflict={resolveConflict}
            // ??$$$ old code
            /*
            blueprint={blueprint}
            requirementsDoc={requirementsDoc}
            setShowContextModal={setShowContextModal}
            */
            // ??$$$ newer code
            blueprint={blueprint}
            requirementsDoc={requirementsDoc}
            setShowContextModal={setShowContextModal}
            sessionId={sessionId}
          />

        )}
      </div>
      {/* ??$$$ newer code */}
      {showContextModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" onClick={() => setShowContextModal(false)}>
          <div className="relative flex flex-col w-full max-w-4xl h-[80vh] rounded-2xl border border-white/10 bg-[#0d0d12] p-6 shadow-2xl transition-all" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
              <h3 className="text-lg font-bold text-slate-100">Shared Context (Transparency)</h3>
              <button onClick={() => setShowContextModal(false)} className="text-zinc-400 hover:text-zinc-100 text-xl">×</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
              <div>
                <h4 className="text-sm font-semibold text-slate-300 mb-2">Requirements Document (PRD)</h4>
                <pre className="whitespace-pre-wrap rounded-xl border border-white/5 bg-white/[0.02] p-4 text-xs font-mono text-slate-300 select-text leading-relaxed">
                  {requirementsDoc || "No PRD yet."}
                </pre>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-300 mb-2">System Blueprint (Architect)</h4>
                <pre className="whitespace-pre-wrap rounded-xl border border-white/5 bg-white/[0.02] p-4 text-xs font-mono text-slate-300 select-text leading-relaxed">
                  {blueprint ? JSON.stringify(blueprint, null, 2) : "Blueprint not generated yet."}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};