// ??$$$ non-important
import React, { useEffect } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import {
  Play, Pause, RotateCcw, Eye, EyeOff, Activity, LogOut, HardDrive
} from 'lucide-react';
import { motion } from 'framer-motion';

export const Topbar: React.FC = () => {
  // ??$$$ newer code: mobile navigation menu state
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

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
    <header className="h-12 flex-shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-4 flex items-center justify-between select-none z-50 relative">

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
      {/* ??$$$ newer code: hide controls on mobile */}
      <div className="hidden md:flex items-center gap-1 bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl p-1">
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
      {/* ??$$$ newer code: hide right panel on mobile */}
      <div className="hidden md:flex items-center gap-4 text-xs font-mono border-l border-[var(--border)] pl-4">

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

      {/* ??$$$ newer code: Mobile hamburger menu toggle button */}
      <div className="flex md:hidden items-center gap-2">
        {compiling && (
          <span className="text-[10px] text-amber-500 font-mono animate-pulse max-w-[80px] truncate">
            {compilePhase || 'Building'}
          </span>
        )}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
        >
          {mobileMenuOpen ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* ??$$$ newer code: Hamburger dropdown overlay menu */}
      {mobileMenuOpen && (
        <div className="absolute top-12 left-0 right-0 bg-[var(--surface)] border-b border-[var(--border)] shadow-xl p-4 flex flex-col gap-4 z-50 md:hidden">
          {/* Simulation Commands */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Simulator Control</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => { if (!compiling) { void setSimulationRunning(true); setMobileMenuOpen(false); } }}
                disabled={compiling}
                className={`flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold border cursor-pointer ${
                  compiling
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : simulationRunning
                    ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                    : 'bg-[var(--surface-alt)] text-[var(--text)] border-[var(--border)]'
                }`}
              >
                <Play className="w-3 h-3" />
                <span>Run</span>
              </button>
              <button
                onClick={() => { void setSimulationRunning(false); setMobileMenuOpen(false); }}
                className="flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold bg-[var(--surface-alt)] text-[var(--text)] border border-[var(--border)] cursor-pointer"
              >
                <Pause className="w-3 h-3" />
                <span>Pause</span>
              </button>
              <button
                onClick={() => { resetSimulation(); setMobileMenuOpen(false); }}
                className="flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold bg-[var(--surface-alt)] text-red-500 border border-[var(--border)] cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Telemetry metrics */}
          <div className="bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl p-3">
            <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Telemetry</p>
            <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
              <div className="border-r border-[var(--border)]">
                <span className="text-[9px] text-[var(--text-muted)] block">VCC</span>
                <span className={`font-semibold ${simulationRunning ? 'text-emerald-500' : 'text-[var(--text-muted)]'}`}>{voltage.toFixed(2)}V</span>
              </div>
              <div className="border-r border-[var(--border)]">
                <span className="text-[9px] text-[var(--text-muted)] block">CPU</span>
                <span className={`font-semibold ${simulationRunning ? 'text-indigo-400' : 'text-[var(--text-muted)]'}`}>{cpuUsage}%</span>
              </div>
              <div>
                <span className="text-[9px] text-[var(--text-muted)] block">FPS</span>
                <span className={`font-semibold ${simulationRunning ? 'text-violet-400' : 'text-[var(--text-muted)]'}`}>{simulationRunning ? fps : 0}</span>
              </div>
            </div>
          </div>

          {/* View Toggles */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Visual Layers</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={toggleWires}
                className={`py-2 rounded-lg text-xs font-semibold border cursor-pointer text-center ${
                  showWires
                    ? 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20'
                    : 'text-[var(--text-muted)] bg-[var(--surface-alt)] border-[var(--border)]'
                }`}
              >
                Wires: {showWires ? 'Show' : 'Hide'}
              </button>
              <button
                onClick={toggleLabels}
                className={`py-2 rounded-lg text-xs font-semibold border cursor-pointer text-center ${
                  showLabels
                    ? 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20'
                    : 'text-[var(--text-muted)] bg-[var(--surface-alt)] border-[var(--border)]'
                }`}
              >
                Labels: {showLabels ? 'Show' : 'Hide'}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2 border-t border-[var(--border)] pt-3">
            <button
              onClick={() => { void handleExport(); setMobileMenuOpen(false); }}
              disabled={exporting}
              className="flex items-center justify-center gap-1 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text)] text-xs font-semibold cursor-pointer"
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>{exporting ? 'Exporting' : 'Export'}</span>
            </button>
            <button
              onClick={() => { resetSimulation(); setTab('landing'); setMobileMenuOpen(false); }}
              className="flex items-center justify-center gap-1 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] text-red-500 text-xs font-semibold cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Exit</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
