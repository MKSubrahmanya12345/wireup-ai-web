// ??$$$
import React, { useEffect } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Eye, 
  EyeOff, 
  Cpu, 
  Activity, 
  LogOut 
} from 'lucide-react';
import { motion } from 'framer-motion';

export const Topbar: React.FC = () => {
  const {
    simulationRunning,
    setSimulationRunning,
    resetSimulation,
    showWires,
    toggleWires,
    showLabels,
    toggleLabels,
    fps,
    cpuUsage,
    voltage,
    tickTelemetry,
    setTab
  } = useProjectStore();

  // Telemetry tick loop
  useEffect(() => {
    let interval: any;
    if (simulationRunning) {
      interval = setInterval(() => {
        tickTelemetry();
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [simulationRunning, tickTelemetry]);

  return (
    <header className="h-16 border-b border-[#1f1f45] bg-[#0a0a1c] px-6 flex items-center justify-between select-none relative z-10">
      {/* Brand Logo & Title */}
      <div className="flex items-center space-x-3">
        <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-purple-600 shadow-cyber">
          <Cpu className="w-5 h-5 text-white animate-pulse" />
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-wider text-white uppercase font-mono">
            Virtual Hardware <span className="text-cyan-400">Playground</span>
          </h1>
          <p className="text-[10px] text-slate-400 font-mono">Arduino Uno Sim v1.0.0</p>
        </div>
      </div>

      {/* Simulator Action Controls */}
      <div className="flex items-center space-x-2 bg-[#12122b] border border-[#1f1f45] p-1 rounded-lg">
        {/* RUN */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setSimulationRunning(true)}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all ${
            simulationRunning
              ? 'bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/50 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Run Simulator"
        >
          <Play className={`w-3.5 h-3.5 ${simulationRunning ? 'fill-current animate-pulse' : ''}`} />
          <span>RUN</span>
        </motion.button>

        {/* PAUSE */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setSimulationRunning(false)}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all ${
            !simulationRunning && cpuUsage > 0
              ? 'bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/50 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Pause Simulator"
        >
          <Pause className="w-3.5 h-3.5" />
          <span>PAUSE</span>
        </motion.button>

        {/* RESET */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={resetSimulation}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-medium text-slate-400 hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-all"
          title="Reset System"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>RESET</span>
        </motion.button>

        <div className="w-px h-5 bg-[#1f1f45] mx-1"></div>

        {/* TOGGLE WIRES */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleWires}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-mono transition-all ${
            showWires ? 'text-cyan-400 bg-cyan-950/30' : 'text-slate-400 hover:bg-slate-800'
          }`}
          title="Toggle Wire Rendering"
        >
          {showWires ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          <span>WIRES</span>
        </motion.button>

        {/* TOGGLE LABELS */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleLabels}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-mono transition-all ${
            showLabels ? 'text-cyan-400 bg-cyan-950/30' : 'text-slate-400 hover:bg-slate-800'
          }`}
          title="Toggle Component Labels"
        >
          {showLabels ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          <span>LABELS</span>
        </motion.button>
      </div>

      {/* Live Hardware Telemetry Panel */}
      <div className="flex items-center space-x-6 text-[11px] font-mono border-l border-[#1f1f45] pl-6">
        <div className="flex items-center space-x-2">
          <span className="text-slate-400">VCC:</span>
          <span className={`font-semibold transition-colors ${simulationRunning ? 'text-emerald-400' : 'text-slate-500'}`}>
            {voltage.toFixed(2)}V
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-slate-400">CPU:</span>
          <span className={`font-semibold transition-colors ${simulationRunning ? 'text-cyan-400' : 'text-slate-500'}`}>
            {cpuUsage}%
          </span>
          {simulationRunning && (
            <Activity className="w-3 h-3 text-cyan-400 animate-pulse" />
          )}
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-slate-400">FPS:</span>
          <span className={`font-semibold transition-colors ${simulationRunning ? 'text-purple-400' : 'text-slate-500'}`}>
            {simulationRunning ? fps : 0}
          </span>
        </div>

        {/* EXIT BUTTON */}
        <button
          onClick={() => {
            resetSimulation();
            setTab('landing');
          }}
          className="flex items-center space-x-1.5 px-2.5 py-1 bg-red-950/40 text-red-400 border border-red-900/50 hover:bg-red-900/40 hover:text-red-300 rounded transition-all font-sans text-xs cursor-pointer ml-4"
        >
          <LogOut className="w-3 h-3" />
          <span>Exit</span>
        </button>
      </div>
    </header>
  );
};
