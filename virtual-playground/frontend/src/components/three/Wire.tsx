// ??$$$
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useProjectStore } from '../../store/useProjectStore';

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

      const px = Number(base[0] || 0) + Number(pin?.x_mm ?? pin?.x ?? 0) * 0.1;
      const py = Number(base[1] || 0.1) + Number(pin?.y_mm ?? pin?.y ?? 0) * 0.1;
      const pz = Number(base[2] || 0) + Number(pin?.z_mm ?? pin?.z ?? 0) * 0.1;
      return [px, py, pz];
    }

    // Legacy fallback map for older hardcoded payloads.
    // ??$$$ commented old code
    /*
    switch (pinStr) {
      case 'arduino.5V':
      case 'mcu.5V':
        return [-1.2, 0.15, 0.4];
      case 'arduino.GND':
      case 'mcu.GND':
        return [-1.2, 0.15, 0.8];
      case 'arduino.D7':
      case 'mcu.D7':
        return [1.2, 0.15, -0.4];
      case 'arduino.D2':
      case 'mcu.D2':
        return [1.2, 0.15, -0.8];
      default:
        return [0, 0, 0];
    }
    */
    const pinLower = pinId.toLowerCase();
    if (partKey.toLowerCase() === 'mcu' || partKey.toLowerCase() === 'arduino') {
      if (pinLower === '5v' || pinLower === 'vcc') return [Number(part?.position?.[0] || 0) - 1.2, 0.15, Number(part?.position?.[2] || 0) + 0.4];
      if (pinLower === 'gnd') return [Number(part?.position?.[0] || 0) - 1.2, 0.15, Number(part?.position?.[2] || 0) + 0.8];
      if (pinLower === 'd7' || pinLower === 'gpio13' || pinLower === '13') return [Number(part?.position?.[0] || 0) + 1.2, 0.15, Number(part?.position?.[2] || 0) - 0.4];
      if (pinLower === 'd2' || pinLower === 'gpio4' || pinLower === '4') return [Number(part?.position?.[0] || 0) + 1.2, 0.15, Number(part?.position?.[2] || 0) - 0.8];
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
