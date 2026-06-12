// ??$$$ non-important
import React, { useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { FolderOpen, FileCode, FileJson, Cpu, Radio, CheckCircle, Layers } from 'lucide-react';

// ??$$$ newer code: added props interface for mobile open/close
export interface SidebarProps {
  isOpenMobile?: boolean;
}


// ??$$$ newer code: Responsive layout with mobile sliding drawer support
export const Sidebar: React.FC<SidebarProps> = ({ isOpenMobile = false }) => {
  const { project, selectedFile, setSelectedFile, selectedComponent, setSelectedComponent } = useProjectStore();
  const [activeTab, setActiveTab] = useState<'explorer' | 'components'>('explorer');

  const filesList = [
    { name: 'sketch.ino',    size: 'sketch', icon: FileCode },
    { name: 'wiring.json',   size: 'wiring', icon: FileJson },
    { name: 'editable.json', size: 'config', icon: FileJson },
    { name: 'scenario.json', size: 'scene',  icon: FileJson },
    { name: 'project.json',  size: 'full',   icon: FileJson },
  ];

  return (
    <aside className={`w-56 flex-shrink-0 border-r border-[var(--border)] bg-[var(--surface)] flex flex-col overflow-hidden transition-transform duration-300 z-40
      md:relative md:translate-x-0 md:flex
      fixed inset-y-12 left-0 shadow-2xl md:shadow-none
      ${isOpenMobile ? 'translate-x-0' : '-translate-x-full'}`}>

      {/* tab switcher */}
      <div className="flex border-b border-[var(--border)] bg-[var(--surface-alt)] p-1 gap-1 flex-shrink-0">
        {(['explorer', 'components'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all ${
              activeTab === tab
                ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30'
                : 'text-[var(--text-muted)] hover:text-[var(--heading)] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            {tab === 'explorer' ? <FolderOpen className="w-3 h-3" /> : <Layers className="w-3 h-3" />}
            <span>{tab === 'explorer' ? 'Files' : 'Parts'}</span>
          </button>
        ))}
      </div>

      {/* content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'explorer' ? (
          <div className="space-y-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)] px-1">Workspace / Root</p>

            <div className="space-y-0.5">
              {filesList.map(({ name, size, icon: Icon }) => {
                const isSelected = selectedFile === name;
                return (
                  <button
                    key={name}
                    onClick={() => setSelectedFile(name)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-all ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/25 text-indigo-700 dark:text-indigo-300'
                        : 'text-[var(--text)] hover:bg-[var(--surface-alt)] hover:text-[var(--heading)] border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-indigo-500' : 'text-[var(--text-muted)]'}`} />
                      <span className="text-xs font-mono truncate">{name}</span>
                    </div>
                    <span className={`text-[9px] flex-shrink-0 ml-1 ${isSelected ? 'text-indigo-400' : 'text-[var(--text-muted)]'}`}>{size}</span>
                  </button>
                );
              })}
            </div>

            {/* guide */}
            <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-3 space-y-1.5">
              <p className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">Simulation Guide</p>
              <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                Click <strong className="text-[var(--heading)]">sketch.ino</strong> to view the Arduino logic. Press <strong className="text-[var(--heading)]">Run</strong> to start.
              </p>
              <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                Interact with the <strong className="text-[var(--heading)]">Push Button</strong> in 3D to trigger input.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)] px-1">
              BOM Inventory ({project.bom.length})
            </p>

            {project.bom.map((comp) => {
              const isSelected = selectedComponent === comp.key;
              return (
                <button
                  key={comp.key}
                  onClick={() => setSelectedComponent(isSelected ? null : comp.key)}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/25 text-indigo-700 dark:text-indigo-300'
                      : 'bg-[var(--surface-alt)] border-[var(--border)] text-[var(--text)] hover:border-indigo-200 dark:hover:border-indigo-500/25'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {comp.type === 'microcontroller'
                        ? <Cpu className="w-3.5 h-3.5 flex-shrink-0 text-indigo-500" />
                        : <Radio className="w-3.5 h-3.5 flex-shrink-0 text-violet-500" />
                      }
                      <span className="text-xs font-medium truncate">{comp.displayName}</span>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 flex-shrink-0 uppercase font-semibold">{comp.type.slice(0, 3)}</span>
                  </div>

                  <div className="mt-1.5 flex items-center gap-1 text-[9px] text-[var(--text-muted)]">
                    <CheckCircle className="w-2.5 h-2.5 text-emerald-400" />
                    <span>{comp.pins.length} pins</span>
                  </div>

                  {isSelected && comp.pins.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-[var(--border)] grid grid-cols-2 gap-1">
                      {comp.pins.map(pin => (
                        <div key={pin.id} className="flex justify-between bg-white/70 dark:bg-white/5 px-1.5 py-0.5 rounded text-[9px] font-mono">
                          <span className="text-[var(--text-muted)]">{pin.id}</span>
                          <span className="text-indigo-500 capitalize">{pin.type}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};
