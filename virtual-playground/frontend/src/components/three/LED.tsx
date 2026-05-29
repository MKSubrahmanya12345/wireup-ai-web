// ??$$$
import React, { useRef } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { Html } from '@react-three/drei';

interface LEDProps {
  position: [number, number, number];
  componentKey?: string;
  displayName?: string;
}

export const LED: React.FC<LEDProps> = ({
  position,
  componentKey = 'led1',
  displayName = 'Red LED'
}) => {
  const { ledState, showLabels, selectedComponent, setSelectedComponent } = useProjectStore();
  const ledRef = useRef<any>(null);

  const isSelected = selectedComponent === componentKey;

  return (
    <group 
      position={position}
      ref={ledRef}
      onClick={(e) => {
        e.stopPropagation();
        setSelectedComponent(isSelected ? null : componentKey);
      }}
    >
      {/* Selection Ring */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.15, -0.15, 0]}>
          <ringGeometry args={[0.5, 0.6, 32]} />
          <meshBasicMaterial color="#00f0ff" side={2} transparent opacity={0.8} />
        </mesh>
      )}

      {/* Anode Leg (Long leg, left) */}
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.3, 8]} />
        <meshStandardMaterial color="#c0c0c0" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Cathode Leg (Short leg, right) */}
      <mesh position={[0.3, -0.05, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.26, 8]} />
        <meshStandardMaterial color="#c0c0c0" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Plastic Base/Rim (Slightly wider red ring) */}
      <mesh position={[0.15, 0.1, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.04, 16]} />
        <meshStandardMaterial 
          color="#ff0000" 
          transparent 
          opacity={0.7} 
          roughness={0.1}
        />
      </mesh>

      {/* LED Bulb Dome (Cylinder + Sphere top) */}
      <mesh position={[0.15, 0.22, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.2, 16]} />
        <meshStandardMaterial 
          color={ledState ? "#ff3333" : "#800000"} 
          emissive={ledState ? "#ff0000" : "#200000"}
          emissiveIntensity={ledState ? 2.5 : 0.2}
          transparent 
          opacity={0.85} 
          roughness={0.05}
        />
      </mesh>
      <mesh position={[0.15, 0.32, 0]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial 
          color={ledState ? "#ff3333" : "#800000"} 
          emissive={ledState ? "#ff0000" : "#200000"}
          emissiveIntensity={ledState ? 2.5 : 0.2}
          transparent 
          opacity={0.85} 
          roughness={0.05}
        />
      </mesh>

      {/* Interactive Terminal Pins */}
      {/* Anode Pin (A) */}
      <mesh position={[0, 0.1, 0]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshBasicMaterial color="#ff0000" />
      </mesh>

      {/* Cathode Pin (C) */}
      <mesh position={[0.3, 0.1, 0]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* Dynamic Lighting Emission */}
      {ledState && (
        <>
          <pointLight 
            position={[0.15, 0.35, 0]} 
            color="#ff0000" 
            intensity={1.8} 
            distance={8} 
            castShadow
          />
          {/* Subtle Glow Ring */}
          <mesh position={[0.15, 0.32, 0]} scale={[1.2, 1.2, 1.2]}>
            <sphereGeometry args={[0.18, 8, 8]} />
            <meshBasicMaterial color="#ff0000" transparent opacity={0.15} wireframe />
          </mesh>
        </>
      )}

      {/* Interactive Labels */}
      {showLabels && (
        <Html distanceFactor={8} position={[0.15, 0.6, 0]} center>
          <div className="flex flex-col items-center space-y-0.5 pointer-events-none">
            <span className="bg-[#1a0505]/95 border border-red-500/50 px-2 py-0.5 rounded text-[#ff6666] text-[9px] font-mono whitespace-nowrap shadow-cyber uppercase font-bold">
              {displayName}
            </span>
            <span className="text-[7px] text-slate-400 font-mono">
              {ledState ? 'STATUS: ON' : 'STATUS: OFF'}
            </span>
          </div>
        </Html>
      )}
    </group>
  );
};
