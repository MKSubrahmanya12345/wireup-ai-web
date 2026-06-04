// ??$$$ non-important
// ??$$$
import React, { useRef, useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { Html } from '@react-three/drei';

interface ArduinoProps {
  position: [number, number, number];
  componentKey?: string;
  displayName?: string;
}

export const Arduino: React.FC<ArduinoProps> = ({
  position,
  componentKey = 'arduino',
  displayName = 'Arduino Uno'
}) => {
  const { showLabels, selectedComponent, setSelectedComponent, simulationRunning } = useProjectStore();
  const [hoveredPin, setHoveredPin] = useState<string | null>(null);
  const meshRef = useRef<any>(null);

  /* old code
  const pins = [
    { id: "5V", pos: [-1.2, 0.1, 0.4], label: "5V Power", type: "power" },
    { id: "GND", pos: [-1.2, 0.1, 0.8], label: "Ground", type: "gnd" },
    { id: "D7", pos: [1.2, 0.1, -0.4], label: "Digital Out D7", type: "digital" },
    { id: "D2", pos: [1.2, 0.1, -0.8], label: "Digital In D2", type: "digital" }
  ];
  */

  // ??$$$ newer code
  const pins = [
    { id: "RESET", pos: [-0.6, 0.1, 1.05], label: "Reset", type: "system" },
    { id: "3.3V", pos: [-0.4, 0.1, 1.05], label: "3.3V Power", type: "power" },
    { id: "5V", pos: [-0.2, 0.1, 1.05], label: "5V Power", type: "power" },
    { id: "GND", pos: [0.0, 0.1, 1.05], label: "Ground", type: "gnd" },
    { id: "GND.2", pos: [0.2, 0.1, 1.05], label: "Ground", type: "gnd" },
    { id: "VIN", pos: [0.4, 0.1, 1.05], label: "VIN Power", type: "power" },
    { id: "A0", pos: [0.6, 0.1, 1.05], label: "Analog A0", type: "analog" },
    { id: "A1", pos: [0.75, 0.1, 1.05], label: "Analog A1", type: "analog" },
    { id: "A2", pos: [0.9, 0.1, 1.05], label: "Analog A2", type: "analog" },
    { id: "A3", pos: [1.05, 0.1, 1.05], label: "Analog A3", type: "analog" },
    { id: "A4", pos: [1.2, 0.1, 1.05], label: "Analog A4 / SDA", type: "analog" },
    { id: "A5", pos: [1.35, 0.1, 1.05], label: "Analog A5 / SCL", type: "analog" },
    
    { id: "RX", pos: [1.4, 0.1, -1.05], label: "Serial RX D0", type: "serial" },
    { id: "TX", pos: [1.25, 0.1, -1.05], label: "Serial TX D1", type: "serial" },
    { id: "D2", pos: [1.1, 0.1, -1.05], label: "Digital D2", type: "digital" },
    { id: "D3", pos: [0.95, 0.1, -1.05], label: "Digital D3", type: "digital" },
    { id: "D4", pos: [0.8, 0.1, -1.05], label: "Digital D4", type: "digital" },
    { id: "D5", pos: [0.65, 0.1, -1.05], label: "Digital D5", type: "digital" },
    { id: "D6", pos: [0.5, 0.1, -1.05], label: "Digital D6", type: "digital" },
    { id: "D7", pos: [0.35, 0.1, -1.05], label: "Digital D7", type: "digital" },
    { id: "D8", pos: [0.2, 0.1, -1.05], label: "Digital D8", type: "digital" },
    { id: "D9", pos: [0.05, 0.1, -1.05], label: "Digital D9", type: "digital" },
    { id: "D10", pos: [-0.1, 0.1, -1.05], label: "Digital D10", type: "digital" },
    { id: "D11", pos: [-0.25, 0.1, -1.05], label: "Digital D11", type: "digital" },
    { id: "D12", pos: [-0.4, 0.1, -1.05], label: "Digital D12", type: "digital" },
    { id: "D13", pos: [-0.55, 0.1, -1.05], label: "Digital D13 / Built-in LED", type: "digital" },
    { id: "SDA", pos: [-0.7, 0.1, -1.05], label: "I2C SDA", type: "i2c" },
    { id: "SCL", pos: [-0.85, 0.1, -1.05], label: "I2C SCL", type: "i2c" }
  ];

  const isSelected = selectedComponent === componentKey;

  return (
    <group 
      position={position} 
      ref={meshRef}
      onClick={(e) => {
        e.stopPropagation();
        setSelectedComponent(isSelected ? null : componentKey);
      }}
    >
      {/* Selection Ring */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
          <ringGeometry args={[1.7, 1.8, 32]} />
          <meshBasicMaterial color="#00f0ff" side={2} transparent opacity={0.8} />
        </mesh>
      )}

      {/* Main PCB Board */}
      <mesh castShadow receiveShadow position={[0, 0.04, 0]}>
        <boxGeometry args={[3.2, 0.08, 2.4]} />
        <meshStandardMaterial color="#0b2b5c" roughness={0.6} metalness={0.2} />
      </mesh>

      {/* MicroUSB Port */}
      <mesh castShadow position={[-1.2, 0.15, -0.8]}>
        <boxGeometry args={[0.8, 0.25, 0.6]} />
        <meshStandardMaterial color="#c0c0c0" roughness={0.3} metalness={0.9} />
      </mesh>

      {/* Power Jack */}
      <mesh castShadow position={[-1.2, 0.2, 0.6]}>
        <boxGeometry args={[1.0, 0.35, 0.7]} />
        <meshStandardMaterial color="#111111" roughness={0.7} />
      </mesh>

      {/* Main Microcontroller IC (ATmega328P) */}
      <mesh castShadow position={[0.2, 0.1, 0.2]} rotation={[0, 0.05, 0]}>
        <boxGeometry args={[1.4, 0.12, 0.35]} />
        <meshStandardMaterial color="#1e1e1e" roughness={0.5} />
      </mesh>

      {/* Header Rails (Top & Bottom) */}
      {/* Top Header Rail */}
      <mesh position={[0.4, 0.1, -1.05]}>
        <boxGeometry args={[2.0, 0.15, 0.15]} />
        <meshStandardMaterial color="#111111" roughness={0.8} />
      </mesh>
      {/* Bottom Header Rail */}
      <mesh position={[0.4, 0.1, 1.05]}>
        <boxGeometry args={[2.0, 0.15, 0.15]} />
        <meshStandardMaterial color="#111111" roughness={0.8} />
      </mesh>

      {/* Status LED */}
      <mesh position={[-0.4, 0.1, -0.6]}>
        <boxGeometry args={[0.08, 0.06, 0.08]} />
        <meshBasicMaterial color={simulationRunning ? "#10b981" : "#374151"} />
      </mesh>
      {simulationRunning && (
        <pointLight position={[-0.4, 0.2, -0.6]} color="#10b981" intensity={0.4} distance={2} />
      )}

      {/* Power Indicator LED */}
      <mesh position={[-1.3, 0.1, 0.1]}>
        <boxGeometry args={[0.08, 0.06, 0.08]} />
        <meshBasicMaterial color={simulationRunning ? "#ef4444" : "#374151"} />
      </mesh>
      {simulationRunning && (
        <pointLight position={[-1.3, 0.2, 0.1]} color="#ef4444" intensity={0.4} distance={2} />
      )}

      {/* Pins and Interactive Connectors */}
      {pins.map((pin) => (
        <group key={pin.id} position={pin.pos as [number, number, number]}>
          <mesh 
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredPin(pin.id);
            }}
            onPointerOut={() => setHoveredPin(null)}
          >
            <cylinderGeometry args={[0.08, 0.08, 0.15, 8]} />
            <meshStandardMaterial 
              color={hoveredPin === pin.id ? "#00f0ff" : "#8c8c9e"} 
              roughness={0.2}
              metalness={0.8}
            />
          </mesh>

          {/* Glowing Pin Tip if Simulator is ON */}
          {simulationRunning && (
            <mesh position={[0, 0.1, 0]}>
              <sphereGeometry args={[0.04, 8, 8]} />
              <meshBasicMaterial color={pin.type === 'power' ? '#ef4444' : pin.type === 'gnd' ? '#555555' : '#00f0ff'} />
            </mesh>
          )}

          {/* HTML Pin Overlays */}
          {(showLabels || hoveredPin === pin.id) && (
            <Html distanceFactor={8} position={[0, 0.3, 0]} center>
              <div className="bg-[#050512]/90 border border-cyan-500/40 text-cyan-300 text-[8px] font-mono px-1 py-0.5 rounded whitespace-nowrap pointer-events-none uppercase shadow-cyber">
                {pin.id}
              </div>
            </Html>
          )}
        </group>
      ))}

      {/* Component Name Plate Tag */}
      {showLabels && (
        <Html distanceFactor={10} position={[0, 0.6, 0]} center>
          <div className="bg-[#0b0b24]/85 border border-[#1f1f45] px-2 py-0.5 rounded text-white text-[9px] font-mono whitespace-nowrap shadow-md uppercase">
            {displayName}
          </div>
        </Html>
      )}
    </group>
  );
};
