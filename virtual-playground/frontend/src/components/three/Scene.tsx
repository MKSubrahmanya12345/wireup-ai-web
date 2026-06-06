// ??$$$ non-important
// ??$$$
import React, { Suspense, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Html, useGLTF } from '@react-three/drei';
import { useProjectStore } from '../../store/useProjectStore';
import { Arduino } from './Arduino';
import { LED } from './LED';
import { Button } from './Button';
// ??$$$ newer code
import { LCD16x2 } from './LCD16x2';
import { Wire } from './Wire';
import { WebGLErrorBoundary } from './ErrorBoundary';
import { SchematicView } from './SchematicView';

const GenericPart: React.FC<{
  position: [number, number, number];
  rotation?: [number, number, number];
  componentKey: string;
  displayName: string;
  type: string;
  glbUrl?: string;
}> = ({ position, rotation = [0, 0, 0], componentKey, displayName, type, glbUrl }) => {
  const { showLabels, selectedComponent, setSelectedComponent } = useProjectStore();
  const isSelected = selectedComponent === componentKey;
  const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '').replace(/\/$/, '');
  const resolvedModelUrl = useMemo(() => {
    if (!glbUrl) return '';
    if (/^https?:\/\//i.test(glbUrl)) return glbUrl;
    if (glbUrl.startsWith('/')) return `${apiBase}${glbUrl}`;
    return `${apiBase}/${glbUrl}`;
  }, [apiBase, glbUrl]);

  /* old code
  const shapeColor = type === 'sensor'
    ? '#0f766e'
    : type === 'display'
      ? '#7c3aed'
      : type === 'module'
        ? '#475569'
        : '#1d4ed8';
  */
  // ??$$$ newer code
  const shapeColor = type === 'sensor'
    ? '#0f766e'
    : type === 'display'
      ? '#7c3aed'
      : type === 'module'
        ? '#475569'
        : type === 'motor' || type === 'servo'
          ? '#b45309'
          : '#1d4ed8';

  return (
    <group
      position={position}
      rotation={rotation}
      onClick={(e) => {
        e.stopPropagation();
        setSelectedComponent(isSelected ? null : componentKey);
      }}
    >
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]}>
          <ringGeometry args={[0.75, 0.9, 32]} />
          <meshBasicMaterial color="#00f0ff" side={2} transparent opacity={0.8} />
        </mesh>
      )}

      {resolvedModelUrl ? (
        <ResolvedModel url={resolvedModelUrl} />
      ) : (
        <mesh castShadow receiveShadow position={[0, 0.14, 0]}>
          {type === 'led' ? <sphereGeometry args={[0.28, 24, 24]} /> : type === 'button' ? <cylinderGeometry args={[0.32, 0.34, 0.22, 18]} /> : <boxGeometry args={[0.85, 0.26, 0.6]} />}
          <meshStandardMaterial color={shapeColor} roughness={0.45} metalness={0.25} emissive={type === 'led' ? '#111111' : '#000000'} emissiveIntensity={0.15} />
        </mesh>
      )}

      <mesh position={[-0.25, 0.02, -0.18]}>
        <cylinderGeometry args={[0.02, 0.02, 0.22, 8]} />
        <meshStandardMaterial color="#d1d5db" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0.25, 0.02, -0.18]}>
        <cylinderGeometry args={[0.02, 0.02, 0.22, 8]} />
        <meshStandardMaterial color="#d1d5db" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[-0.25, 0.02, 0.18]}>
        <cylinderGeometry args={[0.02, 0.02, 0.22, 8]} />
        <meshStandardMaterial color="#d1d5db" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0.25, 0.02, 0.18]}>
        <cylinderGeometry args={[0.02, 0.02, 0.22, 8]} />
        <meshStandardMaterial color="#d1d5db" metalness={0.8} roughness={0.3} />
      </mesh>

      {glbUrl && (
        <Html distanceFactor={8} position={[0, 0.55, 0]} center>
          <div className="bg-slate-900/90 border border-slate-600 text-slate-200 text-[8px] font-mono px-2 py-0.5 rounded whitespace-nowrap">
            GLB loaded from backend
          </div>
        </Html>
      )}

      {showLabels && (
        <Html distanceFactor={10} position={[0, 0.75, 0]} center>
          <div className="bg-[#0b0b24]/85 border border-[#1f1f45] px-2 py-0.5 rounded text-white text-[9px] font-mono whitespace-nowrap shadow-md uppercase">
            {displayName}
          </div>
        </Html>
      )}
    </group>
  );
};

const ResolvedModel: React.FC<{ url: string }> = ({ url }) => {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    cloned.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [cloned]);

  return <primitive object={cloned} />;
};

// ??$$$
const checkWebGLSupport = (): boolean => {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch (e) {
    return false;
  }
};

export const Scene: React.FC = () => {
  const { project, showWires, lcdLine1, lcdLine2, lcdBacklight } = useProjectStore();
  const bomItems = Array.isArray(project?.bom) ? project.bom : [];
  
  // ??$$$
  const isWebGLAvailable = React.useMemo(() => checkWebGLSupport(), []);

  if (!isWebGLAvailable) {
    return <SchematicView />;
  }

  return (
    <div className="w-full h-full bg-slate-100 dark:bg-slate-950 relative">
      <WebGLErrorBoundary>
        <Canvas
          shadows
          fallback={<SchematicView />}
          camera={{ position: [0, 4.5, 5], fov: 45 }}
          gl={{ antialias: true, alpha: false }}
        >
          <color attach="background" args={['#e9eff5']} />

          {/* Ambient background light */}
          <ambientLight intensity={0.4} />
          
          {/* Soft fill light */}
          <directionalLight
            position={[-4, 6, -2]}
            intensity={0.4}
          />

          {/* Main shadow casting light */}
          <directionalLight
            castShadow
            position={[5, 8, 4]}
            intensity={1.2}
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
            shadow-camera-far={20}
            shadow-camera-left={-6}
            shadow-camera-right={6}
            shadow-camera-top={6}
            shadow-camera-bottom={-6}
          />

          {/* Cyber Neon Floor Grid */}
          <Grid
            position={[0, -0.1, 0]}
            args={[15, 15]}
            cellSize={0.5}
            cellThickness={0.5}
            cellColor="#c7d2e0"
            sectionSize={2.5}
            sectionThickness={1}
            sectionColor="#1d4ed8"
            fadeDistance={20}
          />

          {/* Metallic Workbench Platform Desk */}
          <mesh receiveShadow position={[0, -0.05, 0]}>
            <boxGeometry args={[7.8, 0.08, 4.2]} />
            <meshStandardMaterial 
              color="#d7e3f4" 
              roughness={0.4} 
              metalness={0.7} 
            />
          </mesh>
          
          {/* Secondary styling plate */}
          <mesh position={[0, -0.005, 0]}>
            <boxGeometry args={[7.6, 0.01, 4.0]} />
            <meshStandardMaterial 
              color="#edf2f7" 
              roughness={0.6} 
              metalness={0.2} 
              wireframe
            />
          </mesh>

          <Suspense fallback={null}>
            {/* Hardware Parts */}
            {bomItems.map((item, index) => {
              const itemName = String(item?.displayName || "").toLowerCase();
              const itemType = String(item?.type || "").toLowerCase();
              const position = Array.isArray(item?.position)
                ? item.position as [number, number, number]
                : [0, 0.08, 0] as [number, number, number];

              if (itemType === 'microcontroller') {
                return (
                  <Arduino
                    key={item?.key || `mcu-${index}`}
                    position={position}
                    componentKey={String(item?.key || 'arduino')}
                    displayName={String(item?.displayName || 'Microcontroller')}
                  />
                );
              }

              if (itemType === 'led' || itemName.includes('led')) {
                return (
                  <LED
                    key={item?.key || `led-${index}`}
                    position={position}
                    componentKey={String(item?.key || `led${index + 1}`)}
                    displayName={String(item?.displayName || `LED ${index + 1}`)}
                  />
                );
              }

              if (itemType === 'button' || itemName.includes('button') || itemName.includes('switch')) {
                return (
                  <Button
                    key={item?.key || `button-${index}`}
                    position={position}
                    componentKey={String(item?.key || `button${index + 1}`)}
                    displayName={String(item?.displayName || `Button ${index + 1}`)}
                  />
                );
              }

              if (itemType === 'display' || itemName.includes('lcd') || itemName.includes('screen') || itemName.includes('oled')) {
                return (
                  <LCD16x2
                    key={item?.key || `lcd-${index}`}
                    position={position}
                    componentKey={String(item?.key || `lcd${index + 1}`)}
                    displayName={String(item?.displayName || `LCD ${index + 1}`)}
                    textLine1={lcdLine1}
                    textLine2={lcdLine2}
                    backlight={lcdBacklight}
                  />
                );
              }

              return (
                <GenericPart
                  key={item?.key || `part-${index}`}
                  position={position}
                  rotation={Array.isArray(item?.rotation) ? item.rotation as [number, number, number] : [0, 0, 0]}
                  componentKey={String(item?.key || `part${index + 1}`)}
                  displayName={String(item?.displayName || `Part ${index + 1}`)}
                  type={itemType || 'module'}
                  glbUrl={String(item?.glbUrl || '')}
                />
              );
            })}

            {/* Wire Connections */}
            {showWires && project.wiring.map((wire, idx) => (
              <Wire 
                key={`${wire.from}-${wire.to}-${idx}`}
                from={wire.from}
                to={wire.to}
                color={wire.color}
              />
            ))}
          </Suspense>

          {/* Camera Control */}
          <OrbitControls 
            enableDamping
            dampingFactor={0.05}
            minDistance={2}
            maxDistance={12}
            maxPolarAngle={Math.PI / 2.1} // Prevent looking from below
          />
        </Canvas>
      </WebGLErrorBoundary>

      {/* Floating 3D Control Compass Help Overlay */}
      <div className="absolute top-4 left-4 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-lg pointer-events-none select-none text-[10px] text-slate-600 dark:text-slate-300 font-mono space-y-1 z-10 shadow-lg">
        <div className="text-blue-600 font-semibold uppercase tracking-wider mb-1">Canvas Controls</div>
        <div>Rotate: Left Click + Drag</div>
        <div>Pan: Right Click + Drag</div>
        <div>Zoom: Scroll Wheel</div>
      </div>
    </div>
  );
};
