// ??$$$ non-important
import React, { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { Info, Settings, Search, Compass, Cpu } from 'lucide-react';

export const RightSidebar: React.FC = () => {
  const {
    project, simulationRunning, selectedComponent, setSelectedComponent,
    buttonPressed, setButtonPressed, ledState, cpuUsage
  } = useProjectStore();

  const [simSpeed, setSimSpeed] = useState<number>(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataPointsRef = useRef<number[]>([]);

  // rolling CPU chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animId: number;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const pts = dataPointsRef.current;
      pts.push(simulationRunning ? cpuUsage : 0);
      if (pts.length > 50) pts.shift();

      // grid
      ctx.strokeStyle = 'rgba(99,102,241,0.06)';
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i += 20) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke(); }
      for (let j = 0; j < canvas.height; j += 15) { ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(canvas.width, j); ctx.stroke(); }

      // line
      if (pts.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = '#818cf8';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#818cf8';
        ctx.shadowBlur = 4;
        const xStep = canvas.width / 49;
        pts.forEach((val, i) => {
          const x = i * xStep;
          const y = canvas.height - (val / 100) * (canvas.height - 8) - 4;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      animId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animId);
  }, [simulationRunning, cpuUsage]);

  const componentInfo = project.bom.find(c => c.key === selectedComponent);

  const sectionHeader = (icon: React.ReactNode, label: string) => (
    <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)] mb-2">
      {icon}
      <span>{label}</span>
    </div>
  );

  return (
    <aside className="w-60 flex-shrink-0 border-l border-[var(--border)] bg-[var(--surface)] flex flex-col overflow-hidden">

      {/* Project info */}
      <div className="p-3 border-b border-[var(--border)] flex-shrink-0">
        {sectionHeader(<Info className="w-3 h-3 text-indigo-500" />, 'Project')}
        <div className="bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl p-2.5 space-y-1">
          <p className="text-xs font-semibold text-[var(--heading)] truncate">{project.name}</p>
          <p className="text-[10px] text-[var(--text-muted)] leading-relaxed line-clamp-2">{project.description}</p>
          <div className="pt-1.5 border-t border-[var(--border)] flex justify-between text-[9px] text-[var(--text-muted)] font-mono">
            <span>{project.author}</span>
            <span>{project.createdAt}</span>
          </div>
        </div>

        {project.milestones && project.milestones.length > 0 && (
          <div className="mt-2 max-h-24 overflow-y-auto space-y-0.5">
            {project.milestones.slice(0, 5).map((m, i) => (
              <div key={m.id || i} className="rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] px-2 py-1 text-[10px] text-[var(--text)] truncate">
                <span className="font-semibold text-[var(--text-muted)]">{m.order || i + 1}.</span> {m.title || 'Milestone'}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hardware controls */}
      <div className="p-3 border-b border-[var(--border)] flex-shrink-0">
        {sectionHeader(<Settings className="w-3 h-3 text-indigo-500" />, 'Controls')}

        <div className="space-y-2.5">
          {/* clock speed */}
          <div className="bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl p-2.5">
            <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-mono mb-1.5">
              <span>Clock Speed</span>
              <span className="text-indigo-500 font-semibold">{simSpeed}×</span>
            </div>
            <input
              type="range" min={1} max={5} value={simSpeed}
              onChange={e => setSimSpeed(Number(e.target.value))}
              className="w-full h-1 rounded-full appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* push button */}
          <button
            onMouseDown={() => setButtonPressed(true)}
            onMouseUp={() => setButtonPressed(false)}
            onMouseLeave={() => buttonPressed && setButtonPressed(false)}
            className={`w-full py-2 rounded-xl text-xs font-semibold select-none transition-all border ${
              buttonPressed
                ? 'bg-red-500 text-white border-red-400 shadow-md shadow-red-500/30'
                : 'bg-[var(--surface-alt)] text-red-500 border-red-200 dark:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/10'
            }`}
          >
            {buttonPressed ? 'BUTTON HELD' : 'HOLD TO PRESS'}
          </button>
        </div>
      </div>

      {/* Pin inspector */}
      <div className="flex-1 overflow-y-auto p-3 border-b border-[var(--border)]">
        {sectionHeader(<Search className="w-3 h-3 text-indigo-500" />, 'Pin Inspector')}

        {componentInfo ? (
          <div className="bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl p-2.5 space-y-2">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-1.5">
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 truncate">{componentInfo.displayName}</span>
              <button onClick={() => setSelectedComponent(null)} className="text-[9px] text-[var(--text-muted)] hover:text-[var(--heading)] flex-shrink-0 ml-1">✕</button>
            </div>
            <div className="space-y-1">
              {componentInfo.pins.map(pin => {
                let vLevel = 0;
                let active = false;
                if (simulationRunning) {
                  if (pin.type === 'power' || pin.id === '5V') { vLevel = 5; }
                  if (pin.id === 'D7' && ledState) { vLevel = 5; active = true; }
                  if (pin.id === 'D2' && buttonPressed) { vLevel = 5; active = true; }
                  if (pin.id === 'A' && ledState) { vLevel = 2.1; active = true; }
                  if (pin.id === '1' && buttonPressed) { vLevel = 5; active = true; }
                }
                return (
                  <div key={pin.id} className="flex justify-between items-center bg-white/70 dark:bg-white/5 px-2 py-1 rounded-lg text-[10px] font-mono">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-indigo-400 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`} />
                      <span className="font-bold text-[var(--heading)]">{pin.id}</span>
                      <span className="text-[9px] text-[var(--text-muted)] uppercase">({pin.type})</span>
                    </div>
                    <span className={active ? 'text-indigo-500' : 'text-[var(--text-muted)]'}>{vLevel.toFixed(2)}V</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl p-4 text-center">
            <Compass className="w-5 h-5 text-[var(--text-muted)] mx-auto mb-1.5 animate-pulse" />
            <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">Select a 3D component to inspect pin voltages.</p>
          </div>
        )}
      </div>

      {/* CPU chart */}
      <div className="p-3 flex-shrink-0">
        <div className="flex justify-between items-center text-[9px] text-[var(--text-muted)] font-mono mb-1.5">
          <span className="flex items-center gap-1">
            <Cpu className="w-3 h-3 text-indigo-400" />
            <span>CPU Activity</span>
          </span>
          <span className="text-indigo-400">{simulationRunning ? cpuUsage : 0}%</span>
        </div>
        <div className="h-12 bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl overflow-hidden">
          <canvas ref={canvasRef} width={224} height={48} className="w-full h-full block" />
        </div>
      </div>
    </aside>
  );
};
