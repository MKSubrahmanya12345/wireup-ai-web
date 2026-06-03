// ??$$$ non-important
// ??$$$
import React, { useRef, useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { Html } from '@react-three/drei';

interface ButtonProps {
  position: [number, number, number];
  componentKey?: string;
  displayName?: string;
}

export const Button: React.FC<ButtonProps> = ({
  position,
  componentKey = 'button1',
  displayName = 'Push Button'
}) => {
  const { buttonPressed, setButtonPressed, showLabels, selectedComponent, setSelectedComponent } = useProjectStore();
  const [hovered, setHovered] = useState(false);
  const buttonRef = useRef<any>(null);

  const isSelected = selectedComponent === componentKey;

  // Tactile animation - push down the cap when pressed
  const capY = buttonPressed ? 0.08 : 0.14;

  return (
    <group 
      position={position}
      ref={buttonRef}
      onClick={(e) => {
        e.stopPropagation();
        setSelectedComponent(isSelected ? null : componentKey);
      }}
    >
      {/* Selection Ring */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.15, -0.1, 0]}>
          <ringGeometry args={[0.5, 0.6, 32]} />
          <meshBasicMaterial color="#00f0ff" side={2} transparent opacity={0.8} />
        </mesh>
      )}

      {/* Button Legs (4 metal corners) */}
      <mesh position={[0, -0.05, -0.15]}>
        <cylinderGeometry args={[0.02, 0.02, 0.2, 8]} />
        <meshStandardMaterial color="#d0d0d0" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, -0.05, 0.15]}>
        <cylinderGeometry args={[0.02, 0.02, 0.2, 8]} />
        <meshStandardMaterial color="#d0d0d0" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0.3, -0.05, -0.15]}>
        <cylinderGeometry args={[0.02, 0.02, 0.2, 8]} />
        <meshStandardMaterial color="#d0d0d0" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0.3, -0.05, 0.15]}>
        <cylinderGeometry args={[0.02, 0.02, 0.2, 8]} />
        <meshStandardMaterial color="#d0d0d0" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Main Base Housing Casing */}
      <mesh castShadow position={[0.15, 0.03, 0]}>
        <boxGeometry args={[0.5, 0.12, 0.5]} />
        <meshStandardMaterial color="#222222" roughness={0.6} />
      </mesh>

      {/* Metal Shield Cover Trim */}
      <mesh position={[0.15, 0.095, 0]}>
        <boxGeometry args={[0.48, 0.02, 0.48]} />
        <meshStandardMaterial color="#b0b0b0" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Clickable Plunger Button Cap (Spring Loaded) */}
      <mesh 
        castShadow
        position={[0.15, capY, 0]}
        onPointerDown={(e) => {
          e.stopPropagation();
          setButtonPressed(true);
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          setButtonPressed(false);
        }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => {
          setHovered(false);
          if (buttonPressed) setButtonPressed(false);
        }}
      >
        <cylinderGeometry args={[0.14, 0.14, 0.09, 16]} />
        <meshStandardMaterial 
          color={buttonPressed ? "#d32f2f" : hovered ? "#ff5252" : "#b71c1c"} 
          roughness={0.4}
        />
      </mesh>

      {/* Contact Terminal Pins */}
      {/* Pin 1 */}
      <mesh position={[0, 0.05, 0]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshBasicMaterial color="#00ffcc" />
      </mesh>

      {/* Pin 2 */}
      <mesh position={[0.3, 0.05, 0]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshBasicMaterial color="#94a3b8" />
      </mesh>

      {/* Button State Ring Indicator (Glows when active) */}
      {buttonPressed && (
        <mesh position={[0.15, capY, 0]} scale={[1.3, 1.3, 1.3]}>
          <cylinderGeometry args={[0.15, 0.15, 0.1, 16]} />
          <meshBasicMaterial color="#00f0ff" transparent opacity={0.2} wireframe />
        </mesh>
      )}

      {/* Hover/State Labels */}
      {showLabels && (
        <Html distanceFactor={8} position={[0.15, 0.5, 0]} center>
          <div className="flex flex-col items-center space-y-0.5 pointer-events-none">
            <span className="bg-[#051c14]/95 border border-[#00ffcc]/50 px-2 py-0.5 rounded text-[#00ffcc] text-[9px] font-mono whitespace-nowrap shadow-cyber uppercase font-bold">
              {displayName}
            </span>
            <span className="text-[7px] text-slate-400 font-mono">
              {buttonPressed ? 'STATE: CLOSED (HIGH)' : 'STATE: OPEN (LOW)'}
            </span>
          </div>
        </Html>
      )}
    </group>
  );
};
