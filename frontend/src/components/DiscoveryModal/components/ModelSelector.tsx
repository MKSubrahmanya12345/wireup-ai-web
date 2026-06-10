// components/ModelSelector.tsx

import React from "react";
import { HardDrive, Layers } from "lucide-react";

interface ModelSelectorProps {
  dark: boolean;
  textHead: string;
  textSub: string;

  initialIdea: string;

  model: string;
  setModel: React.Dispatch<React.SetStateAction<string>>;

  hybridPrimary: string;
  setHybridPrimary: React.Dispatch<React.SetStateAction<string>>;

  handleStartSession: () => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  dark,
  textHead,
  textSub,

  initialIdea,

  model,
  setModel,

  hybridPrimary,
  setHybridPrimary,

  handleStartSession
}) => {
  return (
    <>
      <div className="relative flex h-full flex-col items-center justify-center overflow-hidden px-6">

        {/* background grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(rgba(99,102,241,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.6) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        {/* radial fade over grid */}
        <div className={`pointer-events-none absolute inset-0 ${dark ? "bg-[radial-gradient(ellipse_at_center,transparent_30%,#0d0d12_80%)]" : "bg-[radial-gradient(ellipse_at_center,transparent_30%,#f8fafc_80%)]"}`} />

        <div className="relative z-10 w-full max-w-lg">

          {/* badge */}
          <div className="flex justify-center mb-8">
            <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-widest ${dark ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-400" : "border-indigo-200 bg-indigo-50 text-indigo-600"}`}>
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-indigo-500" />
              </span>
              AI Hardware Studio
            </span>
          </div>

          {/* heading */}
          <div className="text-center mb-10">
            <h2 className={`text-4xl font-bold tracking-tight leading-[1.15] mb-4 ${textHead}`}
              style={{ fontFamily: "'Manrope', sans-serif" }}>
              Configure your
              <br />
              <span className="bg-linear-to-r from-indigo-400 via-violet-400 to-pink-400 bg-clip-text text-transparent">
                build pipeline
              </span>
            </h2>
            <p className={`text-base leading-relaxed ${textSub}`}>
              Building{" "}
              <span className={`font-semibold ${dark ? "text-slate-200" : "text-slate-700"}`}>
                "{initialIdea}"
              </span>
              <br />
              Choose your AI engine, then launch.
            </p>
          </div>

          {/* mode cards */}
          <div className="space-y-3 mb-6">

            {/* Card 1: Pure Ollama */}
            <button
              id="mode-pure-ollama"
              onClick={() => setModel("ollama/minimax-m3:cloud")}
              className={`group w-full flex items-center gap-5 rounded-2xl border p-5 text-left transition-all duration-200 ${model === "ollama/minimax-m3:cloud"
                  ? dark
                    ? "border-indigo-500/50 bg-indigo-500/10 shadow-lg shadow-indigo-500/10"
                    : "border-indigo-300 bg-indigo-50 shadow-md shadow-indigo-100"
                  : dark
                    ? "border-white/[0.07] bg-white/2.5 hover:border-indigo-500/30 hover:bg-white/4"
                    : "border-slate-200 bg-white hover:border-indigo-200 hover:shadow-sm"
                }`}
            >
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition-colors ${model === "ollama/minimax-m3:cloud"
                  ? dark ? "border-indigo-500/40 bg-indigo-500/20 text-indigo-300" : "border-indigo-200 bg-indigo-100 text-indigo-600"
                  : dark ? "border-white/10 bg-white/5 text-slate-400" : "border-slate-200 bg-slate-100 text-slate-500"
                }`}>
                <HardDrive className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-base font-bold tracking-tight ${model === "ollama/minimax-m3:cloud"
                    ? dark ? "text-indigo-200" : "text-indigo-700"
                    : textHead
                  }`}>Pure Ollama</p>
                <p className={`text-sm mt-0.5 ${textSub}`}>minimax-m3:cloud · 100% local · Zero API limits</p>
              </div>
              <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${model === "ollama/minimax-m3:cloud"
                  ? dark ? "border-indigo-400 bg-indigo-400" : "border-indigo-600 bg-indigo-600"
                  : dark ? "border-white/20" : "border-slate-300"
                }`}>
                {model === "ollama/minimax-m3:cloud" && (
                  <svg className="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 12 12">
                    <path d="M3.5 7L5.5 9L8.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                )}
              </div>
            </button>

            {/* Card 2: Hybrid */}
            <div className={`w-full rounded-2xl border transition-all duration-200 overflow-hidden ${model === "hybrid"
                ? dark
                  ? "border-violet-500/50 bg-violet-500/10 shadow-lg shadow-violet-500/10"
                  : "border-violet-300 bg-violet-50 shadow-md shadow-violet-100"
                : dark
                  ? "border-white/[0.07] bg-white/2.5 hover:border-violet-500/30 hover:bg-white/4"
                  : "border-slate-200 bg-white hover:border-violet-200 hover:shadow-sm"
              }`}>
              <button
                id="mode-hybrid"
                onClick={() => setModel("hybrid")}
                className="w-full flex items-center gap-5 p-5 text-left"
              >
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition-colors ${model === "hybrid"
                    ? dark ? "border-violet-500/40 bg-violet-500/20 text-violet-300" : "border-violet-200 bg-violet-100 text-violet-600"
                    : dark ? "border-white/10 bg-white/5 text-slate-400" : "border-slate-200 bg-slate-100 text-slate-500"
                  }`}>
                  <Layers className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-base font-bold tracking-tight ${model === "hybrid"
                      ? dark ? "text-violet-200" : "text-violet-700"
                      : textHead
                    }`}>Hybrid Cloud</p>
                  <p className={`text-sm mt-0.5 ${textSub}`}>GROQ → GROQ_FALLBACK → Cerebras → Ollama</p>
                </div>
                <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${model === "hybrid"
                    ? dark ? "border-violet-400 bg-violet-400" : "border-violet-600 bg-violet-600"
                    : dark ? "border-white/20" : "border-slate-300"
                  }`}>
                  {model === "hybrid" && (
                    <svg className="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 12 12">
                      <path d="M3.5 7L5.5 9L8.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                  )}
                </div>
              </button>

              {model === "hybrid" && (
                <div className={`px-5 pb-5 border-t ${dark ? "border-violet-500/20" : "border-violet-100"}`}>
                  <label className={`text-xs font-semibold uppercase tracking-widest block mt-4 mb-2 ${textSub}`}>
                    Primary Cloud Provider
                  </label>
                  <select
                    id="hybrid-primary-select"
                    value={hybridPrimary}
                    onChange={(e) => setHybridPrimary(e.target.value)}
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors ${dark
                        ? "border-white/10 bg-white/5 text-slate-200 focus:border-violet-500/60"
                        : "border-slate-200 bg-white text-slate-700 focus:border-violet-400"
                      }`}
                  >
                    <option value="qwen/qwen3-32b">Groq · Llama 4 Scout</option>
                    <option value="qwen/qwen3-32b">Groq · Qwen3-32B</option>
                    <option value="gpt-oss-120b">Cerebras · gpt-oss-120b</option>
                    <option value="zai-glm-4.7">Cerebras · zai-glm-4.7</option>
                  </select>
                  <p className={`text-xs mt-2 leading-relaxed ${dark ? "text-slate-600" : "text-slate-400"}`}>
                    Auto-failover: GROQ_API_KEY → GROQ_API_FALLBACK → CEREBRAS_API_KEY → Ollama
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={handleStartSession}
            className="group w-full flex items-center justify-center gap-3 rounded-2xl bg-indigo-600 px-6 py-4 text-base font-bold text-white shadow-xl shadow-indigo-500/30 hover:bg-indigo-700 transition-all active:scale-[0.99]"
          >
            <svg className="h-5 w-5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Start AI Build
          </button>

          {/* footnote */}
          <p className={`mt-5 text-center text-xs ${dark ? "text-slate-700" : "text-slate-400"}`}>
            Discovery → Component Sourcing → Wiring → Curriculum — fully automated
          </p>
        </div>
      </div>
    </>
  );
};