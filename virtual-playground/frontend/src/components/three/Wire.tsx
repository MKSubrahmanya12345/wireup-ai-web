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
  const { simulationRunning, ledState, buttonPressed } = useProjectStore();
  const pulseRef = useRef<THREE.Mesh>(null);

  // Absolute positions of pins based on hardcoded project specs
  const getAbsoluteCoordinates = (pinStr: string): [number, number, number] => {
    switch (pinStr) {
      case 'arduino.5V': return [-1.2, 0.15, 0.4];
      case 'arduino.GND': return [-1.2, 0.15, 0.8];
      case 'arduino.D7': return [1.2, 0.15, -0.4];
      case 'arduino.D2': return [1.2, 0.15, -0.8];
      
      case 'led1.A': return [2.5, 0.3, 0.5]; // Absolute: pos [2.5, 0.2, 0.5] + pin [0, 0.1, 0]
      case 'led1.C': return [2.8, 0.3, 0.5]; // Absolute: pos [2.5, 0.2, 0.5] + pin [0.3, 0.1, 0]
      
      case 'button1.1': return [-2.5, 0.2, -0.5]; // Absolute: pos [-2.5, 0.15, -0.5] + pin [0, 0.05, 0]
      case 'button1.2': return [-2.2, 0.2, -0.5]; // Absolute: pos [-2.5, 0.15, -0.5] + pin [0.3, 0.05, 0]
      
      default: return [0, 0, 0];
    }
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
