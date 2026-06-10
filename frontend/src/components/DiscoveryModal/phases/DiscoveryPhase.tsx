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
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-6 space-y-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  <h2 className="text-xl font-bold text-zinc-100">Project Requirements Document</h2>
                </div>
                <div className="max-h-96 overflow-y-auto rounded-xl border border-zinc-800 bg-black/45 p-6 text-sm text-zinc-300 font-sans leading-relaxed whitespace-pre-wrap select-text">
                  {requirementsDoc || "No requirements document generated yet."}
                </div>
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
                  onClick={handleRestartDiscovery}
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
            Discovery History
          </h3>
          <div className="space-y-4">
            {qaHistory && qaHistory.length > 0 ? (
              qaHistory.map((item: any, i: number) => (
                <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-950/45 p-4 space-y-2">
                  <div className="text-[11px] text-zinc-500 font-semibold uppercase tracking-wider">
                    Question {i + 1}
                  </div>
                  <div className="text-xs text-zinc-300 leading-relaxed">
                    {item.question}
                  </div>
                  <div className="text-xs font-semibold text-emerald-400 bg-emerald-500/5 px-2.5 py-1.5 rounded-lg border border-emerald-500/10">
                    {item.answer}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-xs text-zinc-500 italic text-center py-8">
                No questions answered yet.
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}