// ??$$$ group 5 - Circuit Simulation (Phase 4)
// @ts-nocheck
import React from 'react';

export function WirePreview({ fromX, fromY, toX, toY, color }) {
  const mx = (fromX + toX) / 2;
  const d = ['M', fromX, fromY, 'C', mx, fromY, mx, toY, toX, toY].join(' ');
  return (
    <svg style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 999 }}>
      <path d={d} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeDasharray="7 4" opacity={0.85} />
      <circle cx={fromX} cy={fromY} r={4} fill={color} opacity={0.9} />
    </svg>
  );
}

