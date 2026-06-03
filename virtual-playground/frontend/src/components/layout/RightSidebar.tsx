// ??$$$ non-important
// ??$$$
import React, { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { 
  Info, 
  Settings, 
  Search, 
  Compass,
  Cpu
} from 'lucide-react';

export const RightSidebar: React.FC = () => {
  const {
    project,
    simulationRunning,
    selectedComponent,
    setSelectedComponent,
    buttonPressed,
    setButtonPressed,
    ledState,
    cpuUsage
  } = useProjectStore();

  const [simSpeed, setSimSpeed] = useState<number>(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataPointsRef = useRef<number[]>([]);

  // Push CPU points for the rolling telemetry chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const renderChart = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Keep trace points capped
      const points = dataPointsRef.current;
      if (simulationRunning) {
        points.push(cpuUsage);
      } else {
        points.push(0);
      }
      if (points.length > 50) {
        points.shift();
      }

      // Draw grid
      ctx.strokeStyle = '#181836';
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i += 20) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
      for (let j = 0; j < canvas.height; j += 15) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(canvas.width, j);
        ctx.stroke();
      }

      // Draw line
      if (points.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1.8;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 4;

        const xStep = canvas.width / (50 - 1);
        points.forEach((val, index) => {
          const x = index * xStep;
          // Scale val (0-100) to height
          const y = canvas.height - (val / 100) * (canvas.height - 10) - 5;
          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.stroke();
        ctx.shadowBlur = 0; // Reset shadow
      }

      animId = requestAnimationFrame(renderChart);
    };

    renderChart();
    return () => cancelAnimationFrame(animId);
  }, [simulationRunning, cpuUsage]);

  // Find currently selected component details
  const componentInfo = project.bom.find(c => c.key === selectedComponent);

  return (
    <aside className="w-80 border-l border-[var(--border)] bg-[var(--surface)] flex flex-col select-none">
      {/* Project Metadata Section */}
      <div className="p-4 border-b border-[var(--border)] space-y-2.5">
        <div className="flex items-center space-x-1.5 text-[var(--text-muted)] text-xs uppercase tracking-wider font-mono">
          <Info className="w-4 h-4 text-[var(--primary)]" />
          <span>Project Metadata</span>
        </div>
        
        <div className="bg-[var(--surface-alt)] border border-[var(--border)] p-3 rounded-lg space-y-1.5">
          <h3 className="text-xs font-mono font-semibold text-[var(--heading)]">{project.name}</h3>
          <p className="text-[10px] text-[var(--text-muted)] font-mono leading-relaxed">{project.description}</p>
          <div className="pt-2 border-t border-[var(--border)] flex justify-between text-[9px] text-[var(--text-muted)] font-mono">
            <span>Author: {project.author}</span>
            <span>Date: {project.createdAt}</span>
          </div>
        </div>

        {(project.phases?.length || project.additionalTools?.length || project.milestones?.length) ? (
          <div className="bg-[var(--surface-alt)] border border-[var(--border)] p-3 rounded-lg space-y-2">
            {project.phases?.length ? (
              <div>
                <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Build Phases</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {project.phases.map((phase, index) => (
                    <span key={`${phase}-${index}`} className="rounded bg-blue-100 px-2 py-0.5 text-[9px] font-semibold text-blue-700">
                      {phase}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {project.additionalTools?.length ? (
              <div>
                <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Additional Tools</p>
                <ul className="mt-1 space-y-0.5">
                  {project.additionalTools.slice(0, 6).map((tool, index) => (
                    <li key={`${tool}-${index}`} className="text-[10px] text-[var(--text)]">• {tool}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {project.milestones?.length ? (
              <div>
                <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Milestones</p>
                <div className="mt-1 max-h-28 overflow-y-auto space-y-1 pr-1">
                  {project.milestones.slice(0, 8).map((milestone, index) => (
                    <div key={`${milestone.id || milestone.title}-${index}`} className="rounded border border-[var(--border)] px-2 py-1 text-[10px] text-[var(--text)] bg-white/60">
                      <span className="font-semibold">{milestone.order || index + 1}.</span> {milestone.title || 'Untitled milestone'}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Interactive Controls & Speed */}
      <div className="p-4 border-b border-[var(--border)] space-y-3">
        <div className="flex items-center space-x-1.5 text-[var(--text-muted)] text-xs uppercase tracking-wider font-mono">
          <Settings className="w-4 h-4 text-[var(--primary)]" />
          <span>Hardware Controls</span>
        </div>

        <div className="space-y-3.5">
          {/* Simulation speed slider */}
          <div className="space-y-1.5 bg-[var(--surface-alt)] border border-[var(--border)] p-3 rounded-lg">
            <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-mono">
              <span>Clock Speed:</span>
              <span className="text-blue-600 font-semibold">{simSpeed}x (Realtime)</span>
            </div>
            <input 
              type="range" 
              min={1} 
              max={5} 
              value={simSpeed}
              onChange={(e) => setSimSpeed(Number(e.target.value))}
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>

          {/* Interactive virtual push button in sidebar */}
          <div className="bg-[var(--surface-alt)] border border-[var(--border)] p-3 rounded-lg space-y-2.5">
            <div className="text-[10px] text-[var(--text-muted)] font-mono">
              Sidebar Breadboard Push Button Input Switch:
            </div>
            <button
              onMouseDown={() => setButtonPressed(true)}
              onMouseUp={() => setButtonPressed(false)}
              onMouseLeave={() => buttonPressed && setButtonPressed(false)}
              className={`w-full py-2.5 rounded font-mono text-xs font-semibold select-none cursor-pointer transition-all border ${
                buttonPressed 
                  ? 'bg-red-500 text-white border-red-400 shadow-[0_0_12px_rgba(239,68,68,0.4)]'
                  : 'bg-white text-red-500 border-red-200 hover:bg-red-50'
              }`}
            >
              {buttonPressed ? 'BUTTON DEPRESSED' : 'HOLD TO PRESS BUTTON'}
            </button>
          </div>
        </div>
      </div>

      {/* Pin Inspector */}
      <div className="p-4 border-b border-[var(--border)] flex-1 overflow-y-auto space-y-2.5">
        <div className="flex items-center space-x-1.5 text-[var(--text-muted)] text-xs uppercase tracking-wider font-mono">
          <Search className="w-4 h-4 text-[var(--primary)]" />
          <span>Pin Inspector</span>
        </div>

        {componentInfo ? (
          <div className="bg-[var(--surface-alt)] border border-[var(--border)] p-3.5 rounded-lg space-y-3 text-left">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
              <span className="text-xs font-mono font-bold text-blue-700">{componentInfo.displayName}</span>
              <button 
                onClick={() => setSelectedComponent(null)}
                className="text-[9px] text-[var(--text-muted)] hover:text-[var(--heading)] font-mono"
              >
                Clear
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-mono text-[var(--text-muted)]">
                Live Voltages and Terminal States:
              </div>
              <div className="space-y-1.5">
                {componentInfo.pins.map(pin => {
                  // Resolve dynamic voltage read
                  let vLevel = 0.0;
                  let active = false;
                  if (simulationRunning) {
                    if (pin.type === 'power' || pin.id === '5V') vLevel = 5.0;
                    if (pin.id === 'D7' && ledState) { vLevel = 5.0; active = true; }
                    if (pin.id === 'D2' && buttonPressed) { vLevel = 5.0; active = true; }
                    if (pin.id === 'A' && ledState) { vLevel = 2.1; active = true; } // LED drop
                    if (pin.id === '1' && buttonPressed) { vLevel = 5.0; active = true; }
                  }

                  return (
                    <div key={pin.id} className="flex justify-between items-center bg-white/70 p-2 rounded border border-[var(--border)] text-[10.5px] font-mono">
                      <div className="flex items-center space-x-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                        <span className="text-[var(--heading)] font-bold">{pin.id}</span>
                        <span className="text-[9px] text-[var(--text-muted)] uppercase">({pin.type})</span>
                      </div>
                      <span className={active ? 'text-blue-600' : 'text-[var(--text-muted)]'}>
                        {vLevel.toFixed(2)} V
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[var(--surface-alt)] border border-[var(--border)] p-4 rounded-lg text-center text-[var(--text-muted)] text-[10.5px] font-mono py-8">
            <Compass className="w-6 h-6 text-[var(--text-muted)] mx-auto mb-2 animate-pulse" />
            <span>Select a 3D component or list item to inspect pin voltages.</span>
          </div>
        )}
      </div>

      {/* CPU Waves Graph */}
      <div className="p-4 border-t border-[#1f1f45] bg-[#09091f]/50 space-y-2">
        <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
          <span className="flex items-center space-x-1.5">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>Core Telemetry (CPU Activity)</span>
          </span>
          <span className="text-cyan-400">{simulationRunning ? cpuUsage : 0}%</span>
        </div>
        <div className="h-16 bg-[#04040d] border border-[#1f1f45] rounded overflow-hidden">
          <canvas 
            ref={canvasRef} 
            width={280} 
            height={64}
            className="w-full h-full block"
          />
        </div>
      </div>
    </aside>
  );
};
