// ??$$$ newer code — ProjectChatPanel: live AI assistant sidebar for FormulationPhase
import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader, Sparkles, RotateCcw } from "lucide-react";
import { axiosInstance } from "../../../lib/axios";

interface Message {
  role: "user" | "assistant";
  content: string;
  ts?: string;
}

interface ProjectChatPanelProps {
  sessionId: string | null;
  bom?: any[];
  context?: any;
}

export const ProjectChatPanel: React.FC<ProjectChatPanelProps> = ({
  sessionId,
  bom = [],
  context = {},
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hey! I know your full project — BOM, wiring, MCU, everything. Ask me anything or tell me what to change.",
      ts: new Date().toLocaleTimeString(),
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Quick-prompt suggestions
  const quickPrompts = [
    "What MCU was chosen and why?",
    "Can I add a temperature sensor?",
    "Swap ESP32 for Arduino Uno",
    "What's the power draw estimate?",
    "Explain the wiring plan",
  ];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading || !sessionId) return;

    const userMsg: Message = { role: "user", content: msg, ts: new Date().toLocaleTimeString() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await axiosInstance.post("/new-flow/chat", {
        sessionId,
        message: msg,
        history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
      });
      const assistantMsg: Message = {
        role: "assistant",
        content: res.data.reply || "Got it.",
        ts: new Date().toLocaleTimeString(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `Error: ${err.response?.data?.error || "LLM call failed. Try again."}`,
        ts: new Date().toLocaleTimeString(),
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleClear = () => {
    setMessages([{
      role: "assistant",
      content: "Chat cleared. Ask me anything about your project.",
      ts: new Date().toLocaleTimeString(),
    }]);
  };

  return (
    <div style={{
      width: 300,
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      background: "#0d0d12",
      borderLeft: "1px solid rgba(255,255,255,0.07)",
      overflow: "hidden",
      fontFamily: "var(--font-sans, Inter, sans-serif)",
    }}>

      {/* Header */}
      <div style={{
        padding: "10px 14px 9px",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
        background: "#111118",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "rgba(200,160,224,0.15)",
            border: "1px solid rgba(200,160,224,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Sparkles size={13} color="#c8a0e0" />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#f0f0f5", letterSpacing: "0.02em" }}>
              Project AI
            </div>
            <div style={{ fontSize: 9, color: "#8888a8" }}>
              {sessionId ? "Context loaded ✓" : "No session"}
            </div>
          </div>
        </div>
        <button
          onClick={handleClear}
          title="Clear chat"
          style={{
            background: "none", border: "none", cursor: "pointer",
            padding: 4, color: "#8888a8", display: "flex", alignItems: "center",
          }}
        >
          <RotateCcw size={12} />
        </button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "12px 10px",
        display: "flex", flexDirection: "column", gap: 10,
      }} className="ide-scroll">

        {messages.map((msg, i) => (
          <div key={i} style={{
            display: "flex",
            flexDirection: msg.role === "user" ? "row-reverse" : "row",
            alignItems: "flex-end",
            gap: 6,
          }}>
            {/* Avatar */}
            <div style={{
              width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: msg.role === "assistant"
                ? "rgba(200,160,224,0.18)"
                : "rgba(255,255,255,0.08)",
              border: msg.role === "assistant"
                ? "1px solid rgba(200,160,224,0.3)"
                : "1px solid rgba(255,255,255,0.12)",
            }}>
              {msg.role === "assistant"
                ? <Bot size={11} color="#c8a0e0" />
                : <User size={11} color="#f0f0f5" />
              }
            </div>

            {/* Bubble */}
            <div style={{
              maxWidth: "82%",
              padding: "8px 11px",
              borderRadius: msg.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
              fontSize: 11.5,
              lineHeight: 1.55,
              color: msg.role === "assistant" ? "#e0e0f0" : "#f0f0f5",
              background: msg.role === "assistant"
                ? "rgba(255,255,255,0.04)"
                : "rgba(200,160,224,0.18)",
              border: msg.role === "assistant"
                ? "1px solid rgba(255,255,255,0.06)"
                : "1px solid rgba(200,160,224,0.3)",
              wordBreak: "break-word",
              whiteSpace: "pre-wrap",
            }}>
              {msg.content}
              {msg.ts && (
                <div style={{ fontSize: 9, color: "rgba(136,136,168,0.6)", marginTop: 4, textAlign: "right" }}>
                  {msg.ts}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
            <div style={{
              width: 22, height: 22, borderRadius: "50%",
              background: "rgba(200,160,224,0.18)",
              border: "1px solid rgba(200,160,224,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Bot size={11} color="#c8a0e0" />
            </div>
            <div style={{
              padding: "8px 12px",
              borderRadius: "12px 12px 12px 4px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
              display: "flex", gap: 4, alignItems: "center",
            }}>
              {[0, 1, 2].map(d => (
                <span key={d} style={{
                  width: 5, height: 5, borderRadius: "50%",
                  background: "#c8a0e0",
                  animation: `pulse-soft 1.2s ease-in-out ${d * 0.2}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      {messages.length <= 2 && !loading && (
        <div style={{
          padding: "6px 10px 4px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          display: "flex", flexWrap: "wrap", gap: 5,
          flexShrink: 0,
        }}>
          {quickPrompts.map((q, i) => (
            <button
              key={i}
              onClick={() => send(q)}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 5, padding: "4px 8px",
                fontSize: 10, color: "#9ea3b0",
                cursor: "pointer", lineHeight: 1.4,
                transition: "all 0.12s",
              }}
              onMouseOver={e => {
                e.currentTarget.style.borderColor = "rgba(200,160,224,0.4)";
                e.currentTarget.style.color = "#f0f0f5";
              }}
              onMouseOut={e => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)";
                e.currentTarget.style.color = "#9ea3b0";
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div style={{
        padding: "10px 10px",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        flexShrink: 0,
        background: "#111118",
      }}>
        <div style={{
          display: "flex", gap: 8, alignItems: "center",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: 8, padding: "7px 10px",
          transition: "border-color 0.15s",
        }}
          onFocus={e => e.currentTarget.style.borderColor = "rgba(200,160,224,0.4)"}
          onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder={sessionId ? "Ask about this project…" : "No active session"}
            disabled={!sessionId || loading}
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              fontSize: 11.5, color: "#f0f0f5",
              fontFamily: "inherit",
            }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading || !sessionId}
            style={{
              background: input.trim() && !loading ? "rgba(200,160,224,0.9)" : "transparent",
              border: "none", borderRadius: 5, padding: "4px 7px",
              cursor: input.trim() && !loading ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center",
              transition: "background 0.15s",
            }}
          >
            {loading
              ? <Loader size={13} color="#c8a0e0" style={{ animation: "spin 1s linear infinite" }} />
              : <Send size={13} color={input.trim() && !loading ? "#000" : "#8888a8"} />
            }
          </button>
        </div>
        <div style={{ fontSize: 9, color: "#8888a8", marginTop: 5, textAlign: "center" }}>
          Enter to send · Context: BOM ({bom.length} parts), {context.mcu || "MCU pending"}
        </div>
      </div>

    </div>
  );
};
