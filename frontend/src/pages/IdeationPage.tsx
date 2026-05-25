// @ts-nocheck
// ??$$$ Refactored IdeationPage with clean dual-agent architecture, removing legacy tool/thinking and context selectors
import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { useProjectStore } from "../store/useProjectStore";

// ??$$$ ChatMessage component per Section 8
function ChatMessage({ role, content }) {
  const isUser = role === "user";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        marginBottom: "20px",
        width: "100%"
      }}
    >
      <div style={{
        fontSize: "0.68rem",
        fontWeight: 700,
        color: isUser ? "#f97316" : "#a1a1aa",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        marginBottom: "4px"
      }}>
        {isUser ? "User" : "Ideation Agent"}
      </div>
      <div
        style={{
          maxWidth: "85%",
          padding: "10px 14px",
          borderRadius: isUser ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
          background: isUser ? "rgba(249, 115, 22, 0.1)" : "rgba(255, 255, 255, 0.03)",
          border: isUser ? "1px solid rgba(249, 115, 22, 0.2)" : "1px solid rgba(255, 255, 255, 0.08)",
          color: isUser ? "#ffffff" : "#e4e4e7",
          fontSize: "0.85rem",
          lineHeight: 1.5,
          whiteSpace: "pre-wrap"
        }}
      >
        {content}
      </div>
    </div>
  );
}

export default function IdeationPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const scrollRef = useRef(null);

  const { project, refreshStageStatus } = useProjectStore();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [finalizing, setFinalizing] = useState(false);

  const isFinalized = project?.ideation?.readyForComponents === true;

  // Auto-scroll chat history
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const bootCalledRef = useRef(false);

  // ??$$$ Boot project data - stripped voice/thinking/snapshot per Section 8 instructions
  useEffect(() => {
    const boot = async () => {
      if (!id) return;
      if (bootCalledRef.current) return;
      bootCalledRef.current = true;
      try {
        // Load target project
        await useProjectStore.getState().loadProject(id);
        const proj = useProjectStore.getState().project;
        const history = proj?.ideation?.messages || [];

        if (history.length > 0) {
          setMessages(history);
        } else {
          setLoading(true);
          await axiosInstance.post(
            `/ideation/project/chat`,
            { projectId: id, message: proj.description || "Start my project" },
            { withCredentials: true }
          );
          await refreshStageStatus();
          await useProjectStore.getState().loadProject(id);
          const updatedProj = useProjectStore.getState().project;
          setMessages(updatedProj?.ideation?.messages || []);
        }
      } catch (err) {
        console.error("[IdeationPage] boot error:", err);
        toast.error("Failed to load ideation — try refreshing");
      } finally {
        setBooting(false);
        setLoading(false);
      }
    };
    boot();
  }, [id]);

  // ??$$$ Send message handler - calls stateless chat endpoint per Section 8
  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);

    try {
      await axiosInstance.post(
        `/ideation/project/chat`,
        { projectId: id, message: text },
        { withCredentials: true }
      );
      await refreshStageStatus();
      await useProjectStore.getState().loadProject(id);
      const updatedProj = useProjectStore.getState().project;
      setMessages(updatedProj?.ideation?.messages || []);
    } catch (err) {
      const msg = err?.response?.data?.error || "Chat failed";
      toast.error(msg);
      // Try to reload current messages on failure to restore state
      await useProjectStore.getState().loadProject(id);
      const updatedProj = useProjectStore.getState().project;
      setMessages(updatedProj?.ideation?.messages || []);
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async () => {
    if (!isFinalized || finalizing) return;
    setFinalizing(true);
    try {
      navigate(`/project/${id}/components`);
    } catch (err) {
      toast.error("Failed to navigate to components");
    } finally {
      setFinalizing(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 52px)",
        background: "#09090b",
        color: "#f4f4f5",
        fontFamily: "'Inter', sans-serif"
      }}
    >
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
      `}</style>

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "#09090b",
          height: "60px",
          flexShrink: 0
        }}
      >
        <div>
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 800,
              letterSpacing: "0.15em",
              color: "#f97316",
              textTransform: "uppercase"
            }}
          >
            WIREUP.AI
          </span>
          <div
            style={{
              fontSize: "0.7rem",
              color: "#71717a",
              fontWeight: 500,
              marginTop: "2px"
            }}
          >
            Multi-Agent Hardware Design
          </div>
        </div>
      </div>

      {/* Main Content (Split-screen) */}
      <div
        style={{
          flex: 1,
          display: "flex",
          minHeight: 0,
          overflow: "hidden"
        }}
      >
        {/* Left Column: Ideation Agent Panel */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            borderRight: "1px solid rgba(255,255,255,0.08)",
            background: "#09090b",
            minWidth: 0
          }}
        >
          {/* Panel Header */}
          <div
            style={{
              padding: "14px 20px",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
              background: "#09090b",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexShrink: 0
            }}
          >
            <span style={{ fontSize: "1.1rem" }}>🧠</span>
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#e4e4e7" }}>
                Ideation Agent
              </div>
              <div style={{ fontSize: "0.68rem", color: "#71717a" }}>
                Conversational Requirements Interviewer
              </div>
            </div>
          </div>

          {/* Conversation History */}
          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "20px"
            }}
          >
            {booting ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "12px" }}>
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    border: "2px solid rgba(255,255,255,0.05)",
                    borderTop: "2px solid #f97316",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite"
                  }}
                />
                <span style={{ fontSize: "0.78rem", color: "#71717a" }}>Booting agent session...</span>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <ChatMessage key={i} role={msg.role} content={msg.content} />
                ))}
                {loading && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 12px",
                      borderRadius: "12px",
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.05)",
                      alignSelf: "flex-start",
                      width: "fit-content",
                      marginTop: "10px"
                    }}
                  >
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: "#f97316",
                        animation: "pulse 1s infinite"
                      }}
                    />
                    <span style={{ fontSize: "0.78rem", color: "#a1a1aa" }}>Agent is writing...</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right Column: Validation Agent Panel */}
        <div
          style={{
            width: "45%",
            display: "flex",
            flexDirection: "column",
            background: "#09090b",
            minWidth: "320px"
          }}
        >
          {/* Panel Header */}
          <div
            style={{
              padding: "14px 20px",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
              background: "#09090b",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "1.1rem" }}>🛡️</span>
              <div>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#e4e4e7" }}>
                  Validation Agent
                </div>
                <div style={{ fontSize: "0.68rem", color: "#71717a" }}>
                  Automated Architecture Auditor
                </div>
              </div>
            </div>

            {/* Status Indicator */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 8px",
                borderRadius: "6px",
                background: isFinalized
                  ? "rgba(16,185,129,0.08)"
                  : project?.ideation?.validationAttempts > 0
                  ? "rgba(239,68,68,0.08)"
                  : "rgba(113,113,122,0.08)",
                border: `1px solid ${
                  isFinalized
                    ? "rgba(16,185,129,0.15)"
                    : project?.ideation?.validationAttempts > 0
                    ? "rgba(239,68,68,0.15)"
                    : "rgba(113,113,122,0.15)"
                }`
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: isFinalized
                    ? "#10b981"
                    : project?.ideation?.validationAttempts > 0
                    ? "#ef4444"
                    : "#71717a"
                }}
              />
              <span
                style={{
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  color: isFinalized
                    ? "#10b981"
                    : project?.ideation?.validationAttempts > 0
                    ? "#ef4444"
                    : "#71717a",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em"
                }}
              >
                {isFinalized ? "Approved" : project?.ideation?.validationAttempts > 0 ? "Flagged" : "Idle"}
              </span>
            </div>
          </div>

          {/* Validation reports & structured brief content */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "16px"
            }}
          >
            {/* Feedback alert panel */}
            {project?.ideation?.validatorFeedback ? (
              <div
                style={{
                  background: "rgba(239,68,68,0.04)",
                  border: "1px solid rgba(239,68,68,0.15)",
                  borderRadius: "8px",
                  padding: "14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#f87171", fontSize: "0.8rem", fontWeight: 700 }}>
                  <span>⚠️ Architecture Issue Identified</span>
                </div>
                <div style={{ fontSize: "0.8rem", color: "#fca5a5", lineHeight: 1.45 }}>
                  {project.ideation.validatorFeedback}
                </div>
                <div style={{ fontSize: "0.72rem", color: "#71717a", marginTop: "4px" }}>
                  Attempts: {project.ideation.validationAttempts}
                </div>
              </div>
            ) : isFinalized ? (
              <div
                style={{
                  background: "rgba(16,185,129,0.04)",
                  border: "1px solid rgba(16,185,129,0.15)",
                  borderRadius: "8px",
                  padding: "14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}
              >
                <span style={{ color: "#34d399", fontSize: "1.1rem" }}>✓</span>
                <div style={{ fontSize: "0.8rem", color: "#a7f3d0" }}>
                  Architecture validated and approved. Ready to proceed.
                </div>
              </div>
            ) : (
              <div
                style={{
                  border: "1px dashed rgba(255,255,255,0.08)",
                  borderRadius: "8px",
                  padding: "20px",
                  textAlign: "center",
                  color: "#71717a",
                  fontSize: "0.8rem",
                  fontStyle: "italic"
                }}
              >
                No validation reports generated yet. The validator will analyze the project brief once requirements are sufficiently defined.
              </div>
            )}

            {/* Structured project brief preview */}
            {(project?.ideation?.brief || project?.ideation?.objective) && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "10px" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Active Structured Brief
                </div>

                <div
                  style={{
                    background: "rgba(255,255,255,0.01)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    borderRadius: "8px",
                    padding: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px"
                  }}
                >
                  {project.ideation.objective && (
                    <div>
                      <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                        Objective
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#e4e4e7", lineHeight: 1.4 }}>
                        {project.ideation.objective}
                      </div>
                    </div>
                  )}

                  {project.ideation.compute && (
                    <div>
                      <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                        Compute Core
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#e4e4e7", lineHeight: 1.4 }}>
                        {project.ideation.compute}
                      </div>
                    </div>
                  )}

                  {project.ideation.phases && Object.keys(project.ideation.phases).length > 0 && (
                    <div>
                      <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
                        Subsystems & Phases
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {Object.entries(project.ideation.phases).map(([phaseName, phaseDesc]) => (
                          <div
                            key={phaseName}
                            style={{
                              background: "rgba(255,255,255,0.02)",
                              border: "1px solid rgba(255,255,255,0.04)",
                              borderRadius: "6px",
                              padding: "8px 10px"
                            }}
                          >
                            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#e4e4e7", marginBottom: "2px" }}>
                              {phaseName}
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "#a1a1aa", lineHeight: 1.35 }}>
                              {phaseDesc}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {project.ideation.constraints && (
                    <div>
                      <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                        Constraints
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#e4e4e7", lineHeight: 1.4 }}>
                        {project.ideation.constraints}
                      </div>
                    </div>
                  )}

                  {project.ideation.open && (
                    <div>
                      <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                        Open Questions
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#e4e4e7", lineHeight: 1.4 }}>
                        {project.ideation.open}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Input area & Proceed action */}
      <div
        style={{
          padding: "16px 24px",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          background: "#09090b",
          flexShrink: 0
        }}
      >
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          {/* Input field */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSend();
              }
            }}
            placeholder={isFinalized ? "Architecture approved. Click Proceed to begin component sourcing." : "Provide additional details or answer the agent's questions..."}
            disabled={loading || isFinalized}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.12)",
              background: isFinalized ? "rgba(255,255,255,0.01)" : "rgba(255,255,255,0.02)",
              color: isFinalized ? "#71717a" : "#f4f4f5",
              fontSize: "0.875rem",
              outline: "none"
            }}
          />

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={loading || !input.trim() || isFinalized}
            style={{
              padding: "12px 24px",
              borderRadius: "8px",
              background: loading || !input.trim() || isFinalized ? "rgba(255,255,255,0.04)" : "#f97316",
              color: loading || !input.trim() || isFinalized ? "#52525b" : "#ffffff",
              fontWeight: 700,
              fontSize: "0.875rem",
              border: "none",
              cursor: loading || !input.trim() || isFinalized ? "not-allowed" : "pointer",
              transition: "background 0.15s"
            }}
          >
            Send
          </button>

          {/* Proceed to Components Button if approved */}
          {isFinalized && (
            <button
              onClick={handleFinalize}
              disabled={finalizing}
              style={{
                padding: "12px 24px",
                borderRadius: "8px",
                background: "#10b981",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "0.875rem",
                border: "none",
                cursor: "pointer",
                transition: "background 0.15s"
              }}
            >
              {finalizing ? "Finalizing..." : "Proceed to Sourcing →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
