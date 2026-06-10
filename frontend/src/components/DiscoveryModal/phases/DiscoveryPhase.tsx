// phases/DiscoveryPhase.tsx
// ??$$$ newer code - VSCode Styled Discovery Phase Q&A interface
import React from "react";
import { Cpu, HardDrive, Layers, AlertTriangle, Play, Send, CheckCircle2 } from "lucide-react";

export function DiscoveryPhase(props: any) {
  const {
    question,
    options,
    answerText,
    setAnswerText,
    submitting,
    context,
    requirementsDoc,
    qaHistory,
    handleAnswer,
    handleProceed,
    setPhase,
    setShouldAutoFormulate,
    handleRestartDiscovery,
  } = props;

  return (
    <div className="flex h-full w-full bg-[#1e1e1e] text-zinc-300 font-mono text-xs select-none overflow-hidden">
      
      {/* Q&A Left Stage */}
      <div className="flex-1 flex flex-col justify-between p-8 overflow-y-auto">
        <div className="max-w-xl mx-auto w-full my-auto space-y-6">
          {question ? (
            <>
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1 bg-[#007acc]/15 px-2 py-0.5 rounded text-[10px] font-bold text-[#007acc] border border-[#007acc]/20">
                  SYSTEM PROMPT QUESTION
                </span>
                <h2 className="text-base font-bold text-white leading-normal">
                  {question}
                </h2>
              </div>

              {/* Option Chips */}
              {options.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
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
                      className={`rounded border p-3 text-left font-medium transition-all active:scale-[0.98] ${
                        opt === "Other / Custom"
                          ? "border-dashed border-[#3c3c3c] bg-black/20 text-zinc-500 hover:border-[#007acc] hover:text-white"
                          : "border-[#2d2d2d] bg-[#252526] text-zinc-300 hover:border-[#007acc] hover:bg-[#2d2d2d]"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {/* Custom Text Answer input */}
              <div className="space-y-3">
                <div className="flex gap-2 rounded border border-[#3c3c3c] bg-black px-3 py-2 focus-within:border-[#007acc] transition-colors">
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
                    placeholder="Provide a custom definition or details..."
                    disabled={submitting}
                    className="flex-1 bg-transparent text-[11px] text-zinc-200 placeholder-zinc-650 outline-none font-mono"
                  />
                  <button
                    onClick={() => handleAnswer(answerText)}
                    disabled={submitting || !answerText.trim()}
                    className="rounded bg-[#007acc] p-1.5 text-white hover:bg-[#0062a3] transition-colors disabled:bg-[#2d2d2d] disabled:text-zinc-600"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <button
                    onClick={handleProceed}
                    disabled={submitting}
                    className="flex items-center gap-1 text-[10px] text-[#007acc] hover:text-[#0062a3] transition-colors font-bold uppercase tracking-wider"
                  >
                    <Play className="h-3 w-3" /> Skip Q&A & Formulation
                  </button>
                  <span className="text-[9px] text-zinc-600 uppercase">Phase 1 of 2</span>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded border border-[#2d2d2d] bg-[#252526] p-6 space-y-5">
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-[#2d2d2d] pb-2">
                  <CheckCircle2 className="h-4.5 w-4.5 text-[#007acc]" />
                  <h2 className="text-xs font-bold text-white uppercase tracking-wider">Project Requirements Document (PRD)</h2>
                </div>
                <div className="max-h-80 overflow-y-auto rounded border border-[#2d2d2d] bg-black/45 p-4 text-[11px] text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap select-text">
                  {requirementsDoc || "No requirements document generated yet."}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setPhase(2);
                    setShouldAutoFormulate(true);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 rounded bg-[#007acc] py-2.5 text-xs font-bold text-white hover:bg-[#0062a3] transition-all active:scale-[0.98]"
                >
                  <Play className="h-3.5 w-3.5" />
                  <span>Proceed to AI Build</span>
                </button>

                <button
                  onClick={handleRestartDiscovery}
                  className="rounded border border-[#3c3c3c] bg-[#1e1e1e] px-4 py-2.5 text-xs font-bold text-zinc-300 hover:border-[#007acc] hover:bg-[#2d2d2d] transition-all"
                >
                  Restart Q&A
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Live Context Right Sidebar */}
      <aside className="w-80 border-l border-[#2d2d2d] bg-[#252526] p-5 overflow-y-auto space-y-4">
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-3">
            Discovery History
          </h3>
          <div className="space-y-3">
            {qaHistory && qaHistory.length > 0 ? (
              qaHistory.map((item: any, i: number) => (
                <div key={i} className="rounded border border-[#2d2d2d] bg-[#1e1e1e] p-3 space-y-2">
                  <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">
                    Question {i + 1}
                  </div>
                  <div className="text-[10px] text-zinc-300 leading-normal">
                    {item.question}
                  </div>
                  <div className="text-[10px] font-bold text-[#007acc] bg-[#007acc]/5 px-2 py-1 rounded border border-[#007acc]/10">
                    {item.answer}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-[10px] text-zinc-650 italic text-center py-8">
                No questions answered yet.
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}