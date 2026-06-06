// ??$$$ non-important
import React, { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import type { LogEntry } from '../../store/useProjectStore';
import { Trash2, Terminal, RefreshCw, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ??$$$ newer code: added props interface for mobile open/close
export interface BottomPanelProps {
  isOpenMobile?: boolean;
}

/* old code
export const BottomPanel: React.FC = () => {
  const { logs, clearLogs, simulationRunning, compiling, compilePhase } = useProjectStore();
*/

// ??$$$ newer code: Responsive layout with mobile sliding panel support
export const BottomPanel: React.FC<BottomPanelProps> = ({ isOpenMobile = false }) => {
  const { logs, clearLogs, simulationRunning, compiling, compilePhase } = useProjectStore();
  const [activeTab, setActiveTab] = useState<'output' | 'ports'>('output');
  const [filter, setFilter] = useState<'all' | 'io' | 'system'>('all');
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  const filteredLogs = logs.filter(log => {
    if (filter === 'io') return log.type === 'input' || log.type === 'output';
    if (filter === 'system') return log.type === 'system' || log.type === 'boot' || log.type === 'info';
    return true;
  });

  const logColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'boot':   return 'text-indigo-500 font-bold';
      case 'info':   return 'text-sky-500';
      case 'input':  return 'text-amber-500';
      case 'output': return 'text-emerald-500';
      case 'system': return 'text-slate-500 italic';
      default:       return 'text-[var(--text)]';
    }
  };

  return (
    /* old code
    <div className="h-44 flex-shrink-0 border-t border-[var(--border)] bg-[var(--surface)] flex flex-col overflow-hidden">
    */
    // ??$$$ newer code: Support sliding panel on mobile (sitting above bottom toolbar h-12)
    <div className={`h-44 flex-shrink-0 border-t border-[var(--border)] bg-[var(--surface)] flex flex-col overflow-hidden transition-transform duration-300 z-40
      md:relative md:translate-y-0 md:flex
      fixed bottom-12 left-0 right-0 shadow-2xl md:shadow-none
      ${isOpenMobile ? 'translate-y-0' : 'translate-y-full'}`}>

      {/* header */}
      <div className="h-8 flex-shrink-0 border-b border-[var(--border)] bg-[var(--surface-alt)] px-3 flex items-center justify-between">
        <div className="flex gap-0.5">
          {[
            { key: 'output' as const, label: 'Output Console', icon: Terminal },
            { key: 'ports'  as const, label: 'COM Ports',      icon: Layers  },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-3 h-8 text-[11px] font-semibold border-b-2 transition-all ${
                activeTab === key
                  ? 'border-indigo-500 text-indigo-500'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--heading)]'
              }`}
            >
              <Icon className="w-3 h-3" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {activeTab === 'output' && (
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg p-0.5">
              {(['all', 'io', 'system'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase transition-all ${
                    filter === f
                      ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                      : 'text-[var(--text-muted)] hover:text-[var(--heading)]'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <button
              onClick={clearLogs}
              title="Clear"
              className="p-1 rounded-lg text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-all"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* compile banner */}
      {compiling && (
        <div className="flex-shrink-0 border-b border-amber-500/20 bg-amber-500/5 px-4 py-1.5 flex items-center gap-2">
          <svg className="w-3 h-3 animate-spin text-amber-400 flex-shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <span className="text-amber-400 text-[10px] font-semibold uppercase tracking-wider">Compiler Active</span>
          <span className="text-amber-400/70 text-[10px] font-mono">{compilePhase || 'Preparing…'}</span>
          <div className="ml-auto flex gap-1">
            {['Send', 'Compile', 'Link', 'Flash'].map((step, i) => {
              const phases = ['Sending', 'Compil', 'Link', 'Firmware'];
              const active = phases.findIndex(p => (compilePhase || '').includes(p));
              return <div key={step} className={`w-1.5 h-1.5 rounded-full transition-all ${i <= active ? 'bg-amber-400' : 'bg-amber-900/60'}`} />;
            })}
          </div>
        </div>
      )}

      {/* log body */}
      <div className="flex-1 overflow-y-auto px-4 py-2 bg-[var(--surface-alt)] text-[11px] font-mono">
        {activeTab === 'output' ? (
          <div className="space-y-0.5 select-text">
            {filteredLogs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-[var(--text-muted)] pt-6 flex-col gap-2">
                {simulationRunning
                  ? <><RefreshCw className="w-4 h-4 animate-spin opacity-40" /><span>Listening for serial output…</span></>
                  : <span>Console inactive. Press Run to start.</span>
                }
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {filteredLogs.map(log => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.12 }}
                    className="flex items-start gap-2 pl-2 py-0.5 rounded hover:bg-indigo-500/5 border-l-2 border-transparent hover:border-indigo-400/30"
                  >
                    <span className="text-[var(--text-muted)] text-[9px] pt-0.5 flex-shrink-0">{log.timestamp}</span>
                    <span className={logColor(log.type)}>{log.text}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
            <div ref={logEndRef} />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-center">
            <div className="space-y-1">
              <p className="text-indigo-500 font-semibold text-xs">COM3 Serial Port [Active]</p>
              <p className="text-[10px] text-[var(--text-muted)]">Baud Rate: 9600 bps · 8-N-1</p>
              <p className="text-[10px] text-[var(--text-muted)]">USB\VID_2341&PID_0043 (Arduino Uno R3)</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
