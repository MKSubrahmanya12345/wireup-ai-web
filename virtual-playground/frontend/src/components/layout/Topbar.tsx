// ??$$$ non-important
// ??$$$
import React, { useEffect } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
// ??$$$ old code
/*
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
*/
// ??$$$ newer code
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Eye, 
  EyeOff, 
  Cpu, 
  Activity, 
  LogOut,
  HardDrive
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

  // ??$$$ newer code — export formulation files local E: handler
  const [exporting, setExporting] = React.useState(false);
  const handleExport = async () => {
    const searchParams = new URLSearchParams(window.location.search);
    const sessionId = searchParams.get('sessionId');
    if (!sessionId) {
      alert("No active session ID was found in the URL. Export is unavailable.");
      return;
    }
    
    setExporting(true);
    try {
      const apiBaseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
      const res = await fetch(`${apiBaseUrl}/new-flow/export-local`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        alert(data.message || 'Formulation files (including sketch.ino) exported to local E: drive successfully!');
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || 'Failed to export files.');
      }
    } catch (err) {
      alert('Error exporting files.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <header className="h-16 border-b border-[var(--border)] bg-[var(--surface)] px-6 flex items-center justify-between select-none relative z-10">
      {/* Brand Logo & Title */}
      <div className="flex items-center space-x-3">
        <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-sky-500">
          <Cpu className="w-5 h-5 text-white animate-pulse" />
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-wider text-[var(--heading)] uppercase font-mono">
            Virtual Hardware <span className="text-[var(--primary)]">Playground</span>
          </h1>
          <p className="text-[10px] text-[var(--text-muted)] font-mono">Arduino Workspace Runtime</p>
        </div>
      </div>

      {/* Simulator Action Controls */}
      <div className="flex items-center space-x-2 bg-[var(--surface-alt)] border border-[var(--border)] p-1 rounded-lg">
        {/* RUN */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setSimulationRunning(true)}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all ${
            simulationRunning
              ? 'bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/50 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
              : 'text-[var(--text-muted)] hover:text-[var(--heading)] hover:bg-black/5'
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
              : 'text-[var(--text-muted)] hover:text-[var(--heading)] hover:bg-black/5'
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
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-medium text-[var(--text-muted)] hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-all"
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
              showWires ? 'text-blue-600 bg-blue-100' : 'text-[var(--text-muted)] hover:bg-black/5'
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
              showLabels ? 'text-blue-600 bg-blue-100' : 'text-[var(--text-muted)] hover:bg-black/5'
          }`}
          title="Toggle Component Labels"
        >
          {showLabels ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          <span>LABELS</span>
        </motion.button>
      </div>

      {/* Live Hardware Telemetry Panel */}
      <div className="flex items-center space-x-6 text-[11px] font-mono border-l border-[var(--border)] pl-6">
        <div className="flex items-center space-x-2">
          <span className="text-[var(--text-muted)]">VCC:</span>
          <span className={`font-semibold transition-colors ${simulationRunning ? 'text-emerald-400' : 'text-slate-500'}`}>
            {voltage.toFixed(2)}V
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-[var(--text-muted)]">CPU:</span>
          <span className={`font-semibold transition-colors ${simulationRunning ? 'text-cyan-400' : 'text-slate-500'}`}>
            {cpuUsage}%
          </span>
          {simulationRunning && (
            <Activity className="w-3 h-3 text-cyan-400 animate-pulse" />
          )}
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-[var(--text-muted)]">FPS:</span>
          <span className={`font-semibold transition-colors ${simulationRunning ? 'text-purple-400' : 'text-slate-500'}`}>
            {simulationRunning ? fps : 0}
          </span>
        </div>

        {/* ??$$$ newer code — EXPORT BUTTON */}
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center space-x-1.5 px-2.5 py-1 bg-emerald-950/40 text-emerald-400 border border-emerald-900/50 hover:bg-emerald-900/40 hover:text-emerald-300 rounded transition-all font-sans text-xs cursor-pointer ml-4 disabled:opacity-50"
        >
          <HardDrive className="w-3.5 h-3.5" />
          <span>{exporting ? 'Exporting...' : 'Export'}</span>
        </button>

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
