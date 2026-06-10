// components/ModelSelector.tsx
// ??$$$ newer code - VSCode Styled IDE Settings configuration view
import React from "react";
import { HardDrive, Layers, Cpu, Settings, Play, Sliders } from "lucide-react";

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
    <div className="flex h-full w-full bg-[#1e1e1e] text-zinc-300 font-mono text-xs select-none">
      
      {/* Settings Side Navigation */}
      <aside className="w-56 shrink-0 bg-[#252526] border-r border-[#2d2d2d] flex flex-col p-2 space-y-1">
        <div className="px-2 py-1.5 text-[9px] uppercase font-bold text-zinc-500 tracking-wider">
          Configuration Categories
        </div>
        <button className="w-full flex items-center gap-2 rounded px-2.5 py-1.5 bg-[#1e1e1e] text-white border-l-2 border-[#007acc] text-left">
          <Sliders className="w-3.5 h-3.5 text-[#007acc]" />
          <span>Pipeline Setup</span>
        </button>
        <button className="w-full flex items-center gap-2 rounded px-2.5 py-1.5 hover:bg-[#2d2d2d] text-zinc-400 hover:text-zinc-200 text-left cursor-not-allowed opacity-50">
          <Cpu className="w-3.5 h-3.5" />
          <span>MCU Pinout Config</span>
        </button>
        <button className="w-full flex items-center gap-2 rounded px-2.5 py-1.5 hover:bg-[#2d2d2d] text-zinc-400 hover:text-zinc-200 text-left cursor-not-allowed opacity-50">
          <Settings className="w-3.5 h-3.5" />
          <span>Tool Guardrails</span>
        </button>
      </aside>

      {/* Main Settings Panel */}
      <main className="flex-1 flex flex-col overflow-y-auto p-8 max-w-3xl">
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Settings className="w-4 h-4 text-[#007acc]" /> Configure Your AI Build Pipeline
            </h2>
            <p className="text-[10px] text-zinc-500">
              Set up the orchestration engine and targets for project generation.
            </p>
          </div>

          <div className="h-px bg-[#2d2d2d]" />

          {/* Config Field: Target Idea */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">
              Active Project Scope
            </label>
            <div className="w-full rounded border border-[#3c3c3c] bg-black/40 px-3 py-2 text-white font-mono text-[11px]">
              "{initialIdea || "smart-pot-project"}"
            </div>
            <p className="text-[9px] text-zinc-650">
              The project brief used by agents to determine component libraries.
            </p>
          </div>

          {/* Config Field: Selection mode */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide block">
              Orchestrator Execution Mode
            </label>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Option 1: Pure Ollama */}
              <button
                type="button"
                id="mode-pure-ollama"
                onClick={() => setModel("ollama/minimax-m3:cloud")}
                className={`flex flex-col gap-2 rounded border p-4 text-left transition-all ${
                  model === "ollama/minimax-m3:cloud"
                    ? "border-[#007acc] bg-[#252526] text-white"
                    : "border-[#2d2d2d] bg-[#1a1a1a] text-zinc-400 hover:border-[#3c3c3c] hover:bg-[#202020]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <HardDrive className={`w-4 h-4 ${model === "ollama/minimax-m3:cloud" ? "text-[#007acc]" : "text-zinc-550"}`} />
                  <span className="font-bold text-[11px]">Pure Ollama</span>
                </div>
                <p className="text-[9px] text-zinc-500 leading-normal">
                  minimax-m3:cloud · 100% local models. Zero API limits, low latency.
                </p>
                <div className="mt-auto pt-2 flex items-center gap-1.5 text-[9px] font-semibold text-[#007acc]">
                  <span className={`w-2 h-2 rounded-full border ${model === "ollama/minimax-m3:cloud" ? "bg-[#007acc] border-[#007acc]" : "border-[#3c3c3c]"}`} />
                  <span>{model === "ollama/minimax-m3:cloud" ? "Active" : "Select Mode"}</span>
                </div>
              </button>

              {/* Option 2: Hybrid */}
              <button
                type="button"
                id="mode-hybrid"
                onClick={() => setModel("hybrid")}
                className={`flex flex-col gap-2 rounded border p-4 text-left transition-all ${
                  model === "hybrid"
                    ? "border-[#007acc] bg-[#252526] text-white"
                    : "border-[#2d2d2d] bg-[#1a1a1a] text-zinc-400 hover:border-[#3c3c3c] hover:bg-[#202020]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Layers className={`w-4 h-4 ${model === "hybrid" ? "text-[#007acc]" : "text-zinc-550"}`} />
                  <span className="font-bold text-[11px]">Hybrid Cloud</span>
                </div>
                <p className="text-[9px] text-zinc-500 leading-normal">
                  GROQ → GROQ_FALLBACK → Cerebras → Ollama. Automatic API failover.
                </p>
                <div className="mt-auto pt-2 flex items-center gap-1.5 text-[9px] font-semibold text-[#007acc]">
                  <span className={`w-2 h-2 rounded-full border ${model === "hybrid" ? "bg-[#007acc] border-[#007acc]" : "border-[#3c3c3c]"}`} />
                  <span>{model === "hybrid" ? "Active" : "Select Mode"}</span>
                </div>
              </button>
            </div>
          </div>

          {/* Sub Option: Hybrid Primary Provider */}
          {model === "hybrid" && (
            <div className="p-4 rounded border border-[#2d2d2d] bg-[#252526]/50 space-y-2">
              <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wide block">
                Primary Cloud Provider (Fallback Target)
              </label>
              <select
                id="hybrid-primary-select"
                value={hybridPrimary}
                onChange={(e) => setHybridPrimary(e.target.value)}
                className="w-full rounded border border-[#3c3c3c] bg-black px-3 py-1.5 text-[10px] text-zinc-200 outline-none focus:border-[#007acc]"
              >
                <option value="qwen/qwen3-32b">Groq · Llama 4 Scout</option>
                <option value="qwen/qwen3-32b">Groq · Qwen3-32B</option>
                <option value="gpt-oss-120b">Cerebras · gpt-oss-120b</option>
                <option value="zai-glm-4.7">Cerebras · zai-glm-4.7</option>
              </select>
              <p className="text-[9px] text-zinc-500">
                Primary model used for reasoning and wire assembly validation logic.
              </p>
            </div>
          )}

          <div className="h-px bg-[#2d2d2d] pt-2" />

          {/* Start build session CTA */}
          <div className="pt-2">
            <button
              onClick={handleStartSession}
              className="flex items-center justify-center gap-2 rounded bg-[#007acc] hover:bg-[#0062a3] px-6 py-2.5 text-xs font-bold text-white transition-all active:scale-[0.98]"
            >
              <Play className="w-3.5 h-3.5 text-white" />
              <span>Start AI Build Session</span>
            </button>
          </div>
        </div>
      </main>

    </div>
  );
};