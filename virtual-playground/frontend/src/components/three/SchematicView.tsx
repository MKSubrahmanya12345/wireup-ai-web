// ??$$$ newer code - Dynamic SchematicView with auto-routing wires and custom component renderers
import React, { useMemo } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import type { ComponentItem, Wiring } from '../../types/project';

const normalizePin = (value: string) => {
  let pin = String(value || '').trim().toUpperCase();
  if (!pin) {
    return '';
  }

  if (pin === 'SDA') {
    return 'A4';
  }

  if (pin === 'SCL') {
    return 'A5';
  }

  if (pin === 'RX') {
    return 'D0';
  }

  if (pin === 'TX') {
    return 'D1';
  }

  if (/^GPIO\d+$/.test(pin)) {
    pin = `D${pin.slice(4)}`;
  }

  if (/^\d+$/.test(pin)) {
    pin = `D${pin}`;
  }

  return pin;
};

const deriveComponentType = (item: any): string => {
  const subsystem = String(item?.subsystem || '').toLowerCase();
  const mpn = String(item?.mpn || '').toLowerCase();
  const key = String(item?.key || '').toLowerCase();
  const name = String(item?.displayName || item?.name || '').toLowerCase();

  if (subsystem === 'mcu' || key === 'mcu' || name.includes('arduino') || name.includes('uno') || mpn.includes('arduino')) {
    return 'microcontroller';
  }
  if (subsystem === 'output' && (name.includes('led') || mpn.includes('led')) || key === 'led' || name.includes('led')) {
    return 'led';
  }
  if (subsystem === 'input' || key === 'button' || name.includes('button') || name.includes('pushbutton') || name.includes('switch') || mpn.includes('pushbutton') || mpn.includes('tactile')) {
    return 'button';
  }
  if (subsystem === 'display' || key === 'lcd' || name.includes('lcd') || name.includes('oled') || name.includes('display') || name.includes('screen') || mpn.includes('lcd')) {
    return 'display';
  }
  if (subsystem === 'passive' || key === 'resistor' || name.includes('resistor') || name.includes('capacitor') || mpn.includes('resistor')) {
    return 'passive';
  }
  if (name.includes('servo') || name.includes('motor') || mpn.includes('servo') || mpn.includes('sg90')) {
    return 'servo';
  }

  return String(item?.type || 'module').toLowerCase();
};

const getComponentPins = (compKey: string, bomPins: any[], wiring: any[]) => {
  const pinsSet = new Set<string>();
  (wiring || []).forEach(w => {
    const fromParts = (w.from || '').split('.');
    if (fromParts[0] === compKey && fromParts[1]) pinsSet.add(fromParts[1]);
    const toParts = (w.to || '').split('.');
    if (toParts[0] === compKey && toParts[1]) pinsSet.add(toParts[1]);
  });
  (bomPins || []).forEach(p => {
    const pinName = p.id || p.name;
    if (pinName) pinsSet.add(pinName);
  });
  if (pinsSet.size === 0) {
    pinsSet.add('IO1');
    pinsSet.add('IO2');
  }
  return Array.from(pinsSet);
};

const renderComponentVisuals = (
  type: string,
  item: any,
  isSelected: boolean,
  buttonPressed: boolean,
  setButtonPressed: (pressed: boolean) => void,
  ledState: boolean,
  servoAngles: any,
  project: any,
  lcdLine1: string,
  lcdLine2: string,
  lcdBacklight: boolean
) => {
  switch (type) {
    case 'button':
      return (
        <g>
          <rect x="25" y="20" width="50" height="40" rx="3" fill="#18181f" stroke="#333" strokeWidth="1" />
          <circle
            cx="50"
            cy="40"
            r={buttonPressed ? 11 : 14}
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
          <text x="50" y="72" fill="#94a3b8" fontSize="7" fontFamily="monospace" textAnchor="middle">
            {buttonPressed ? 'CLOSED' : 'OPEN'}
          </text>
        </g>
      );
      
    case 'led': {
      const color = String(item.displayName || item.key || '').toLowerCase().includes('red') ? 'red' :
                    String(item.displayName || item.key || '').toLowerCase().includes('green') ? 'green' :
                    String(item.displayName || item.key || '').toLowerCase().includes('blue') ? 'blue' : 'red';
      const activeColor = color === 'red' ? '#ff4d4d' : color === 'green' ? '#10b981' : '#3b82f6';
      const offColor = color === 'red' ? '#851b1b' : color === 'green' ? '#065f46' : '#1e3a8a';
      const glowColor = color === 'red' ? 'rgba(239, 68, 68, 0.4)' : color === 'green' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(59, 130, 246, 0.4)';
      
      return (
        <g>
          {ledState && (
            <circle
              cx="50"
              cy="35"
              r="22"
              fill={glowColor}
              style={{ filter: 'url(#glow-led)' }}
            />
          )}
          <path
            d="M 35,45 C 35,20 65,20 65,45 L 65,50 L 35,50 Z"
            fill={ledState ? activeColor : offColor}
            stroke="#111"
            strokeWidth="1"
          />
          <rect x="32" y="50" width="36" height="4" fill={ledState ? activeColor : offColor} rx="1" />
          <text x="50" y="72" fill="#94a3b8" fontSize="7" fontFamily="monospace" textAnchor="middle">
            {ledState ? 'ON' : 'OFF'}
          </text>
        </g>
      );
    }
      
    case 'motor':
    case 'servo': {
      const wire = (project?.wiring || []).find((w: any) => (w.from || '').startsWith(item.key + '.') || (w.to || '').startsWith(item.key + '.'));
      const mcuPin = wire ? ((wire.from || '').startsWith('mcu.') || (wire.from || '').startsWith('arduino.') ? (wire.from || '').split('.')[1] : ((wire.to || '').startsWith('mcu.') || (wire.to || '').startsWith('arduino.') ? (wire.to || '').split('.')[1] : 'D3')) : 'D3';
      const normMcuPin = normalizePin(mcuPin);
      const angle = (servoAngles || {})[normMcuPin] || 0;
      
      return (
        <g>
          <rect x="20" y="15" width="60" height="42" rx="3" fill="#1e3a8a" stroke="#1d4ed8" strokeWidth="1" />
          <circle cx="50" cy="36" r="15" fill="#111827" stroke="#374151" strokeWidth="1" />
          <g transform={`rotate(${angle}, 50, 36)`}>
            <circle cx="50" cy="36" r="7" fill="#f3f4f6" stroke="#9ca3af" strokeWidth="0.5" />
            <rect x="46" y="12" width="8" height="48" rx="2" fill="#f3f4f6" stroke="#9ca3af" strokeWidth="0.5" />
            <circle cx="50" cy="18" r="1.5" fill="#475569" />
            <circle cx="50" cy="36" r="2.5" fill="#475569" />
            <circle cx="50" cy="54" r="1.5" fill="#475569" />
          </g>
          <text x="50" y="72" fill="#94a3b8" fontSize="7" fontFamily="monospace" textAnchor="middle">
            {angle}°
          </text>
        </g>
      );
    }
      
    case 'display':
      return (
        <g>
          <rect x="10" y="15" width="80" height="45" rx="2" fill={lcdBacklight ? '#1e3a8a' : '#1f2937'} stroke="#4b5563" strokeWidth="1.5" />
          <text x="15" y="32" fill={lcdBacklight ? '#60a5fa' : '#374151'} fontSize="6.5" fontFamily="monospace">
            {lcdLine1.substring(0, 16)}
          </text>
          <text x="15" y="46" fill={lcdBacklight ? '#60a5fa' : '#374151'} fontSize="6.5" fontFamily="monospace">
            {lcdLine2.substring(0, 16)}
          </text>
        </g>
      );
      
    default:
      return (
        <g>
          <rect x="25" y="22" width="50" height="30" rx="2" fill="#334155" stroke="#475569" strokeWidth="1" />
          <line x1="10" y1="37" x2="25" y2="37" stroke="#475569" strokeWidth="1.5" />
          <line x1="75" y1="37" x2="90" y2="37" stroke="#475569" strokeWidth="1.5" />
          <text x="50" y="40" fill="#94a3b8" fontSize="6.5" fontFamily="monospace" textAnchor="middle">
            MOD
          </text>
        </g>
      );
  }
};
// getMcuPinCoords is defined outside the component as a static helper
const getMcuPinCoords = (pinName: string, isEsp32: boolean) => {
  const norm = pinName.toUpperCase().trim();
  
  if (!isEsp32) {
    if (norm === 'D0' || norm === 'RX') return { x: 300, y: 110 };
    if (norm === 'D1' || norm === 'TX') return { x: 312, y: 110 };
    if (norm === 'D2') return { x: 324, y: 110 };
    if (norm === 'D3') return { x: 336, y: 110 };
    if (norm === 'D4') return { x: 348, y: 110 };
    if (norm === 'D5') return { x: 360, y: 110 };
    if (norm === 'D6') return { x: 372, y: 110 };
    if (norm === 'D7') return { x: 384, y: 110 };
    if (norm === 'D8') return { x: 404, y: 110 };
    if (norm === 'D9') return { x: 416, y: 110 };
    if (norm === 'D10') return { x: 428, y: 110 };
    if (norm === 'D11') return { x: 440, y: 110 };
    if (norm === 'D12') return { x: 452, y: 110 };
    if (norm === 'D13') return { x: 464, y: 110 };
    if (norm.includes('GND')) return { x: 476, y: 110 };
    if (norm === 'AREF') return { x: 488, y: 110 };
    if (norm === 'SDA') return { x: 500, y: 110 };
    if (norm === 'SCL') return { x: 512, y: 110 };

    if (norm === 'RESET' || norm === 'RST') return { x: 310, y: 390 };
    if (norm === '3V3' || norm === '3.3V') return { x: 322, y: 390 };
    if (norm === '5V') return { x: 334, y: 390 };
    if (norm === 'VIN') return { x: 358, y: 390 };
    if (norm === 'A0') return { x: 382, y: 390 };
    if (norm === 'A1') return { x: 394, y: 390 };
    if (norm === 'A2') return { x: 406, y: 390 };
    if (norm === 'A3') return { x: 418, y: 390 };
    if (norm === 'A4') return { x: 430, y: 390 };
    if (norm === 'A5') return { x: 442, y: 390 };
    
    return { x: 400, y: 110 };
  } else {
    const leftPins = ['3V3', 'EN', 'VP', 'VN', '34', '35', '32', '33', '25', '26', '27', '14', '12', 'GND', '13', 'SD2', 'SD3', 'CMD', '5V'];
    const rightPins = ['GND', 'TX', 'RX', '22', '21', '19', '18', '5', '17', '16', '4', '0', '2', '15', 'SD1', 'SD0', 'CLK', '23', 'GND'];
    
    const cleanName = norm.replace('GPIO', '').replace('D', '');
    
    const leftIdx = leftPins.findIndex(p => p === cleanName || p === norm);
    if (leftIdx !== -1) {
      return { x: 290, y: 90 + leftIdx * 17 };
    }
    
    const rightIdx = rightPins.findIndex(p => p === cleanName || p === norm);
    if (rightIdx !== -1) {
      return { x: 510, y: 90 + rightIdx * 17 };
    }
    
    return { x: 290, y: 200 };
  }
};

export const SchematicView: React.FC = () => {
  const { 
    simulationRunning, 
    ledState, 
    buttonPressed, 
    setButtonPressed,
    selectedComponent,
    setSelectedComponent,
    project,
    gpioPins,
    servoAngles,
    lcdLine1,
    lcdLine2,
    lcdBacklight
  } = useProjectStore();

  const mcuItem = useMemo(() => {
    return (project?.bom || []).find((item: any) =>
      item.key === 'mcu' || item.type === 'microcontroller' || String(item.displayName || '').toLowerCase().includes('arduino') || String(item.displayName || '').toLowerCase().includes('esp32')
    );
  }, [project]);

  const mcuKey = mcuItem?.key || 'mcu';
  const isEsp32 = useMemo(() => {
    // ??$$$ newer code
    return String(mcuItem?.displayName || '').toLowerCase().includes('esp32') || String((mcuItem as any)?.mpn || '').toLowerCase().includes('esp32');
  }, [mcuItem]);

  // Build routing coordinate maps and layouts
  const { pinCoordinates, leftLayouts, rightLayouts } = useMemo(() => {
    const pinCoords: Record<string, { x: number; y: number }> = {};
    
    // Register MCU pins
    (project?.wiring || []).forEach((w: any) => {
      const fromParts = (w.from || '').split('.');
      const toParts = (w.to || '').split('.');
      
      const resolveKey = (k: string) => {
        if (k === 'mcu' || k === 'arduino') return mcuKey;
        return k;
      };
      
      if (resolveKey(fromParts[0]) === mcuKey) {
        const pinName = fromParts[1];
        const coords = getMcuPinCoords(pinName, isEsp32);
        pinCoords[`${fromParts[0]}.${pinName}`] = coords;
        pinCoords[`mcu.${pinName}`] = coords;
        pinCoords[`arduino.${pinName}`] = coords;
      }
      if (resolveKey(toParts[0]) === mcuKey) {
        const pinName = toParts[1];
        const coords = getMcuPinCoords(pinName, isEsp32);
        pinCoords[`${toParts[0]}.${pinName}`] = coords;
        pinCoords[`mcu.${pinName}`] = coords;
        pinCoords[`arduino.${pinName}`] = coords;
      }
    });

    const peripherals = (project?.bom || []).filter((item: any) => item.key !== mcuKey && item.type !== 'microcontroller');
    
    const leftPeripherals = peripherals.filter((item: any) => {
      const type = deriveComponentType(item);
      return type === 'button' || type === 'sensor';
    });
    
    const rightPeripherals = peripherals.filter((item: any) => {
      const type = deriveComponentType(item);
      return type !== 'button' && type !== 'sensor';
    });

    const left = leftPeripherals.map((item: any, idx: number) => {
      const cx = 80;
      const spacing = 320 / Math.max(leftPeripherals.length, 1);
      const cy = 100 + idx * spacing + (spacing / 2);
      
      const pins = getComponentPins(item.key, item.pins || [], project?.wiring || []);
      const mappedPins = pins.map((p, pIdx) => {
        const numPins = pins.length;
        const pinSpacing = 60 / Math.max(numPins - 1, 1);
        const startX = cx - 30;
        const pinX = numPins === 1 ? cx : startX + pIdx * pinSpacing;
        const pinY = cy + 40;
        pinCoords[`${item.key}.${p}`] = { x: pinX, y: pinY };
        return { name: p, x: pinX, y: pinY };
      });
      
      return { item, cx, cy, pins: mappedPins };
    });

    const right = rightPeripherals.map((item: any, idx: number) => {
      const cx = 700;
      const spacing = 320 / Math.max(rightPeripherals.length, 1);
      const cy = 100 + idx * spacing + (spacing / 2);
      
      const pins = getComponentPins(item.key, item.pins || [], project?.wiring || []);
      const mappedPins = pins.map((p, pIdx) => {
        const numPins = pins.length;
        const pinSpacing = 60 / Math.max(numPins - 1, 1);
        const startX = cx - 30;
        const pinX = numPins === 1 ? cx : startX + pIdx * pinSpacing;
        const pinY = cy + 40;
        pinCoords[`${item.key}.${p}`] = { x: pinX, y: pinY };
        return { name: p, x: pinX, y: pinY };
      });
      
      return { item, cx, cy, pins: mappedPins };
    });

    return { pinCoordinates: pinCoords, leftLayouts: left, rightLayouts: right };
  }, [project, mcuKey, isEsp32]);

  const drawWire = (wire: any, index: number) => {
    const fromParts = (wire.from || '').split('.');
    const toParts = (wire.to || '').split('.');
    
    const resolveKey = (k: string) => {
      if (k === 'mcu' || k === 'arduino') return mcuKey;
      return k;
    };
    
    const fromKey = `${resolveKey(fromParts[0])}.${fromParts[1]}`;
    const toKey = `${resolveKey(toParts[0])}.${toParts[1]}`;
    
    const start = pinCoordinates[fromKey] || pinCoordinates[wire.from];
    const end = pinCoordinates[toKey] || pinCoordinates[wire.to];
    
    if (!start || !end) {
      return null;
    }
    
    const dx = Math.abs(end.x - start.x) * 0.5;
    const dy = Math.abs(end.y - start.y) * 0.5;
    
    const cp1x = start.x + (end.x > start.x ? dx : -dx);
    const cp1y = start.y + (end.y > start.y ? -dy * 0.2 : dy * 0.2);
    const cp2x = end.x + (start.x > end.x ? dx : -dx);
    const cp2y = end.y + (start.y > end.y ? dy * 0.2 : -dy * 0.2);
    
    const path = `M ${start.x} ${start.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${end.x} ${end.y}`;
    
    const mcuPin = resolveKey(fromParts[0]) === mcuKey
      ? fromParts[1]
      : (resolveKey(toParts[0]) === mcuKey ? toParts[1] : null);
      
    const isSignalActive = mcuPin ? Boolean(gpioPins[normalizePin(mcuPin)]) : false;
    
    return (
      <g key={`wire-${index}`}>
        <path
          d={path}
          stroke={wire.color || '#3b82f6'}
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
          className={simulationRunning && isSignalActive ? 'pulse-signal' : ''}
          style={{ filter: simulationRunning && isSignalActive ? 'url(#glow-neon)' : 'none' }}
        />
        {simulationRunning && isSignalActive && (
          <path
            d={path}
            stroke="#ffffff"
            strokeWidth="2"
            fill="none"
            strokeDasharray="8, 12"
            strokeDashoffset="0"
            style={{ animation: 'stroke-move 1.5s linear infinite' }}
          />
        )}
      </g>
    );
  };

  const renderComponentCard = (layout: any) => {
    const { item, cx, cy, pins } = layout;
    const isSelected = selectedComponent === item.key;
    const type = deriveComponentType(item);
    
    return (
      <g 
        key={item.key}
        transform={`translate(${cx - 50}, ${cy - 50})`}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedComponent(isSelected ? null : item.key);
        }}
        className="cursor-pointer"
      >
        <rect
          width="100"
          height="100"
          rx="8"
          fill="#08081c"
          stroke={isSelected ? '#00f0ff' : '#181836'}
          strokeWidth={isSelected ? '2' : '1'}
        />
        
        {renderComponentVisuals(type, item, isSelected, buttonPressed, setButtonPressed, ledState, servoAngles, project, lcdLine1, lcdLine2, lcdBacklight)}
        
        {pins.map((p: any, idx: number) => {
          const localX = p.x - (cx - 50);
          const localY = p.y - (cy - 50);
          
          return (
            <g key={`pin-${idx}`}>
              <circle cx={localX} cy={localY} r="3" fill="#475569" />
              <text x={localX} y={localY - 6} fill="#64748b" fontSize="6" fontFamily="monospace" textAnchor="middle">
                {p.name}
              </text>
            </g>
          );
        })}
        
        <text x="50" y="88" fill="#e2e8f0" fontSize="7.5" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
          {item.displayName?.substring(0, 15)}
        </text>
      </g>
    );
  };

  const renderMcuBoard = () => {
    const isSelected = selectedComponent === mcuKey;
    
    return (
      <g 
        transform="translate(280, 100)" 
        onClick={() => setSelectedComponent(isSelected ? null : mcuKey)}
        className="cursor-pointer"
      >
        <rect
          width="240"
          height="300"
          rx="12"
          fill="#0c0e2b"
          stroke={isSelected ? '#00f0ff' : '#1e293b'}
          strokeWidth={isSelected ? '2.5' : '1.5'}
          style={{ filter: isSelected ? 'url(#glow-neon)' : 'none' }}
        />
        
        <rect x="80" y="100" width="80" height="100" rx="4" fill="#111827" stroke="#374151" strokeWidth="1" />
        <text x="120" y="150" fill="#4b5563" fontSize="11" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
          {isEsp32 ? 'ESP32-WROOM' : 'ATMEGA328P'}
        </text>
        
        <text x="120" y="240" fill="#f8fafc" fontSize="14" fontFamily="sans-serif" textAnchor="middle" fontWeight="bold" letterSpacing="1">
          {isEsp32 ? 'ESP32 DEVKIT' : 'ARDUINO UNO'}
        </text>
        
        <text x="120" y="260" fill="#00f0ff" fontSize="8" fontFamily="monospace" textAnchor="middle" letterSpacing="2">
          WIREUP SIMULATOR
        </text>

        {!isEsp32 ? (
          <>
            <rect x="15" y="10" width="210" height="15" rx="2" fill="#18183c" stroke="#25255a" strokeWidth="1" />
            {Array.from({ length: 18 }).map((_, i) => {
              const x = 20 + i * 12;
              return <circle key={i} cx={x} cy={17.5} r="2.5" fill="#0f172a" stroke="#475569" strokeWidth="0.5" />;
            })}
            
            <rect x="25" y="275" width="190" height="15" rx="2" fill="#18183c" stroke="#25255a" strokeWidth="1" />
            {Array.from({ length: 16 }).map((_, i) => {
              const x = 30 + i * 12;
              return <circle key={i} cx={x} cy={282.5} r="2.5" fill="#0f172a" stroke="#475569" strokeWidth="0.5" />;
            })}
          </>
        ) : (
          <>
            <rect x="8" y="10" width="15" height="280" rx="2" fill="#18183c" stroke="#25255a" strokeWidth="1" />
            <rect x="217" y="10" width="15" height="280" rx="2" fill="#18183c" stroke="#25255a" strokeWidth="1" />
            {Array.from({ length: 19 }).map((_, i) => {
              const y = 15 + i * 15;
              return (
                <g key={i}>
                  <circle cx={15.5} cy={y} r="2.5" fill="#0f172a" stroke="#475569" strokeWidth="0.5" />
                  <circle cx={224.5} cy={y} r="2.5" fill="#0f172a" stroke="#475569" strokeWidth="0.5" />
                </g>
              );
            })}
          </>
        )}
      </g>
    );
  };

  return (
    <div className="w-full h-full bg-[#03030c] relative flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl aspect-[8/5] bg-[#070716] border border-[#1f1f45] rounded-xl relative overflow-hidden shadow-[0_0_30px_rgba(7,7,22,0.8)]">
        <div className="absolute top-3 left-3 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-md text-[10px] text-amber-400 font-mono flex items-center space-x-1.5 z-10 shadow-sm animate-pulse">
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          <span>GPU WEBGL CONTEXT FAILED — RUNNING 2D SCHEMATIC FALLBACK</span>
        </div>

        <svg viewBox="0 0 800 500" className="w-full h-full select-none">
          <defs>
            <pattern id="schematic-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#13132e" strokeWidth="0.8" />
            </pattern>
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
          
          <style>{`
            @keyframes stroke-move {
              to {
                stroke-dashoffset: -20;
              }
            }
          `}</style>

          <rect width="100%" height="100%" fill="url(#schematic-grid)" />

          {/* Draw all resolved wires */}
          {(project?.wiring || []).map((wire: any, idx: number) => drawWire(wire, idx))}

          {/* Draw MCU board */}
          {renderMcuBoard()}

          {/* Draw peripheral cards */}
          {leftLayouts.map(renderComponentCard)}
          {rightLayouts.map(renderComponentCard)}
        </svg>

        <div className="absolute bottom-3 right-3 bg-black/80 backdrop-blur-md border border-[#1f1f45] p-3 rounded-lg text-[10px] font-mono text-slate-400 space-y-1">
          <div className="text-cyan-400 font-bold uppercase tracking-wider mb-1">Interactive Telemetry</div>
          <div>CPU Loop: <span className={simulationRunning ? 'text-emerald-400 font-bold animate-pulse' : 'text-slate-500'}>{simulationRunning ? 'ACTIVE' : 'SUSPENDED'}</span></div>
          <div>Active Pins: <span className="text-slate-300">{Object.keys(gpioPins).filter(k => gpioPins[k]).join(', ') || 'NONE'}</span></div>
        </div>
      </div>
      
      <p className="text-[10px] font-mono text-slate-500 mt-3 text-center">
        💡 Interact: Drag or Hold down interactive caps/buttons to simulate hardware inputs.
      </p>
    </div>
  );
};

