// ??$$$ non-important
// ??$$$
import React, { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import type { LogEntry } from '../../store/useProjectStore';
import { Trash2, Terminal, RefreshCw, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const BottomPanel: React.FC = () => {
  const { logs, clearLogs, simulationRunning, compiling, compilePhase } = useProjectStore(); // ??$$$ newer code
  const [activeTab, setActiveTab] = useState<'output' | 'terminal' | 'ports'>('output');
  const [filter, setFilter] = useState<'all' | 'io' | 'system'>('all');
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on logs addition
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Filter logic
  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    if (filter === 'io') return log.type === 'input' || log.type === 'output';
    if (filter === 'system') return log.type === 'system' || log.type === 'boot' || log.type === 'info';
    return true;
  });

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'boot': return 'text-blue-700 font-bold';
      case 'info': return 'text-sky-700';
      case 'input': return 'text-amber-700';
      case 'output': return 'text-emerald-700';
      case 'system': return 'text-indigo-700 italic';
      default: return 'text-[var(--text)]';
    }
  };

  return (
    <div className="h-56 border-t border-[var(--border)] bg-[var(--surface)] flex flex-col font-mono select-none">
      {/* Panel Headers */}
      <div className="h-9 border-b border-[var(--border)] bg-[var(--surface-alt)] px-4 flex items-center justify-between text-xs">
        <div className="flex space-x-4">
          <button
            onClick={() => setActiveTab('output')}
            className={`flex items-center space-x-1.5 py-2.5 px-1 border-b-2 transition-all cursor-pointer ${
              activeTab === 'output'
                ? 'border-cyan-400 text-cyan-400 font-semibold'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--heading)]'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Output Console</span>
          </button>
          <button
            onClick={() => setActiveTab('ports')}
            className={`flex items-center space-x-1.5 py-2.5 px-1 border-b-2 transition-all cursor-pointer ${
              activeTab === 'ports'
                ? 'border-cyan-400 text-cyan-400 font-semibold'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--heading)]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>COM Ports</span>
          </button>
        </div>

        {activeTab === 'output' && (
          <div className="flex items-center space-x-3">
            {/* Filter buttons */}
            <div className="flex items-center space-x-1.5 bg-white px-2 py-0.5 rounded border border-[var(--border)]">
              <button
                onClick={() => setFilter('all')}
                className={`px-1.5 py-0.5 rounded text-[10px] ${filter === 'all' ? 'bg-blue-100 text-blue-700' : 'text-[var(--text-muted)] hover:text-[var(--heading)]'}`}
              >
                ALL
              </button>
              <button
                onClick={() => setFilter('io')}
                className={`px-1.5 py-0.5 rounded text-[10px] ${filter === 'io' ? 'bg-blue-100 text-blue-700' : 'text-[var(--text-muted)] hover:text-[var(--heading)]'}`}
              >
                I/O
              </button>
              <button
                onClick={() => setFilter('system')}
                className={`px-1.5 py-0.5 rounded text-[10px] ${filter === 'system' ? 'bg-blue-100 text-blue-700' : 'text-[var(--text-muted)] hover:text-[var(--heading)]'}`}
              >
                SYS
              </button>
            </div>

            <button
              onClick={clearLogs}
              className="p-1 text-[var(--text-muted)] hover:text-red-500 hover:bg-[#ef4444]/10 rounded transition-all cursor-pointer"
              title="Clear Console"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ??$$$ newer code — Compile phase progress banner */}
      {compiling && (
        <div className="border-t border-amber-800/40 bg-amber-950/30 px-4 py-2 flex items-center gap-3">
          <svg className="w-3.5 h-3.5 animate-spin text-amber-400 flex-shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <div className="flex flex-col">
            <span className="text-amber-300 text-[10px] font-mono font-semibold uppercase tracking-wider">Compiler Active</span>
            <span className="text-amber-400/80 text-[9px] font-mono">{compilePhase || 'Preparing build pipeline...'}</span>
          </div>
          <div className="ml-auto flex gap-1">
            {['Sending', 'Compiling', 'Linking', 'Flashing'].map((step, i) => {
              const phases = ['Sending', 'Compil', 'Link', 'Firmware'];
              const active = phases.findIndex(p => (compilePhase || '').includes(p));
              return (
                <div key={step} className={`w-1.5 h-1.5 rounded-full transition-all ${
                  i <= active ? 'bg-amber-400' : 'bg-amber-900'
                }`} />
              );
            })}
          </div>
        </div>
      )}

      {/* Panel Terminal Console Log Body */}
      <div className="flex-1 overflow-y-auto p-4 bg-[var(--surface-alt)] text-xs">
        {activeTab === 'output' ? (
          <div className="space-y-1.5 font-mono select-text">
            {filteredLogs.length === 0 ? (
              <div className="text-[var(--text-muted)] flex items-center justify-center h-full flex-col pt-8">
                {simulationRunning ? (
                  <>
                    <RefreshCw className="w-5 h-5 text-slate-700 animate-spin mb-2" />
                    <span>Listening for microcontroller outputs...</span>
                  </>
                ) : (
                  <span>Console inactive. Start simulator to read serial output.</span>
                )}
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {filteredLogs.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-start space-x-2 border-l-2 border-transparent hover:border-blue-500/30 hover:bg-white/70 pl-2 py-0.5"
                  >
                    <span className="text-[var(--text-muted)] select-none text-[10px] pt-0.5">{log.timestamp}</span>
                    <span className={`${getLogColor(log.type)} leading-relaxed`}>{log.text}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
            <div ref={logEndRef} />
          </div>
        ) : (
          /* COM Ports tab details */
          <div className="h-full flex items-center justify-center text-[var(--text-muted)] text-xs">
            <div className="text-center space-y-2">
              <div className="text-blue-600 font-semibold uppercase">COM3 Serial Port [Active]</div>
              <div className="text-[10px] text-[var(--text-muted)]">Baud Rate: 9600 bps | Flow Control: None | Bits: 8-N-1</div>
              <div className="text-[10px] text-[var(--text-muted)]">Device ID: USB\VID_2341&PID_0043 (Arduino Uno R3)</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
