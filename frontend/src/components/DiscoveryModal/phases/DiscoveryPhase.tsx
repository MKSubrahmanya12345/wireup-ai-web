// phases/DiscoveryPhase.tsx
// ??$$$ newer code - All-questions-at-once Q&A with chip options (Image 2 pattern)
import React, { useState, useEffect, useRef } from "react";
// ??$$$ newer code - import Cpu for playground/simulation button icons
import { Play, CheckCircle2, Cpu } from "lucide-react";

/* ── palette — matches ProjectQuestionnaire exactly ──────────────────────── */
const Q = {
  bg:       "#0a0a0f",
  card:     "#111118",
  border:   "rgba(255,255,255,0.09)",
  borderHi: "rgba(255,255,255,0.20)",
  chip:     "#16161e",
  chipSel:  "rgba(200,160,224,0.18)",
  chipSelB: "rgba(200,160,224,0.5)",
  text:     "#f0f0f5",
  textDim:  "#8888a8",
  textMid:  "#9ea3b0",
  accent:   "#c8a0e0",
  mono:     "JetBrains Mono, ui-monospace, monospace",
  sans:     "var(--font-sans)",
};

interface QAEntry {
  question: string;
  answer: string;
}

export function DiscoveryPhase(props: any) {
  const {
    question,
    options,
    answerText,
    setAnswerText,
    submitting,
    requirementsDoc,
    qaHistory,
    handleAnswer,
    handleProceed,
    setPhase,
    setShouldAutoFormulate,
    handleRestartDiscovery,
    // ??$$$ newer code - destruct simulation and playground handlers
    sessionId,
    handleGoToSimulator,
    handleGoToBehaviorSim,
  } = props;

  // ??$$$ newer code — local answers for all-at-once display
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [customText, setCustomText] = useState<Record<number, string>>({});

  // Build a list of all Q entries (history + current question if present)
  const allQuestions: QAEntry[] = [...(qaHistory || [])];

  // Current question index in the full list
  const currentIdx = allQuestions.length;
  const hasCurrentQuestion = Boolean(question);

  // Scroll to bottom when new question arrives
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [question, qaHistory]);

  const handlePick = (opt: string) => {
    if (opt === "Other / Custom") {
      // focus the text input
      const el = document.getElementById("discovery-custom-input");
      if (el) el.focus();
    } else {
      handleAnswer(opt);
    }
  };

  const handleCustomSubmit = () => {
    const val = answerText.trim();
    if (val) handleAnswer(val);
  };

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", background: Q.bg }}>

      {/* ── Left: Q&A Feed ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        {/* ??$$$ newer code - Flex header with simulation & playground buttons */}
        <div style={{
          padding: "16px 24px 12px",
          borderBottom: `1px solid ${Q.border}`,
          flexShrink: 0,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}>
          <div>
            <p style={{
              fontFamily: Q.mono, fontSize: 12, fontWeight: 700,
              letterSpacing: "0.12em", textTransform: "uppercase" as const,
              color: Q.text, marginBottom: 4,
            }}>
              Project Discovery
            </p>
            <p style={{ fontFamily: Q.mono, fontSize: 10, color: Q.textDim, lineHeight: 1.5, margin: 0 }}>
              Answer questions to customise hardware architecture, or skip to use AI defaults.
            </p>
          </div>
          {sessionId && (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleGoToSimulator}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  background: "#007acc", border: "none", borderRadius: 4,
                  padding: "6px 12px", cursor: "pointer",
                  fontFamily: Q.mono, fontSize: 10, fontWeight: 700,
                  color: "#fff", textTransform: "uppercase" as const,
                  transition: "background 0.15s"
                }}
              >
                <Play size={10} fill="currentColor" />
                Playground
              </button>
              <button
                onClick={handleGoToBehaviorSim}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  background: Q.chip, border: `1px solid ${Q.borderHi}`, borderRadius: 4,
                  padding: "6px 12px", cursor: "pointer",
                  fontFamily: Q.mono, fontSize: 10, fontWeight: 700,
                  color: Q.textMid, textTransform: "uppercase" as const,
                  transition: "all 0.15s"
                }}
              >
                <Cpu size={10} color="#fbbf24" />
                Behavior Sim
              </button>
            </div>
          )}
        </div>

        {/* Questions feed */}
        <div
          ref={scrollRef}
          style={{ flex: 1, overflowY: "auto", padding: "16px 24px 24px" }}
          className="ide-scroll"
        >
          {/* ??$$$ newer code — previously answered questions (from qaHistory) */}
          {allQuestions.map((entry: QAEntry, i: number) => (
            <div
              key={i}
              style={{
                marginBottom: 24,
                padding: "14px 16px",
                background: Q.chip,
                border: `1px solid ${Q.border}`,
                borderRadius: 6,
                opacity: 0.7,
              }}
            >
              <p style={{ fontFamily: Q.mono, fontSize: 11, color: Q.textDim, marginBottom: 6 }}>
                <span style={{ color: Q.textDim, marginRight: 8 }}>{i + 1}.</span>
                {entry.question}
              </p>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: `${Q.chipSel}`, border: `1px solid ${Q.chipSelB}`,
                borderRadius: 4, padding: "4px 10px",
              }}>
                <CheckCircle2 size={10} color={Q.accent} />
                <span style={{ fontFamily: Q.mono, fontSize: 11, color: Q.accent, fontWeight: 600 }}>
                  {entry.answer}
                </span>
              </div>
            </div>
          ))}

          {/* Current active question */}
          {hasCurrentQuestion ? (
            <div style={{ marginBottom: 8 }}>
              {/* Question label */}
              <div style={{ marginBottom: 12 }}>
                <span style={{
                  fontFamily: Q.mono, fontSize: 10, fontWeight: 700,
                  letterSpacing: "0.1em", textTransform: "uppercase" as const,
                  color: Q.accent, background: `${Q.chipSel}`,
                  border: `1px solid ${Q.chipSelB}`, borderRadius: 4,
                  padding: "3px 8px", display: "inline-block", marginBottom: 10,
                }}>
                  Question {currentIdx + 1}
                </span>
                <h2 style={{
                  fontFamily: Q.mono, fontSize: 13, fontWeight: 600,
                  color: Q.text, lineHeight: 1.55, margin: 0,
                }}>
                  {question}
                </h2>
              </div>

              {/* Option chips grid */}
              {options.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
                  {[...options, "Other / Custom"].map((opt: string, idx: number) => {
                    const isOther = opt === "Other / Custom";
                    return (
                      <button
                        key={idx}
                        onClick={() => handlePick(opt)}
                        disabled={submitting}
                        style={{
                          padding: "10px 14px",
                          background: isOther ? "transparent" : Q.chip,
                          border: `1px ${isOther ? "dashed" : "solid"} ${isOther ? Q.borderHi : Q.border}`,
                          borderRadius: 5,
                          cursor: "pointer",
                          textAlign: "left" as const,
                          fontFamily: Q.mono,
                          fontSize: 11,
                          color: isOther ? Q.textDim : Q.textMid,
                          transition: "all 0.12s",
                          lineHeight: 1.4,
                          opacity: submitting ? 0.5 : 1,
                        }}
                        onMouseOver={e => {
                          e.currentTarget.style.borderColor = Q.accent;
                          e.currentTarget.style.color = Q.text;
                        }}
                        onMouseOut={e => {
                          e.currentTarget.style.borderColor = isOther ? Q.borderHi : Q.border;
                          e.currentTarget.style.color = isOther ? Q.textDim : Q.textMid;
                        }}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Custom text input */}
              <div style={{
                display: "flex", gap: 8,
                background: "#0a0a0f",
                border: `1px solid ${Q.border}`,
                borderRadius: 5, padding: "8px 12px",
                marginBottom: 12,
                transition: "border-color 0.15s",
              }}
                onFocus={e => e.currentTarget.style.borderColor = Q.accent}
                onBlur={e => e.currentTarget.style.borderColor = Q.border}
              >
                <input
                  id="discovery-custom-input"
                  type="text"
                  value={answerText}
                  onChange={e => setAnswerText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && answerText.trim()) handleCustomSubmit();
                  }}
                  placeholder="Type a custom answer…"
                  disabled={submitting}
                  style={{
                    flex: 1, background: "transparent",
                    border: "none", outline: "none",
                    fontFamily: Q.mono, fontSize: 11,
                    color: Q.text,
                  }}
                />
                <button
                  onClick={handleCustomSubmit}
                  disabled={submitting || !answerText.trim()}
                  style={{
                    background: answerText.trim() && !submitting ? Q.accent : "transparent",
                    border: `1px solid ${answerText.trim() && !submitting ? Q.accent : Q.border}`,
                    borderRadius: 4, padding: "4px 12px",
                    cursor: answerText.trim() && !submitting ? "pointer" : "not-allowed",
                    fontFamily: Q.mono, fontSize: 10, fontWeight: 700,
                    color: answerText.trim() && !submitting ? "#000" : Q.textDim,
                    transition: "all 0.15s",
                  }}
                >
                  Send
                </button>
              </div>

              {/* Skip button */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button
                  onClick={handleProceed}
                  disabled={submitting}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontFamily: Q.mono, fontSize: 10, fontWeight: 700,
                    color: Q.accent, letterSpacing: "0.08em",
                    textTransform: "uppercase" as const,
                    display: "flex", alignItems: "center", gap: 6,
                    opacity: submitting ? 0.5 : 1,
                  }}
                >
                  <Play size={10} />
                  Skip Q&A → Formulate
                </button>
                <span style={{ fontFamily: Q.mono, fontSize: 9, color: Q.textDim }}>
                  Phase 1 of 2
                </span>
              </div>
            </div>
          ) : (
            /* Discovery completed — show PRD */
            <div style={{
              background: Q.chip, border: `1px solid ${Q.border}`,
              borderRadius: 6, padding: 20, marginTop: 8,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${Q.border}` }}>
                <CheckCircle2 size={16} color={Q.accent} />
                <h2 style={{ fontFamily: Q.mono, fontSize: 12, fontWeight: 700, color: Q.text, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>
                  Project Requirements Document (PRD)
                </h2>
              </div>
              <div style={{
                maxHeight: 300, overflowY: "auto",
                background: "rgba(0,0,0,0.4)", border: `1px solid ${Q.border}`,
                borderRadius: 4, padding: "12px 14px",
                fontFamily: Q.mono, fontSize: 11,
                color: Q.textMid, lineHeight: 1.7,
                whiteSpace: "pre-wrap" as const,
              }} className="ide-scroll">
                {requirementsDoc || "No requirements document generated yet."}
              </div>

              {/* ??$$$ newer code - PRD footer buttons with Playground & Behavior Sim */}
              <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                <button
                  onClick={() => { setPhase(2); setShouldAutoFormulate(true); }}
                  style={{
                    flex: "1 1 auto", minWidth: 140, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    background: Q.accent, border: "none", borderRadius: 5,
                    padding: "10px 20px", cursor: "pointer",
                    fontFamily: Q.mono, fontSize: 12, fontWeight: 700,
                    color: "#000", textTransform: "uppercase" as const, letterSpacing: "0.06em",
                    transition: "background 0.15s",
                  }}
                >
                  <Play size={13} />
                  Proceed to AI Build
                </button>
                {sessionId && (
                  <>
                    <button
                      onClick={handleGoToSimulator}
                      style={{
                        flex: "1 1 auto", minWidth: 110, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        background: "#007acc", border: "none", borderRadius: 5,
                        padding: "10px 16px", cursor: "pointer",
                        fontFamily: Q.mono, fontSize: 12, fontWeight: 700,
                        color: "#fff", textTransform: "uppercase" as const, letterSpacing: "0.06em",
                        transition: "background 0.15s",
                      }}
                      onMouseOver={e => { e.currentTarget.style.background = "#0062a3"; }}
                      onMouseOut={e => { e.currentTarget.style.background = "#007acc"; }}
                    >
                      <Play size={13} fill="currentColor" />
                      Playground
                    </button>
                    <button
                      onClick={handleGoToBehaviorSim}
                      style={{
                        flex: "1 1 auto", minWidth: 110, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        background: Q.chip, border: `1px solid ${Q.borderHi}`, borderRadius: 5,
                        padding: "10px 16px", cursor: "pointer",
                        fontFamily: Q.mono, fontSize: 12, fontWeight: 700,
                        color: Q.textMid, textTransform: "uppercase" as const, letterSpacing: "0.06em",
                        transition: "all 0.15s",
                      }}
                      onMouseOver={e => { e.currentTarget.style.borderColor = Q.accent; e.currentTarget.style.color = Q.text; }}
                      onMouseOut={e => { e.currentTarget.style.borderColor = Q.borderHi; e.currentTarget.style.color = Q.textMid; }}
                    >
                      <Cpu size={13} color="#fbbf24" />
                      Behavior Sim
                    </button>
                  </>
                )}
                <button
                  onClick={handleRestartDiscovery}
                  style={{
                    flex: "1 1 auto", minWidth: 110,
                    background: "transparent",
                    border: `1px solid ${Q.border}`,
                    borderRadius: 5, padding: "10px 20px",
                    cursor: "pointer", fontFamily: Q.mono, fontSize: 12,
                    fontWeight: 600, color: Q.textDim,
                    textTransform: "uppercase" as const, letterSpacing: "0.06em",
                    transition: "all 0.15s",
                  }}
                  onMouseOver={e => { e.currentTarget.style.borderColor = Q.borderHi; e.currentTarget.style.color = Q.text; }}
                  onMouseOut={e => { e.currentTarget.style.borderColor = Q.border; e.currentTarget.style.color = Q.textDim; }}
                >
                  Restart Q&A
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ??$$$ newer code — Right: Q&A History Sidebar ─────────────────── */}
      <aside style={{
        width: 280, flexShrink: 0,
        borderLeft: `1px solid ${Q.border}`,
        background: Q.chip,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        <div style={{
          padding: "14px 16px 10px",
          borderBottom: `1px solid ${Q.border}`,
          flexShrink: 0,
        }}>
          <p style={{ fontFamily: Q.mono, fontSize: 9, fontWeight: 700, color: Q.textDim, textTransform: "uppercase" as const, letterSpacing: "0.12em" }}>
            Answered · {allQuestions.length} / {allQuestions.length + (hasCurrentQuestion ? 1 : 0)}
          </p>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }} className="ide-scroll">
          {allQuestions.length === 0 ? (
            <p style={{ fontFamily: Q.mono, fontSize: 10, color: Q.textDim, textAlign: "center", paddingTop: 40, fontStyle: "italic" }}>
              No questions answered yet.
            </p>
          ) : (
            allQuestions.map((entry: QAEntry, i: number) => (
              <div
                key={i}
                style={{
                  marginBottom: 12,
                  padding: "10px 12px",
                  background: "rgba(0,0,0,0.3)",
                  border: `1px solid ${Q.border}`,
                  borderRadius: 5,
                }}
              >
                <div style={{ fontFamily: Q.mono, fontSize: 9, color: Q.textDim, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 5 }}>
                  Q{i + 1}
                </div>
                <div style={{ fontFamily: Q.mono, fontSize: 10, color: Q.textMid, lineHeight: 1.5, marginBottom: 6 }}>
                  {entry.question}
                </div>
                <div style={{
                  fontFamily: Q.mono, fontSize: 10, fontWeight: 700, color: Q.accent,
                  background: `${Q.chipSel}`, border: `1px solid ${Q.chipSelB}`,
                  borderRadius: 3, padding: "3px 8px", display: "inline-block",
                }}>
                  {entry.answer}
                </div>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}