// ??$$$ non-important
// ??$$$
import React from 'react';
import { useProjectStore } from '../../store/useProjectStore';

export const SchematicView: React.FC = () => {
  const { 
    simulationRunning, 
    ledState, 
    buttonPressed, 
    setButtonPressed,
    selectedComponent,
    setSelectedComponent
  } = useProjectStore();

  // Pins SVG coordinates map
  const coordinates: Record<string, { x: number; y: number }> = {
    'arduino.5V': { x: 340, y: 280 },
    'arduino.GND': { x: 360, y: 280 },
    'arduino.D7': { x: 440, y: 120 },
    'arduino.D2': { x: 380, y: 120 },
    'led1.A': { x: 580, y: 200 },
    'led1.C': { x: 620, y: 200 },
    'button1.1': { x: 180, y: 250 },
    'button1.2': { x: 220, y: 250 },
  };

  // Custom curved paths generator
  const getBezierPath = (fromKey: string, toKey: string) => {
    const start = coordinates[fromKey];
    const end = coordinates[toKey];
    if (!start || !end) return '';
    
    // Calculate control points for a smooth schematic curve
    const dx = Math.abs(end.x - start.x) * 0.5;
    const dy = Math.abs(end.y - start.y) * 0.5;
    
    const cp1x = start.x + (end.x > start.x ? dx : -dx);
    const cp1y = start.y + (end.y > start.y ? -dy * 0.2 : dy * 0.2);
    const cp2x = end.x + (start.x > end.x ? dx : -dx);
    const cp2y = end.y + (start.y > end.y ? dy * 0.2 : -dy * 0.2);

    return `M ${start.x} ${start.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${end.x} ${end.y}`;
  };

  return (
    <div className="w-full h-full bg-[#03030c] relative flex flex-col items-center justify-center p-4">
      {/* Schematic Container */}
      <div className="w-full max-w-4xl aspect-[8/5] bg-[#070716] border border-[#1f1f45] rounded-xl relative overflow-hidden shadow-[0_0_30px_rgba(7,7,22,0.8)]">
        {/* Neon warning banner for fallback */}
        <div className="absolute top-3 left-3 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-md text-[10px] text-amber-400 font-mono flex items-center space-x-1.5 z-10 shadow-sm animate-pulse">
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          <span>GPU WEBGL CONTEXT FAILED — RUNNING 2D SCHEMATIC FALLBACK</span>
        </div>

        {/* SVG Canvas Area */}
        <svg viewBox="0 0 800 500" className="w-full h-full select-none">
          <defs>
            {/* Grid pattern definition */}
            <pattern id="schematic-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#13132e" strokeWidth="0.8" />
            </pattern>
            {/* Glowing neon filter */}
            <filter id="glow-neon" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-led" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="12" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Grid Background */}
          <rect width="100%" height="100%" fill="url(#schematic-grid)" />

          {/* ==================== CONNECTIONS / WIRES ==================== */}
          {/* Red LED Anode Wire */}
          <path
            d={getBezierPath('arduino.D7', 'led1.A')}
            stroke="#ef4444"
            strokeWidth="3.5"
            fill="none"
            strokeLinecap="round"
            className={simulationRunning && ledState ? 'pulse-signal' : ''}
            style={{ filter: simulationRunning && ledState ? 'url(#glow-neon)' : 'none' }}
          />
          {simulationRunning && ledState && (
            <path
              d={getBezierPath('arduino.D7', 'led1.A')}
              stroke="#ffffff"
              strokeWidth="2"
              fill="none"
              strokeDasharray="8, 12"
              strokeDashoffset="0"
              style={{ animation: 'stroke-move 1.5s linear infinite' }}
            />
          )}

          {/* LED Cathode Ground Wire */}
          <path
            d={getBezierPath('led1.C', 'arduino.GND')}
            stroke="#64748b"
            strokeWidth="3.5"
            fill="none"
            strokeLinecap="round"
          />

          {/* Push Button Control Wire */}
          <path
            d={getBezierPath('button1.1', 'arduino.D2')}
            stroke="#00f0ff"
            strokeWidth="3.5"
            fill="none"
            strokeLinecap="round"
            className={simulationRunning && buttonPressed ? 'pulse-signal' : ''}
            style={{ filter: simulationRunning && buttonPressed ? 'url(#glow-neon)' : 'none' }}
          />
          {simulationRunning && buttonPressed && (
            <path
              d={getBezierPath('button1.1', 'arduino.D2')}
              stroke="#ffffff"
              strokeWidth="2"
              fill="none"
              strokeDasharray="8, 12"
              strokeDashoffset="0"
              style={{ animation: 'stroke-move 1.5s linear infinite' }}
            />
          )}

          {/* ==================== HARDWARE COMPONENTS ==================== */}

          {/* 1. ARDUINO UNO R3 BOARD */}
          <g 
            transform="translate(300, 100)" 
            onClick={() => setSelectedComponent(selectedComponent === 'arduino' ? null : 'arduino')}
            className="cursor-pointer"
          >
            {/* Board PCB body outline */}
            <rect
              width="180"
              height="200"
              rx="10"
              fill="#0b0b26"
              stroke={selectedComponent === 'arduino' ? '#00f0ff' : '#1f1f4e'}
              strokeWidth={selectedComponent === 'arduino' ? '2.5' : '1.5'}
              style={{ filter: selectedComponent === 'arduino' ? 'url(#glow-neon)' : 'none' }}
            />
            {/* Headers row - Top Digital */}
            <rect x="20" y="10" width="140" height="12" rx="2" fill="#18183c" stroke="#25255a" strokeWidth="1" />
            <text x="90" y="20" fill="#475569" fontSize="7" fontFamily="monospace" textAnchor="middle" fontWeight="bold">DIGITAL (PWM ~)</text>
            
            {/* Pin D7 and D2 indicator lights */}
            <circle cx="140" cy="16" r="3" fill={simulationRunning && ledState ? '#ef4444' : '#1e293b'} />
            <text x="140" y="30" fill="#94a3b8" fontSize="8" fontFamily="monospace" textAnchor="middle">D7</text>

            <circle cx="80" cy="16" r="3" fill={simulationRunning && buttonPressed ? '#00f0ff' : '#1e293b'} />
            <text x="80" y="30" fill="#94a3b8" fontSize="8" fontFamily="monospace" textAnchor="middle">D2</text>

            {/* Headers row - Bottom Power */}
            <rect x="20" y="178" width="140" height="12" rx="2" fill="#18183c" stroke="#25255a" strokeWidth="1" />
            <text x="90" y="187" fill="#475569" fontSize="7" fontFamily="monospace" textAnchor="middle" fontWeight="bold">POWER / GND</text>

            <circle cx="40" cy="184" r="3" fill={simulationRunning ? '#10b981' : '#1e293b'} />
            <text x="40" y="172" fill="#94a3b8" fontSize="8" fontFamily="monospace" textAnchor="middle">5V</text>

            <circle cx="60" cy="184" r="3" fill={simulationRunning ? '#64748b' : '#1e293b'} />
            <text x="60" y="172" fill="#94a3b8" fontSize="8" fontFamily="monospace" textAnchor="middle">GND</text>

            {/* MCU Central Chip */}
            <rect x="50" y="70" width="80" height="35" rx="3" fill="#111" stroke="#2e2e2e" strokeWidth="1" />
            <text x="90" y="92" fill="#4b5563" fontSize="8" fontFamily="monospace" textAnchor="middle" fontWeight="bold">ATMEGA328P</text>
            
            {/* Board Label */}
            <text x="90" y="135" fill="#e2e8f0" fontSize="11" fontFamily="sans-serif" textAnchor="middle" fontWeight="bold" letterSpacing="1">ARDUINO UNO</text>
            <text x="90" y="148" fill="#00f0ff" fontSize="8" fontFamily="monospace" textAnchor="middle" letterSpacing="2">WIREUP ENGINE</text>
          </g>

          {/* 2. LED COMPONENT */}
          <g 
            transform="translate(550, 130)"
            onClick={() => setSelectedComponent(selectedComponent === 'led1' ? null : 'led1')}
            className="cursor-pointer"
          >
            {/* LED background backing */}
            <rect
              width="100"
              height="140"
              rx="8"
              fill="#08081c"
              stroke={selectedComponent === 'led1' ? '#00f0ff' : '#181836'}
              strokeWidth={selectedComponent === 'led1' ? '2' : '1'}
            />
            {/* LED terminals connection points */}
            <circle cx="30" cy="70" r="4.5" fill="#ef4444" />
            <circle cx="70" cy="70" r="4.5" fill="#64748b" />
            <text x="30" y="85" fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="middle">A</text>
            <text x="70" y="85" fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="middle">C</text>

            {/* Neon glowing light aura (emissive) */}
            {simulationRunning && ledState && (
              <circle
                cx="50"
                cy="35"
                r="25"
                fill="rgba(239, 68, 68, 0.45)"
                style={{ filter: 'url(#glow-led)' }}
              />
            )}

            {/* LED Bulb Dome Body */}
            <path
              d="M 30,45 C 30,20 70,20 70,45 L 70,50 L 30,50 Z"
              fill={simulationRunning && ledState ? '#ff4d4d' : '#851b1b'}
              stroke="#111"
              strokeWidth="1"
            />
            <rect x="27" y="50" width="46" height="4" fill={simulationRunning && ledState ? '#ff6666' : '#992222'} rx="1" />

            <text x="50" y="115" fill="#e2e8f0" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">RED LED</text>
            <text x="50" y="127" fill={simulationRunning && ledState ? '#10b981' : '#64748b'} fontSize="7" fontFamily="monospace" textAnchor="middle">
              {simulationRunning && ledState ? 'STATUS: ON' : 'STATUS: OFF'}
            </text>
          </g>

          {/* 3. PUSH BUTTON COMPONENT */}
          <g 
            transform="translate(130, 180)"
            onClick={() => setSelectedComponent(selectedComponent === 'button1' ? null : 'button1')}
            className="cursor-pointer"
          >
            {/* Button Component container */}
            <rect
              width="120"
              height="140"
              rx="8"
              fill="#08081c"
              stroke={selectedComponent === 'button1' ? '#00f0ff' : '#181836'}
              strokeWidth={selectedComponent === 'button1' ? '2' : '1'}
            />

            {/* Component Pins */}
            <circle cx="50" cy="70" r="4.5" fill="#00f0ff" />
            <circle cx="90" cy="70" r="4.5" fill="#94a3b8" />
            <text x="50" y="85" fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="middle">1</text>
            <text x="90" y="85" fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="middle">2</text>

            {/* Button Plunger Housing */}
            <rect x="35" y="15" width="50" height="40" rx="4" fill="#18181f" stroke="#333" strokeWidth="1" />
            
            {/* Red button cap trigger (interactive) */}
            <circle
              cx="60"
              cy="35"
              r={buttonPressed ? 14 : 16}
              fill={buttonPressed ? '#ef4444' : '#b71c1c'}
              stroke="#111"
              strokeWidth="1.5"
              className="transition-all duration-75 hover:fill-[#d32f2f]"
              onMouseDown={(e) => {
                e.stopPropagation();
                setButtonPressed(true);
              }}
              onMouseUp={(e) => {
                e.stopPropagation();
                setButtonPressed(false);
              }}
              onMouseLeave={() => {
                if (buttonPressed) setButtonPressed(false);
              }}
            />

            <text x="60" y="115" fill="#e2e8f0" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">TACT SWITCH</text>
            <text x="60" y="127" fill={buttonPressed ? '#00f0ff' : '#64748b'} fontSize="7" fontFamily="monospace" textAnchor="middle">
              {buttonPressed ? 'STATE: CLOSED' : 'STATE: OPEN'}
            </text>
          </g>

        </svg>

        {/* Dynamic Telemetry stats HUD overlay */}
        <div className="absolute bottom-3 right-3 bg-black/80 backdrop-blur-md border border-[#1f1f45] p-3 rounded-lg text-[10px] font-mono text-slate-400 space-y-1">
          <div className="text-cyan-400 font-bold uppercase tracking-wider mb-1">Interactive Telemetry</div>
          <div>D2 Signal: <span className={buttonPressed ? 'text-cyan-400 font-bold' : 'text-slate-500'}>{buttonPressed ? '5.00 V (HIGH)' : '0.00 V (LOW)'}</span></div>
          <div>D7 Output: <span className={ledState ? 'text-red-400 font-bold' : 'text-slate-500'}>{ledState ? '5.00 V (HIGH)' : '0.00 V (LOW)'}</span></div>
          <div>Circuit Loop: <span className={simulationRunning ? 'text-emerald-400 font-bold animate-pulse' : 'text-slate-500'}>{simulationRunning ? 'ACTIVE (9600 BAUD)' : 'SUSPENDED'}</span></div>
        </div>
      </div>
      
      {/* Interaction tip banner */}
      <p className="text-[10px] font-mono text-slate-500 mt-3 text-center">
        💡 Interact: Drag or Hold down the red circle on the <strong className="text-slate-300">TACT SWITCH</strong> to simulate breadboard signals.
      </p>
    </div>
  );
};
