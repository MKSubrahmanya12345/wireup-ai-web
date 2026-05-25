// @ts-nocheck
// pinInfo.x/y from @wokwi/elements pinInfo (top-left origin within component box)
const PIN_LOCAL = {
  'wokwi-arduino-uno': {
    '13': { x: 125, y: 9 }, '12': { x: 134.5, y: 9 }, '11': { x: 144, y: 9 }, '10': { x: 153.5, y: 9 },
    '9': { x: 163, y: 9 }, '8': { x: 173, y: 9 }, '7': { x: 189, y: 9 }, '6': { x: 198.5, y: 9 },
    '5': { x: 208, y: 9 }, '4': { x: 217.5, y: 9 }, '3': { x: 227, y: 9 }, '2': { x: 236.5, y: 9 },
    '1': { x: 246, y: 9 }, '0': { x: 255.5, y: 9 },
    'GND.1': { x: 115.5, y: 9 }, 'AREF': { x: 106, y: 9 },
    '5V': { x: 160, y: 191.5 }, 'GND.2': { x: 169.5, y: 191.5 }, 'GND.3': { x: 179, y: 191.5 },
    'A0': { x: 208, y: 191.5 }, 'A1': { x: 217.5, y: 191.5 },
  },
  'wokwi-led': { 'A': { x: 25, y: 42 }, 'C': { x: 15, y: 42 } },
  'wokwi-ir-receiver': { 'GND': { x: 20.97, y: 87.75 }, 'VCC': { x: 30.58, y: 87.75 }, 'DAT': { x: 40.18, y: 87.75 } },
  'wokwi-arduino-mega': { 
    '13': { x: 129, y: 9 }, '12': { x: 138, y: 9 }, '11': { x: 148, y: 9 }, '10': { x: 157.5, y: 9 }, 
    '9': { x: 167, y: 9 }, '8': { x: 176, y: 9 }, '7': { x: 192, y: 9 }, '6': { x: 201, y: 9 },
    '5': { x: 211, y: 9 }, '4': { x: 220, y: 9 }, '3': { x: 230, y: 9 }, '2': { x: 239, y: 9 },
    '1': { x: 249, y: 9 }, '0': { x: 258, y: 9 },
    'A0': { x: 208.5, y: 184.5 }, 'A1': { x: 218, y: 184.5 }, 'A2': { x: 227.5, y: 184.5 }, 'A3': { x: 237, y: 184.5 },
    'GND.1': { x: 119.5, y: 9 }, 'AREF': { x: 110, y: 9 },
    '5V': { x: 160.5, y: 184.5 }, 'GND.2': { x: 170, y: 184.5 }, 'GND.3': { x: 179.5, y: 184.5 },
  },
  'wokwi-servo': { 'GND': { x: 0, y: 50 }, 'V+': { x: 0, y: 59.5 }, 'PWM': { x: 0, y: 69 } },
};

// Approx element sizes (px). Used only for pin-to-center conversion.
const HALF_SIZE = {
  'wokwi-arduino-uno': { hw: 137, hh: 100.5 },
  'wokwi-led': { hw: 20, hh: 32.5 },
  'wokwi-ir-receiver': { hw: 30, hh: 50 },
  'wokwi-arduino-mega': { hw: 194, hh: 100 },
  'wokwi-servo': { hw: 50, hh: 50 },
};

function getPinXY(parts, partId, pinName) {
  const part = parts.find(p => p.id === partId);
  if (!part) return null;
  const local = PIN_LOCAL[part.type]?.[pinName];
  const half = HALF_SIZE[part.type];
  if (!local || !half) return null;
  // diagram.json uses part.left/top as component center coordinates (canvas-space)
  return { x: part.left + (local.x - half.hw), y: part.top + (local.y - half.hh) };
}

export function WireOverlay({ diagram }) {
  return (
    <svg
      style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '6000px', height: '6000px',
        overflow: 'visible', pointerEvents: 'none', zIndex: 0,
      }}
      viewBox="-3000 -3000 6000 6000"
    >
      {diagram.connections.map((conn, i) => {
        const [fromRef, toRef, color] = conn;
        const [fromId, fromPin] = fromRef.split(':');
        const [toId, toPin] = toRef.split(':');
        const p1 = getPinXY(diagram.parts, fromId, fromPin);
        const p2 = getPinXY(diagram.parts, toId, toPin);
        if (!p1 || !p2) return null;
        const mx = (p1.x + p2.x) / 2;
        const d = ['M', p1.x, p1.y, 'C', mx, p1.y, mx, p2.y, p2.x, p2.y].join(' ');
        return (
          <g key={i}>
            <path d={d} stroke={color} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.12} />
            <path d={d} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.9} />
            <circle cx={p1.x} cy={p1.y} r={3} fill={color} opacity={0.8} />
            <circle cx={p2.x} cy={p2.y} r={3} fill={color} opacity={0.8} />
          </g>
        );
      })}
    </svg>
  );
}

