// @ts-nocheck
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Move, Trash2 } from 'lucide-react';
import { useTransformEffect } from 'react-zoom-pan-pinch';
import { WireOverlay } from './WireOverlay';

// pinInfo.x/y from @wokwi/elements source (local pixel position within component div)
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

function DraggablePart({ part, live, wiringFrom, onDragEnd, onDelete, onPinClick }) {
  const scaleRef = useRef(1);
  useTransformEffect(({ state }) => { scaleRef.current = state.scale; });

  const dragging = useRef(false);
  const startMouse = useRef({ x: 0, y: 0 });
  const startPos = useRef({ top: 0, left: 0 });
  const [pos, setPos] = useState({ top: part.top, left: part.left });
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => { setPos({ top: part.top, left: part.left }); }, [part.top, part.left]);

  const onMouseDown = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    dragging.current = true;
    startMouse.current = { x: e.clientX, y: e.clientY };
    startPos.current = { top: pos.top, left: pos.left };
    setIsDragging(true);

    const onMouseMove = (me) => {
      if (!dragging.current) return;
      const s = scaleRef.current;
      setPos({
        top: startPos.current.top + (me.clientY - startMouse.current.y) / s,
        left: startPos.current.left + (me.clientX - startMouse.current.x) / s,
      });
    };

    const onMouseUp = (me) => {
      dragging.current = false;
      setIsDragging(false);
      const s = scaleRef.current;
      const finalTop = startPos.current.top + (me.clientY - startMouse.current.y) / s;
      const finalLeft = startPos.current.left + (me.clientX - startMouse.current.x) / s;
      setPos({ top: finalTop, left: finalLeft });
      onDragEnd(part.id, finalTop, finalLeft);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [pos.top, pos.left, onDragEnd, part.id]);

  const localPins = PIN_LOCAL[part.type] ?? {};
  const liveValue = live.value;
  const isLedOn = part.type === 'wokwi-led' && Boolean(liveValue);
  const color = typeof part.attrs?.color === 'string' ? part.attrs.color : '';
  const glowColor = color === 'red' ? 'rgba(239,68,68,0.35)' : 'rgba(59,130,246,0.4)';
  const showPinDots = Object.keys(localPins).length > 0;
  const isWiring = wiringFrom !== null;

  const wrapStyle = {
    position: 'absolute',
    top: '50%', left: '50%',
    transform: 'translate(calc(-50% + ' + pos.left + 'px), calc(-50% + ' + pos.top + 'px))',
    cursor: isDragging ? 'grabbing' : 'grab',
    userSelect: 'none',
    transition: isDragging ? 'none' : 'transform 0.05s ease-out',
    zIndex: isDragging ? 100 : 2,
  };

  return (
    <div style={wrapStyle} className="drop-shadow-2xl group" onMouseDown={onMouseDown}>
      <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-50 hidden group-hover:flex items-center gap-1.5 rounded-full bg-neutral-800/95 border border-neutral-700 px-2 py-0.5 text-[10px] text-neutral-400 whitespace-nowrap backdrop-blur-sm pointer-events-none select-none">
        <Move className="h-2.5 w-2.5" />
        {part.id}
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onDelete(part.id); }}
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute -top-2 -right-2 z-50 hidden group-hover:flex items-center justify-center h-5 w-5 rounded-full bg-red-500/90 hover:bg-red-500 border border-red-400/30 text-white transition-all shadow-lg"
      >
        <Trash2 className="h-2.5 w-2.5" />
      </button>

      {React.createElement(part.type, { ...part.attrs, ...live })}

      {isLedOn && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full blur-xl animate-pulse pointer-events-none" style={{ backgroundColor: glowColor }} />
      )}

      {isDragging && <div className="absolute inset-0 rounded-lg ring-2 ring-indigo-500/60 pointer-events-none" />}

      {showPinDots && (
        <div className={isWiring ? 'block' : 'hidden group-hover:block'}>
          {Object.entries(localPins).map(([pinName, pinPos]) => {
            const isSource = wiringFrom?.partId === part.id && wiringFrom?.pin === pinName;
            const dotStyle = {
              position: 'absolute',
              left: pinPos.x - 5,
              top: pinPos.y - 5,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: isSource ? '#a78bfa' : '#6366f1',
              border: '2px solid rgba(255,255,255,0.6)',
              cursor: 'crosshair',
              zIndex: 60,
              boxShadow: isSource ? '0 0 8px #a78bfa' : '0 0 4px rgba(99,102,241,0.6)',
            };
            return (
              <div
                key={pinName}
                style={dotStyle}
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  onPinClick(part.id, pinName, rect.left + rect.width / 2, rect.top + rect.height / 2);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                title={part.id + ':' + pinName}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SimCanvas({ diagram, partStates, wiringFrom, onDragEnd, onDelete, onPinClick }) {
  return (
    <div className="relative w-full h-full">
      <WireOverlay diagram={diagram} />
      {diagram.parts.map(part => (
        <DraggablePart
          key={part.id}
          part={part}
          live={partStates[part.id] ?? {}}
          wiringFrom={wiringFrom}
          onDragEnd={onDragEnd}
          onDelete={onDelete}
          onPinClick={onPinClick}
        />
      ))}
    </div>
  );
}

