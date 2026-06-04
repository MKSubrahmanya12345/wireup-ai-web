// ??$$$ group 3 - 3D Rendering (Phase 2)
// ??$$$ newer code - LCD 16x2 visual representation in 3D Canvas
import React, { useRef } from 'react';
import { Html } from '@react-three/drei';
import { useProjectStore } from '../../store/useProjectStore';

interface LCD16x2Props {
  position: [number, number, number];
  componentKey?: string;
  displayName?: string;
  textLine1?: string;
  textLine2?: string;
  backlight?: boolean;
}

export const LCD16x2: React.FC<LCD16x2Props> = ({
  position,
  componentKey = 'lcd1602',
  displayName = 'LCD 16x2',
  textLine1 = '',
  textLine2 = '',
  backlight = true
}) => {
  const { showLabels, selectedComponent, setSelectedComponent } = useProjectStore();
  const isSelected = selectedComponent === componentKey;
  const groupRef = useRef<any>(null);

  return (
    <group
      position={position}
      ref={groupRef}
      onClick={(e) => {
        e.stopPropagation();
        setSelectedComponent(isSelected ? null : componentKey);
      }}
    >
      {/* Selection Ring */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.15, 0]}>
          <ringGeometry args={[1.1, 1.2, 32]} />
          <meshBasicMaterial color="#00f0ff" side={2} transparent opacity={0.8} />
        </mesh>
      )}

      {/* PCB Base Board */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2.0, 0.08, 1.0]} />
        <meshStandardMaterial color="#065f46" roughness={0.8} />
      </mesh>

      {/* Screen Plastic Frame */}
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[1.7, 0.06, 0.7]} />
        <meshStandardMaterial color="#000000" roughness={0.5} />
      </mesh>

      {/* Screen Liquid Crystal Panel */}
      <mesh position={[0, 0.085, 0]}>
        <boxGeometry args={[1.5, 0.02, 0.5]} />
        <meshStandardMaterial
          color={backlight ? "#22c55e" : "#14532d"}
          emissive={backlight ? "#22c55e" : "#000000"}
          emissiveIntensity={0.6}
          roughness={0.1}
        />
      </mesh>

      {/* Pins header row at the top edge */}
      <mesh position={[0, 0.05, -0.42]}>
        <boxGeometry args={[1.6, 0.02, 0.06]} />
        <meshStandardMaterial color="#374151" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* HTML text representation on top of the mesh screen */}
      <Html
        transform
        distanceFactor={2.4}
        position={[0, 0.1, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        pointerEvents="none"
      >
        <div 
          className="select-none flex flex-col font-mono p-1 rounded-sm overflow-hidden"
          style={{
            color: '#022c22',
            fontSize: '9px',
            width: '124px',
            height: '42px',
            lineHeight: '1.3',
            letterSpacing: '1px',
            backgroundColor: 'transparent',
            textShadow: '0 0 1px rgba(2, 44, 34, 0.3)'
          }}
        >
          <div className="whitespace-pre">{(textLine1 || "").padEnd(16, '\u00A0')}</div>
          <div className="whitespace-pre">{(textLine2 || "").padEnd(16, '\u00A0')}</div>
        </div>
      </Html>

      {/* Floating Name Label */}
      {showLabels && (
        <Html distanceFactor={8} position={[0, 0.6, 0]} center>
          <div className="flex flex-col items-center space-y-0.5 pointer-events-none">
            <span className="bg-[#051a0e]/95 border border-emerald-500/50 px-2 py-0.5 rounded text-[#66ff99] text-[9px] font-mono whitespace-nowrap shadow-cyber uppercase font-bold">
              {displayName}
            </span>
            <span className="text-[7px] text-slate-400 font-mono">
              {backlight ? 'SCREEN: ACTIVE' : 'SCREEN: STANDBY'}
            </span>
          </div>
        </Html>
      )}
    </group>
  );
};
