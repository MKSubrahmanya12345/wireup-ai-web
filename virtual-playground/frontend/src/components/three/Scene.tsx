// ??$$$
import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import { useProjectStore } from '../../store/useProjectStore';
import { Arduino } from './Arduino';
import { LED } from './LED';
import { Button } from './Button';
import { Wire } from './Wire';
import { WebGLErrorBoundary } from './ErrorBoundary';
import { SchematicView } from './SchematicView';

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
  const { project, showWires } = useProjectStore();
  
  // ??$$$
  const isWebGLAvailable = React.useMemo(() => checkWebGLSupport(), []);

  if (!isWebGLAvailable) {
    return <SchematicView />;
  }

  return (
    <div className="w-full h-full bg-[#050510] relative">
      <WebGLErrorBoundary>
        <Canvas
          shadows
          fallback={<SchematicView />}
          camera={{ position: [0, 4.5, 5], fov: 45 }}
          gl={{ antialias: true, alpha: false }}
        >
          <color attach="background" args={['#03030c']} />

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
            cellColor="#1f1f45"
            sectionSize={2.5}
            sectionThickness={1}
            sectionColor="#00f0ff"
            fadeDistance={20}
          />

          {/* Metallic Workbench Platform Desk */}
          <mesh receiveShadow position={[0, -0.05, 0]}>
            <boxGeometry args={[7.8, 0.08, 4.2]} />
            <meshStandardMaterial 
              color="#0d0d1e" 
              roughness={0.4} 
              metalness={0.7} 
            />
          </mesh>
          
          {/* Secondary styling plate */}
          <mesh position={[0, -0.005, 0]}>
            <boxGeometry args={[7.6, 0.01, 4.0]} />
            <meshStandardMaterial 
              color="#14142b" 
              roughness={0.6} 
              metalness={0.2} 
              wireframe
            />
          </mesh>

          <Suspense fallback={null}>
            {/* Hardware Parts */}
            <Arduino position={[0, 0.05, 0]} />
            <LED position={[2.5, 0.2, 0.5]} />
            <Button position={[-2.5, 0.15, -0.5]} />

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
      <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md border border-[#1f1f45] px-3 py-2 rounded-lg pointer-events-none select-none text-[10px] text-slate-400 font-mono space-y-1 z-10 shadow-lg">
        <div className="text-cyan-400 font-semibold uppercase tracking-wider mb-1">Canvas Controls</div>
        <div>Rotate: Left Click + Drag</div>
        <div>Pan: Right Click + Drag</div>
        <div>Zoom: Scroll Wheel</div>
      </div>
    </div>
  );
};
