// ??$$$
import React, { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import type { LogEntry } from '../../store/useProjectStore';
import { Trash2, Terminal, RefreshCw, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const BottomPanel: React.FC = () => {
  const { logs, clearLogs, simulationRunning } = useProjectStore();
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
      case 'boot': return 'text-cyan-400 font-bold';
      case 'info': return 'text-sky-300';
      case 'input': return 'text-amber-400';
      case 'output': return 'text-emerald-400';
      case 'system': return 'text-purple-400 italic';
      default: return 'text-slate-300';
    }
  };

  return (
    <div className="h-56 border-t border-[#1f1f45] bg-[#070716] flex flex-col font-mono select-none">
      {/* Panel Headers */}
      <div className="h-9 border-b border-[#1f1f45] bg-[#0a0a1c] px-4 flex items-center justify-between text-xs">
        <div className="flex space-x-4">
          <button
            onClick={() => setActiveTab('output')}
            className={`flex items-center space-x-1.5 py-2.5 px-1 border-b-2 transition-all cursor-pointer ${
              activeTab === 'output'
                ? 'border-cyan-400 text-cyan-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
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
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>COM Ports</span>
          </button>
        </div>

        {activeTab === 'output' && (
          <div className="flex items-center space-x-3">
            {/* Filter buttons */}
            <div className="flex items-center space-x-1.5 bg-[#12122b] px-2 py-0.5 rounded border border-[#1f1f45]">
              <button
                onClick={() => setFilter('all')}
                className={`px-1.5 py-0.5 rounded text-[10px] ${filter === 'all' ? 'bg-cyan-950 text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
              >
                ALL
              </button>
              <button
                onClick={() => setFilter('io')}
                className={`px-1.5 py-0.5 rounded text-[10px] ${filter === 'io' ? 'bg-cyan-950 text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
              >
                I/O
              </button>
              <button
                onClick={() => setFilter('system')}
                className={`px-1.5 py-0.5 rounded text-[10px] ${filter === 'system' ? 'bg-cyan-950 text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
              >
                SYS
              </button>
            </div>

            <button
              onClick={clearLogs}
              className="p-1 text-slate-400 hover:text-red-400 hover:bg-[#ef4444]/10 rounded transition-all cursor-pointer"
              title="Clear Console"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Panel Terminal Console Log Body */}
      <div className="flex-1 overflow-y-auto p-4 bg-[#04040d] text-xs">
        {activeTab === 'output' ? (
          <div className="space-y-1.5 font-mono select-text">
            {filteredLogs.length === 0 ? (
              <div className="text-slate-600 flex items-center justify-center h-full flex-col pt-8">
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
                    className="flex items-start space-x-2 border-l-2 border-transparent hover:border-cyan-500/30 hover:bg-white/[0.02] pl-2 py-0.5"
                  >
                    <span className="text-slate-600 select-none text-[10px] pt-0.5">{log.timestamp}</span>
                    <span className={`${getLogColor(log.type)} leading-relaxed`}>{log.text}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
            <div ref={logEndRef} />
          </div>
        ) : (
          /* COM Ports tab details */
          <div className="h-full flex items-center justify-center text-slate-500 text-xs">
            <div className="text-center space-y-2">
              <div className="text-cyan-500 font-semibold uppercase">COM3 Serial Port [Active]</div>
              <div className="text-[10px] text-slate-600">Baud Rate: 9600 bps | Flow Control: None | Bits: 8-N-1</div>
              <div className="text-[10px] text-slate-600">Device ID: USB\VID_2341&PID_0043 (Arduino Uno R3)</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
