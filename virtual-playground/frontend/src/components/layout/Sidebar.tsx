// ??$$$
import React, { useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { 
  FolderOpen, 
  FileCode, 
  FileJson, 
  Info, 
  Cpu, 
  Layers, 
  Radio, 
  CheckCircle
} from 'lucide-react';
import { motion } from 'framer-motion';

export const Sidebar: React.FC = () => {
  const {
    project,
    selectedFile,
    setSelectedFile,
    selectedComponent,
    setSelectedComponent
  } = useProjectStore();

  const [activeTab, setActiveTab] = useState<'explorer' | 'components'>('explorer');

  // Static list of files with metadata for the explorer view
  const filesList = [
    { name: 'sketch.ino', type: 'code', size: '412 B', icon: FileCode },
    { name: 'wiring.json', type: 'json', size: '184 B', icon: FileJson },
    { name: 'editable.json', type: 'json', size: '92 B', icon: FileJson },
    { name: 'scenario.json', type: 'json', size: '110 B', icon: FileJson },
    { name: 'project.json', type: 'json', size: '1.2 KB', icon: FileJson },
  ];

  return (
    <aside className="w-80 border-r border-[var(--border)] bg-[var(--surface)] flex flex-col select-none">
      {/* Sidebar Mode Selector */}
      <div className="flex border-b border-[var(--border)] bg-[var(--surface-alt)] p-1.5">
        <button
          onClick={() => setActiveTab('explorer')}
          className={`flex-1 flex items-center justify-center space-x-1.5 py-2 rounded text-xs font-mono font-medium transition-all ${
            activeTab === 'explorer'
              ? 'bg-blue-100 text-blue-700 border border-blue-200'
              : 'text-[var(--text-muted)] hover:text-[var(--heading)] hover:bg-black/5'
          }`}
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>PROJECT FILES</span>
        </button>
        <button
          onClick={() => setActiveTab('components')}
          className={`flex-1 flex items-center justify-center space-x-1.5 py-2 rounded text-xs font-mono font-medium transition-all ${
            activeTab === 'components'
              ? 'bg-blue-100 text-blue-700 border border-blue-200'
              : 'text-[var(--text-muted)] hover:text-[var(--heading)] hover:bg-black/5'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>COMPONENTS</span>
        </button>
      </div>

      {/* Tab Content Panel */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'explorer' ? (
          /* File Explorer view */
          <div className="space-y-4">
            <div className="flex items-center space-x-1 text-[var(--text-muted)] text-xs uppercase tracking-wider font-mono">
              <span>Workspace / Root</span>
            </div>
            
            <div className="space-y-1">
              {filesList.map((file) => {
                const IconComponent = file.icon;
                const isSelected = selectedFile === file.name;
                
                return (
                  <motion.div
                    key={file.name}
                    whileHover={{ x: 4, backgroundColor: 'rgba(31, 31, 69, 0.2)' }}
                    onClick={() => setSelectedFile(file.name)}
                    className={`flex items-center justify-between p-2.5 rounded cursor-pointer transition-colors border ${
                      isSelected
                        ? 'bg-blue-100 border-blue-200 text-blue-700'
                        : 'border-transparent text-[var(--text)] hover:text-[var(--heading)]'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <IconComponent className={`w-4 h-4 ${isSelected ? 'text-blue-600' : 'text-[var(--text-muted)]'}`} />
                      <span className="text-xs font-mono">{file.name}</span>
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">{file.size}</span>
                  </motion.div>
                );
              })}
            </div>

            <div className="mt-8 border border-[var(--border)] bg-[var(--surface-alt)] rounded-lg p-3.5 text-xs text-[var(--text-muted)] font-mono space-y-2">
              <div className="flex items-center space-x-2 text-[var(--primary)] font-semibold border-b border-[var(--border)] pb-1.5">
                <Info className="w-3.5 h-3.5" />
                <span>Simulation Guide</span>
              </div>
              <p className="leading-relaxed text-[11px]">
                Click <strong className="text-[var(--heading)]">sketch.ino</strong> in the explorer to view the Arduino logic. Use the <strong className="text-[var(--heading)]">RUN</strong> button above to initialize the simulated circuit.
              </p>
              <p className="leading-relaxed text-[11px] pt-1">
                Interact with the <strong className="text-[var(--heading)]">Push Button</strong> in the 3D scene to trigger the input signal.
              </p>
            </div>
          </div>
        ) : (
          /* Component Inventory view */
          <div className="space-y-3">
            <div className="text-[var(--text-muted)] text-xs uppercase tracking-wider font-mono mb-2">
              BOM Inventory ({project.bom.length})
            </div>

            <div className="space-y-2">
              {project.bom.map((comp) => {
                const isSelected = selectedComponent === comp.key;
                
                return (
                  <motion.div
                    key={comp.key}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => setSelectedComponent(isSelected ? null : comp.key)}
                    className={`p-3 rounded-lg cursor-pointer transition-colors border text-left ${
                      isSelected
                        ? 'bg-blue-100 border-blue-200 text-blue-700'
                        : 'bg-[var(--surface-alt)] border-[var(--border)] text-[var(--text)] hover:border-blue-200 hover:text-[var(--heading)]'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2.5">
                        {comp.type === 'microcontroller' ? (
                          <Cpu className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Radio className="w-4 h-4 text-sky-600" />
                        )}
                        <h4 className="text-xs font-mono font-semibold">{comp.displayName}</h4>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 uppercase font-mono">
                        {comp.type}
                      </span>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between text-[10px] text-[var(--text-muted)] font-mono">
                      <span className="flex items-center space-x-1">
                        <CheckCircle className="w-3 h-3 text-emerald-400" />
                        <span>{comp.pins.length} Pins</span>
                      </span>
                      <span>Pos: [{comp.position.map(n => n.toFixed(1)).join(', ')}]</span>
                    </div>

                    {isSelected && (
                      <div className="mt-3 pt-2.5 border-t border-[var(--border)] space-y-1">
                        <div className="text-[10px] text-blue-600 font-bold uppercase">Pin Map:</div>
                        <div className="grid grid-cols-2 gap-1.5 text-[9px] font-mono text-[var(--text)]">
                          {comp.pins.map(pin => (
                            <div key={pin.id} className="flex justify-between bg-white/70 px-1.5 py-0.5 rounded">
                              <span className="text-[var(--text-muted)]">{pin.id}</span>
                              <span className="text-blue-600 capitalize">{pin.type}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
