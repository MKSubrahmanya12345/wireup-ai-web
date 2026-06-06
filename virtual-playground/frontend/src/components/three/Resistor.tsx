// ??$$$ newer code — Resistor 3D component for virtual playground
import React, { useRef } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { Html } from '@react-three/drei';

interface ResistorProps {
  position: [number, number, number];
  componentKey?: string;
  displayName?: string;
}

export const Resistor: React.FC<ResistorProps> = ({
  position,
  componentKey = 'resistor1',
  displayName = 'Resistor'
}) => {
  const { showLabels, selectedComponent, setSelectedComponent } = useProjectStore();
  const groupRef = useRef<any>(null);
  const isSelected = selectedComponent === componentKey;

  return (
    <group
      position={position}
      ref={groupRef}
      rotation={[0, 0, Math.PI / 2]} // lay horizontal
      onClick={(e) => {
        e.stopPropagation();
        setSelectedComponent(isSelected ? null : componentKey);
      }}
    >
      {/* Selection Ring */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]}>
          <ringGeometry args={[0.45, 0.55, 32]} />
          <meshBasicMaterial color="#00f0ff" side={2} transparent opacity={0.8} />
        </mesh>
      )}

      {/* Left Lead Wire */}
      <mesh position={[-0.42, 0, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.36, 8]} rotation={[0, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#c0c0c0" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Right Lead Wire */}
      <mesh position={[0.42, 0, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.36, 8]} rotation={[0, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#c0c0c0" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Body — tan/beige carbon film cylinder */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.09, 0.09, 0.42, 16]} rotation={[0, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#d2b48c" roughness={0.7} metalness={0.05} />
      </mesh>

      {/* Band 1 — Red (2) */}
      <mesh position={[-0.14, 0, 0]}>
        <cylinderGeometry args={[0.092, 0.092, 0.04, 16]} rotation={[0, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#cc0000" roughness={0.5} />
      </mesh>

      {/* Band 2 — Red (2) */}
      <mesh position={[-0.05, 0, 0]}>
        <cylinderGeometry args={[0.092, 0.092, 0.04, 16]} rotation={[0, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#cc0000" roughness={0.5} />
      </mesh>

      {/* Band 3 — Brown (×10 multiplier) */}
      <mesh position={[0.06, 0, 0]}>
        <cylinderGeometry args={[0.092, 0.092, 0.04, 16]} rotation={[0, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#8b4513" roughness={0.5} />
      </mesh>

      {/* Band 4 — Gold (5% tolerance) */}
      <mesh position={[0.16, 0, 0]}>
        <cylinderGeometry args={[0.092, 0.092, 0.035, 16]} rotation={[0, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#ffd700" roughness={0.3} metalness={0.6} />
      </mesh>

      {/* Label */}
      {showLabels && (
        <Html distanceFactor={8} position={[0, 0.4, 0]} center>
          <div className="flex flex-col items-center space-y-0.5 pointer-events-none">
            <span className="bg-[#1a1205]/95 border border-yellow-500/40 px-2 py-0.5 rounded text-yellow-300 text-[9px] font-mono whitespace-nowrap uppercase font-bold">
              {displayName}
            </span>
            <span className="text-[7px] text-slate-400 font-mono">220Ω</span>
          </div>
        </Html>
      )}
    </group>
  );
};
