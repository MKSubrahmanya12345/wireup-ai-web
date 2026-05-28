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
    <aside className="w-80 border-r border-[#1f1f45] bg-[#070716] flex flex-col select-none">
      {/* Sidebar Mode Selector */}
      <div className="flex border-b border-[#1f1f45] bg-[#0a0a1c] p-1.5">
        <button
          onClick={() => setActiveTab('explorer')}
          className={`flex-1 flex items-center justify-center space-x-1.5 py-2 rounded text-xs font-mono font-medium transition-all ${
            activeTab === 'explorer'
              ? 'bg-[#1a1a3a] text-cyan-400 border border-[#00f0ff]/30 shadow-cyber'
              : 'text-slate-400 hover:text-white hover:bg-[#12122b]'
          }`}
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>PROJECT FILES</span>
        </button>
        <button
          onClick={() => setActiveTab('components')}
          className={`flex-1 flex items-center justify-center space-x-1.5 py-2 rounded text-xs font-mono font-medium transition-all ${
            activeTab === 'components'
              ? 'bg-[#1a1a3a] text-cyan-400 border border-[#00f0ff]/30 shadow-cyber'
              : 'text-slate-400 hover:text-white hover:bg-[#12122b]'
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
            <div className="flex items-center space-x-1 text-slate-400 text-xs uppercase tracking-wider font-mono">
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
                        ? 'bg-[#1a1a3d] border-[#00f0ff]/40 text-cyan-300'
                        : 'border-transparent text-slate-300 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <IconComponent className={`w-4 h-4 ${isSelected ? 'text-cyan-400' : 'text-slate-400'}`} />
                      <span className="text-xs font-mono">{file.name}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">{file.size}</span>
                  </motion.div>
                );
              })}
            </div>

            <div className="mt-8 border border-[#1f1f45]/50 bg-[#0c0c24] rounded-lg p-3.5 text-xs text-slate-400 font-mono space-y-2">
              <div className="flex items-center space-x-2 text-cyan-400 font-semibold border-b border-[#1f1f45]/80 pb-1.5">
                <Info className="w-3.5 h-3.5" />
                <span>Simulation Guide</span>
              </div>
              <p className="leading-relaxed text-[11px]">
                Click <strong className="text-white">sketch.ino</strong> in the explorer to view the Arduino logic. Use the <strong className="text-white">RUN</strong> button above to initialize the simulated circuit.
              </p>
              <p className="leading-relaxed text-[11px] pt-1">
                Interact with the <strong className="text-white">Push Button</strong> in the 3D scene to trigger the input signal!
              </p>
            </div>
          </div>
        ) : (
          /* Component Inventory view */
          <div className="space-y-3">
            <div className="text-slate-400 text-xs uppercase tracking-wider font-mono mb-2">
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
                        ? 'bg-[#1a1a3d] border-[#00f0ff]/50 text-cyan-300 shadow-cyber'
                        : 'bg-[#0f0f29] border-[#1f1f45] text-slate-300 hover:border-slate-600 hover:text-white'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2.5">
                        {comp.type === 'microcontroller' ? (
                          <Cpu className="w-4 h-4 text-cyan-400" />
                        ) : (
                          <Radio className="w-4 h-4 text-purple-400" />
                        )}
                        <h4 className="text-xs font-mono font-semibold">{comp.displayName}</h4>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase font-mono">
                        {comp.type}
                      </span>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span className="flex items-center space-x-1">
                        <CheckCircle className="w-3 h-3 text-emerald-400" />
                        <span>{comp.pins.length} Pins</span>
                      </span>
                      <span>Pos: [{comp.position.map(n => n.toFixed(1)).join(', ')}]</span>
                    </div>

                    {isSelected && (
                      <div className="mt-3 pt-2.5 border-t border-[#1f1f45] space-y-1">
                        <div className="text-[10px] text-cyan-400 font-bold uppercase">Pin Map:</div>
                        <div className="grid grid-cols-2 gap-1.5 text-[9px] font-mono text-slate-300">
                          {comp.pins.map(pin => (
                            <div key={pin.id} className="flex justify-between bg-black/40 px-1.5 py-0.5 rounded">
                              <span className="text-slate-400">{pin.id}</span>
                              <span className="text-cyan-300 capitalize">{pin.type}</span>
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
