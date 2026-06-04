// ??$$$ non-important
// ??$$$
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useProjectStore } from '../../store/useProjectStore';

// ??$$$ newer code
const ARDUINO_UNO_PINS = [
  { id: "RESET", x: -0.6, y: 0.1, z: 1.05 },
  { id: "3.3v", x: -0.4, y: 0.1, z: 1.05 },
  { id: "5v", x: -0.2, y: 0.1, z: 1.05 },
  { id: "gnd", x: 0.0, y: 0.1, z: 1.05 },
  { id: "gnd.2", x: 0.2, y: 0.1, z: 1.05 },
  { id: "vin", x: 0.4, y: 0.1, z: 1.05 },
  { id: "a0", x: 0.6, y: 0.1, z: 1.05 },
  { id: "a1", x: 0.75, y: 0.1, z: 1.05 },
  { id: "a2", x: 0.9, y: 0.1, z: 1.05 },
  { id: "a3", x: 1.05, y: 0.1, z: 1.05 },
  { id: "a4", x: 1.2, y: 0.1, z: 1.05 },
  { id: "a5", x: 1.35, y: 0.1, z: 1.05 },
  { id: "rx", x: 1.4, y: 0.1, z: -1.05 },
  { id: "tx", x: 1.25, y: 0.1, z: -1.05 },
  { id: "d2", x: 1.1, y: 0.1, z: -1.05 },
  { id: "d3", x: 0.95, y: 0.1, z: -1.05 },
  { id: "d4", x: 0.8, y: 0.1, z: -1.05 },
  { id: "d5", x: 0.65, y: 0.1, z: -1.05 },
  { id: "d6", x: 0.5, y: 0.1, z: -1.05 },
  { id: "d7", x: 0.35, y: 0.1, z: -1.05 },
  { id: "d8", x: 0.2, y: 0.1, z: -1.05 },
  { id: "d9", x: 0.05, y: 0.1, z: -1.05 },
  { id: "d10", x: -0.1, y: 0.1, z: -1.05 },
  { id: "d11", x: -0.25, y: 0.1, z: -1.05 },
  { id: "d12", x: -0.4, y: 0.1, z: -1.05 },
  { id: "d13", x: -0.55, y: 0.1, z: -1.05 },
  { id: "sda", x: -0.7, y: 0.1, z: -1.05 },
  { id: "scl", x: -0.85, y: 0.1, z: -1.05 }
];

interface WireProps {
  from: string;
  to: string;
  color: string;
}

export const Wire: React.FC<WireProps> = ({ from, to, color }) => {
  const { simulationRunning, ledState, buttonPressed, project } = useProjectStore();
  const pulseRef = useRef<THREE.Mesh>(null);

  const getAbsoluteCoordinates = (pinStr: string): [number, number, number] => {
    const [rawPartKey, rawPinId] = String(pinStr || '').split('.');
    const partKey = String(rawPartKey || '').trim();
    const pinId = String(rawPinId || '').trim();

    const bom = Array.isArray(project?.bom) ? project.bom : [];
    const part = bom.find((item: any) => String(item?.key || '').toLowerCase() === partKey.toLowerCase());
    /* old code
    if (part && Array.isArray(part.position)) {
      const base = part.position;
      const pin = Array.isArray(part.pins)
        ? part.pins.find((p: any) => {
            const pid = String(p?.id || '').toLowerCase();
            const pName = String(p?.name || '').toLowerCase();
            const target = pinId.toLowerCase();
            return pid === target || pName === target ||
                   pid.replace(/^gpio/, '') === target.replace(/^gpio/, '') ||
                   pName.replace(/^gpio/, '') === target.replace(/^gpio/, '');
          })
        : null;

      if (pin) {
        const dx = Number.isFinite(pin.x_mm) ? Number(pin.x_mm) * 0.1 : Number(pin.x ?? 0);
        const dy = Number.isFinite(pin.y_mm) ? Number(pin.y_mm) * 0.1 : Number(pin.y ?? 0);
        const dz = Number.isFinite(pin.z_mm) ? Number(pin.z_mm) * 0.1 : Number(pin.z ?? 0);
        return [
          Number(base[0] || 0) + dx,
          Number(base[1] || 0.1) + dy,
          Number(base[2] || 0) + dz
        ];
      }
    }
    const pinLower = pinId.toLowerCase();
    if (partKey.toLowerCase() === 'mcu' || partKey.toLowerCase() === 'arduino') {
      const knownPin = ARDUINO_UNO_PINS.find(p => p.id.toLowerCase() === pinLower);
      if (knownPin) {
        const mcuPart = bom.find(item => {
          const typeHint = `${item?.displayName} ${item?.purpose}`.toLowerCase();
          return item?.key === 'mcu' || /arduino|esp32|pico|teensy|controller|microcontroller/.test(typeHint);
        });
        const mcuPos = mcuPart?.position || [0, 0, 0];
        return [
          Number(mcuPos[0] || 0) + knownPin.x,
          Number(mcuPos[1] || 0.1) + knownPin.y,
          Number(mcuPos[2] || 0) + knownPin.z
        ];
      }
    }
    return [0, 0.1, 0];
    */

    // ??$$$ newer code
    const pinLower = pinId.toLowerCase();

    // 1. Check if it's the microcontroller (MCU)
    if (partKey.toLowerCase() === 'mcu' || partKey.toLowerCase() === 'arduino') {
      let normalizedSearch = pinLower;
      if (normalizedSearch.startsWith("gpio")) {
        normalizedSearch = normalizedSearch.substring(4);
      }
      const knownPin = ARDUINO_UNO_PINS.find(p => {
        const pid = p.id.toLowerCase();
        return pid === normalizedSearch || 
               pid === `d${normalizedSearch}` || 
               pid === `a${normalizedSearch}` ||
               (normalizedSearch === "gnd.2" && pid === "gnd") ||
               (normalizedSearch === "3v3" && pid === "3.3v");
      });

      if (knownPin) {
        /* old code
        const mcuPart = bom.find(item => {
          const typeHint = `${item?.displayName} ${item?.purpose}`.toLowerCase();
          return item?.key === 'mcu' || /arduino|esp32|pico|teensy|controller|microcontroller/.test(typeHint);
        });
        */
        // ??$$$ newer code
        const mcuPart = bom.find((item: any) => {
          const typeHint = `${item?.displayName} ${item?.purpose}`.toLowerCase();
          return item?.key === 'mcu' || /arduino|esp32|pico|teensy|controller|microcontroller/.test(typeHint);
        });
        const mcuPos = mcuPart?.position || [0, 0, 0];
        return [
          Number(mcuPos[0] || 0) + knownPin.x,
          Number(mcuPos[1] || 0.1) + knownPin.y,
          Number(mcuPos[2] || 0) + knownPin.z
        ];
      }
    }

    // 2. Check general BOM components
    if (part && Array.isArray(part.position)) {
      const base = part.position;
      const pin = Array.isArray(part.pins)
        ? part.pins.find((p: any) => {
            const pid = String(p?.id || '').toLowerCase();
            const pName = String(p?.name || '').toLowerCase();
            const target = pinId.toLowerCase();
            return pid === target || pName === target ||
                   pid.replace(/^gpio/, '') === target.replace(/^gpio/, '') ||
                   pName.replace(/^gpio/, '') === target.replace(/^gpio/, '');
          })
        : null;

      /* old code
      const activePin = pin || (Array.isArray(part.pins) && part.pins.length > 0 ? part.pins[0] : null);
      if (activePin) {
        const dx = Number.isFinite(activePin.x_mm) ? Number(activePin.x_mm) * 0.1 : Number(activePin.x ?? 0);
        const dy = Number.isFinite(activePin.y_mm) ? Number(activePin.y_mm) * 0.1 : Number(activePin.y ?? 0);
        const dz = Number.isFinite(activePin.z_mm) ? Number(activePin.z_mm) * 0.1 : Number(activePin.z ?? 0);
        return [
          Number(base[0] || 0) + dx,
          Number(base[1] || 0.1) + dy,
          Number(base[2] || 0) + dz
        ];
      }
      */
      // ??$$$ newer code
      const activePin: any = pin || (Array.isArray(part.pins) && part.pins.length > 0 ? part.pins[0] : null);
      if (activePin) {
        const dx = Number.isFinite(activePin.x_mm) ? Number(activePin.x_mm) * 0.1 : Number(activePin.x ?? 0);
        const dy = Number.isFinite(activePin.y_mm) ? Number(activePin.y_mm) * 0.1 : Number(activePin.y ?? 0);
        const dz = Number.isFinite(activePin.z_mm) ? Number(activePin.z_mm) * 0.1 : Number(activePin.z ?? 0);
        return [
          Number(base[0] || 0) + dx,
          Number(base[1] || 0.1) + dy,
          Number(base[2] || 0) + dz
        ];
      } else {
        // Fallback to component center coordinate
        return [
          Number(base[0] || 0),
          Number(base[1] || 0.1),
          Number(base[2] || 0)
        ];
      }
    }

    return [0, 0.1, 0];
  };

  const p1 = getAbsoluteCoordinates(from);
  const p2 = getAbsoluteCoordinates(to);

  // Generate wire arch spline
  const curve = useMemo(() => {
    const v1 = new THREE.Vector3(...p1);
    const v2 = new THREE.Vector3(...p2);
    
    // Create an arching curve going upwards
    const midY = Math.max(v1.y, v2.y) + 0.6;
    const ctrl1 = new THREE.Vector3(v1.x, midY, v1.z);
    const ctrl2 = new THREE.Vector3(v2.x, midY, v2.z);
    
    return new THREE.CatmullRomCurve3([v1, ctrl1, ctrl2, v2]);
  }, [p1, p2]);

  // Animate the electron flow pulse
  useFrame((state) => {
    if (!pulseRef.current || !simulationRunning) return;
    
    // Faster pulsing if current is flowing
    let activeSpeed = 0.8;
    if (from.includes('D7') && ledState) activeSpeed = 1.6;
    if (from.includes('button') && buttonPressed) activeSpeed = 1.6;

    const t = (state.clock.getElapsedTime() * activeSpeed) % 1.0;
    const pos = curve.getPointAt(t);
    pulseRef.current.position.copy(pos);
  });

  return (
    <group>
      {/* 3D Tube Wire Casing */}
      <mesh castShadow>
        <tubeGeometry args={[curve, 20, 0.03, 8, false]} />
        <meshStandardMaterial 
          color={color} 
          roughness={0.4} 
          metalness={0.1}
          emissive={simulationRunning && color !== '#000000' ? color : '#000000'}
          emissiveIntensity={simulationRunning ? 0.3 : 0}
        />
      </mesh>

      {/* Electron Pulse Dot (Visual current simulation) */}
      {simulationRunning && (
        <mesh ref={pulseRef}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      )}
    </group>
  );
};
