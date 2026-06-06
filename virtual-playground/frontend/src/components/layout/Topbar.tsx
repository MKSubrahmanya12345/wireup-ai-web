// ??$$$ non-important
import React, { useEffect } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import {
  Play, Pause, RotateCcw, Eye, EyeOff, Activity, LogOut, HardDrive
} from 'lucide-react';
import { motion } from 'framer-motion';

export const Topbar: React.FC = () => {
  const {
    simulationRunning, compiling, compilePhase,
    setSimulationRunning, resetSimulation,
    showWires, toggleWires, showLabels, toggleLabels,
    fps, cpuUsage, voltage, tickTelemetry, setTab
  } = useProjectStore();

  useEffect(() => {
    let interval: any;
    if (simulationRunning) interval = setInterval(tickTelemetry, 1000);
    return () => clearInterval(interval);
  }, [simulationRunning, tickTelemetry]);

  const [exporting, setExporting] = React.useState(false);
  const handleExport = async () => {
    const sessionId = new URLSearchParams(window.location.search).get('sessionId');
    if (!sessionId) { alert('No session ID in URL.'); return; }
    setExporting(true);
    try {
      const base = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
      const res = await fetch(`${base}/new-flow/export-local`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      alert(res.ok ? data.message || 'Exported!' : data.error || 'Export failed.');
    } catch { alert('Export error.'); }
    finally { setExporting(false); }
  };

  return (
    <header className="h-12 flex-shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-4 flex items-center justify-between select-none z-10">

      {/* Brand */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm shadow-indigo-500/30">
          <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div>
          <p className="text-xs font-bold tracking-tight text-[var(--heading)] leading-none">Virtual Playground</p>
          <p className="text-[9px] text-[var(--text-muted)] leading-none mt-0.5">Arduino Workspace Runtime</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1 bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl p-1">
        {/* RUN */}
        <motion.button
          whileTap={{ scale: compiling ? 1 : 0.95 }}
          onClick={() => { if (!compiling) void setSimulationRunning(true); }}
          disabled={compiling}
          title={compiling ? 'Compiling…' : 'Run'}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            compiling
              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 cursor-not-allowed'
              : simulationRunning
              ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 shadow-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--heading)] hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          {compiling
            ? <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
            : <Play className={`w-3.5 h-3.5 ${simulationRunning ? 'fill-current' : ''}`} />
          }
          <span>{compiling ? 'Building' : 'Run'}</span>
        </motion.button>

        {/* PAUSE */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => void setSimulationRunning(false)}
          title="Pause"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--heading)] hover:bg-black/5 dark:hover:bg-white/5 transition-all"
        >
          <Pause className="w-3.5 h-3.5" />
          <span>Pause</span>
        </motion.button>

        {/* RESET */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={resetSimulation}
          title="Reset"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-all"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </motion.button>

        <div className="w-px h-4 bg-[var(--border)] mx-0.5" />

        {/* WIRES */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={toggleWires}
          title="Toggle Wires"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            showWires
              ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10'
              : 'text-[var(--text-muted)] hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          {showWires ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          <span>Wires</span>
        </motion.button>

        {/* LABELS */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={toggleLabels}
          title="Toggle Labels"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            showLabels
              ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10'
              : 'text-[var(--text-muted)] hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          {showLabels ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          <span>Labels</span>
        </motion.button>
      </div>

      {/* Right: telemetry + actions */}
      <div className="flex items-center gap-4 text-xs font-mono border-l border-[var(--border)] pl-4">

        {/* compile phase banner */}
        {compiling && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-400 text-[10px]"
          >
            <svg className="w-3 h-3 animate-spin flex-shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <span className="truncate max-w-[160px]">{compilePhase || 'Compiling…'}</span>
          </motion.div>
        )}

        {/* telemetry pills */}
        <div className="flex items-center gap-3 text-[var(--text-muted)]">
          <span>VCC: <span className={`font-semibold ${simulationRunning ? 'text-emerald-500' : 'text-[var(--text-muted)]'}`}>{voltage.toFixed(2)}V</span></span>
          <span>CPU: <span className={`font-semibold ${simulationRunning ? 'text-indigo-400' : 'text-[var(--text-muted)]'}`}>{cpuUsage}%</span>
            {simulationRunning && <Activity className="inline w-3 h-3 text-indigo-400 ml-0.5 animate-pulse" />}
          </span>
          <span>FPS: <span className={`font-semibold ${simulationRunning ? 'text-violet-400' : 'text-[var(--text-muted)]'}`}>{simulationRunning ? fps : 0}</span></span>
        </div>

        {/* Export */}
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text-muted)] hover:border-indigo-300 hover:text-indigo-600 dark:hover:border-indigo-500/40 dark:hover:text-indigo-400 text-xs font-sans transition-all disabled:opacity-50 cursor-pointer"
        >
          <HardDrive className="w-3 h-3" />
          <span>{exporting ? 'Exporting…' : 'Export'}</span>
        </button>

        {/* Exit */}
        <button
          onClick={() => { resetSimulation(); setTab('landing'); }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text-muted)] hover:border-red-300 hover:text-red-500 dark:hover:border-red-500/40 dark:hover:text-red-400 text-xs font-sans transition-all cursor-pointer"
        >
          <LogOut className="w-3 h-3" />
          <span>Exit</span>
        </button>
      </div>
    </header>
  );
};
