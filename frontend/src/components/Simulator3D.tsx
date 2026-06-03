// ??$$$ group 6 - Physical Enclosure & 3D Modeling (Phase 5)
// @ts-nocheck
// ??$$$ Simulator3D Component - Professional Integrated View with GLTF Support
import React, { Suspense, useState, useRef, useMemo, useEffect, useImperativeHandle, forwardRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, PerspectiveCamera, Html, QuadraticBezierLine, Grid, GizmoHelper, GizmoViewport, useCursor, PivotControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { motion, AnimatePresence } from "framer-motion";
import { useSimulatorStore } from "../store/useSimulatorStore";
import { Zap, Cpu, Eye, EyeOff } from "lucide-react";
import { io } from "socket.io-client";

const nodeRefs = {}; 
const GRID_SIZE = 5; 
const snapToGrid = (val) => Math.round(val / GRID_SIZE) * GRID_SIZE;

// ??`$ NEW FLOW � pin type debug sphere colors
const PIN_TYPE_COLORS = { power: "#ef4444", gnd: "#6b7280", digital: "#3b82f6", analog: "#22c55e", nc: "#ffffff" };
// ??`$ NEW FLOW � 1mm = 0.1 Three.js units
const MM_TO_UNITS = 0.1;

// ??$$$ - ErrorBoundary to catch model loading errors and fallback to procedural meshes
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.warn("GLTF model failed to load, falling back to procedural mesh:", error);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// ??$$$ - Procedural fallback meshes for 3D simulation elements with dimension parsing and loading indicators
const ProceduralFallback = ({ type, specs, isPending }) => {
  let width = 2.0;
  let height = 0.5;
  let depth = 1.0;

  if (specs) {
    const dimStr = specs.Dimensions || specs.dimensions || specs.Size || specs.size || "";
    const matches = String(dimStr).match(/(\d+(?:\.\d+)?)\s*(?:x|X|\*)\s*(\d+(?:\.\d+)?)\s*(?:x|X|\*)\s*(\d+(?:\.\d+)?)/);
    if (matches) {
      width = parseFloat(matches[1]) / 10;
      depth = parseFloat(matches[2]) / 10;
      height = parseFloat(matches[3]) / 10;
    }
  }

  // Cap dimensions to reasonable size to prevent huge boxes
  width = Math.min(Math.max(width, 0.5), 15);
  depth = Math.min(Math.max(depth, 0.5), 15);
  height = Math.min(Math.max(height, 0.2), 5);

  return (
    <group>
      {type === "ARDUINO_UNO" ? (
        <mesh>
          <boxGeometry args={[13.7, 0.4, 10.6]} />
          <meshStandardMaterial color="#006699" />
        </mesh>
      ) : type === "LED" ? (
        <mesh>
          <sphereGeometry args={[0.8]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" />
        </mesh>
      ) : (
        <group>
          <mesh>
            <boxGeometry args={[width, height, depth]} />
            <meshStandardMaterial color={isPending ? "#222222" : "#555555"} roughness={0.7} metalness={0.2} />
          </mesh>
          <Html distanceFactor={15} position={[0, height / 2 + 0.6, 0]} pointerEvents="none">
            <div style={{
              background: "rgba(0,0,0,0.85)",
              color: isPending ? "#fbbf24" : "#ffffff",
              fontSize: "8px",
              padding: "2px 6px",
              borderRadius: "4px",
              border: `1px solid ${isPending ? "#fbbf24" : "#444"}`,
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: "4px"
            }}>
              {isPending && (
                <span className="animate-pulse" style={{
                  display: "inline-block",
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "#fbbf24"
                }} />
              )}
              <span>{type} {isPending ? "(Downloading 3D...)" : ""}</span>
            </div>
          </Html>
        </group>
      )}
    </group>
  );
};

// --- GLTF Model Mapper ---
const Model = ({ type, url }) => {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(), [scene]);
  
  // Center and scale models if needed
  useEffect(() => {
    cloned.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [cloned]);

  return <primitive object={cloned} />;
};

const DraggableComponent = forwardRef(({ id, type, position, rotation, isSelected, def, bomItem, glbUrl }, ref) => {
  const groupRef = useRef();
  const { mode, activeWiringSource } = useSimulatorStore(s => s.transient);
  const livePos = useSimulatorStore(s => s.transient.livePositions[id]);
  const setTransient = useSimulatorStore(s => s.setTransient);
  const moveNode = useSimulatorStore(s => s.moveNode);
  const commitNodeMove = useSimulatorStore(s => s.commitNodeMove);
  const addConnection = useSimulatorStore(s => s.addConnection);
  const setPinAnchors = useSimulatorStore(s => s.setPinAnchors);
  const clearNodePinAnchors = useSimulatorStore(s => s.clearNodePinAnchors);

  const currentPos = livePos || position;
  const [hovered, setHovered] = useState(false);
  const dragState = useRef({ active: false, offset: new THREE.Vector3() });
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  useCursor(hovered && mode === "IDLE");

  // ??$$$ NEW FLOW � attach SnapEDA pin anchors to the store after mount
  useEffect(() => {
    if (!groupRef.current) return;
    const pins = bomItem?.pins || [];
    if (!pins.length) return;
    clearNodePinAnchors(id);
    const newAnchors = {};
    pins.forEach(pin => {
      const anchor = new THREE.Object3D();
      anchor.name = `pin_${pin.name}`;
      anchor.position.set(
        pin.x_mm * MM_TO_UNITS,
        pin.z_mm * MM_TO_UNITS,
        pin.y_mm * MM_TO_UNITS
      );
      groupRef.current.add(anchor);
      newAnchors[`${id}:${pin.id}`] = anchor;
      newAnchors[`${id}:${pin.name}`] = anchor;
    });
    setPinAnchors(newAnchors);
  }, [id, bomItem?.pins]);

  useImperativeHandle(ref, () => ({
    getPinWorldPos: (pinId) => {
      // ??$$$ NEW FLOW � prefer SnapEDA anchor, fall back to registry def pin
      const storeAnchors = useSimulatorStore.getState().pinAnchors;
      const anchor = storeAnchors[`${id}:${pinId}`];
      if (anchor) {
        return anchor.getWorldPosition(new THREE.Vector3());
      }
      const pin = def.pins.find(p => p.id === pinId);
      if (!pin || !groupRef.current) return new THREE.Vector3();
      return new THREE.Vector3(...pin.pos).applyMatrix4(groupRef.current.matrixWorld);
    }
  }));

  useFrame(({ raycaster }) => {
    if (!dragState.current.active || mode !== "DRAGGING") return;
    const hit = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(plane, hit)) {
      moveNode(id, [hit.x + dragState.current.offset.x, position[1], hit.z + dragState.current.offset.z]);
    }
  });

  const onDown = (e) => {
    e.stopPropagation();
    if (mode === "WIRING") return;
    setTransient({ selectedNodeId: id, mode: "DRAGGING", dragId: id });
    const hit = new THREE.Vector3();
    e.ray.intersectPlane(plane, hit);
    dragState.current = { active: true, offset: new THREE.Vector3(currentPos[0] - hit.x, 0, currentPos[2] - hit.z) };
    const onUp = () => {
      if (dragState.current.active) {
        const latest = useSimulatorStore.getState().transient.livePositions[id] || currentPos;
        commitNodeMove(id, [snapToGrid(latest[0]), latest[1], snapToGrid(latest[2])]);
        dragState.current.active = false;
        setTransient({ mode: "IDLE", dragId: null });
      }
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointerup', onUp);
  };

  const handlePinClick = (e, pin) => {
    e.stopPropagation();
    const worldPosVec = groupRef.current.localToWorld(new THREE.Vector3(...pin.pos));
    const worldPos = [worldPosVec.x, worldPosVec.y, worldPosVec.z];
    if (!activeWiringSource) {
      setTransient({ mode: "WIRING", activeWiringSource: { nodeId: id, pinId: pin.id, worldPos } });
    } else {
      if (activeWiringSource.nodeId === id && activeWiringSource.pinId === pin.id) {
        setTransient({ mode: "IDLE", activeWiringSource: null });
      } else {
        addConnection(activeWiringSource, { nodeId: id, pinId: pin.id });
        setTransient({ mode: "IDLE", activeWiringSource: null });
      }
    }
  };

  return (
    <PivotControls depthTest={false} anchor={[0, 0, 0]} scale={isSelected && mode === "IDLE" ? 2.5 : 0} lineWidth={4} fixed={true}
      onDragEnd={(m) => {
        const p = new THREE.Vector3(); const q = new THREE.Quaternion(); const s = new THREE.Vector3();
        m.decompose(p, q, s); commitNodeMove(id, [p.x, p.y, p.z]);
      }}>
      <group ref={groupRef} position={currentPos} rotation={rotation} scale={def.scale || 1} onPointerDown={onDown} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
        {/* ??$$$ Load GLTF inside ErrorBoundary wrapping Suspense to catch load failures, else use procedural fallback */}
        <ErrorBoundary fallback={<ProceduralFallback type={type} specs={bomItem?.specs} isPending={!glbUrl} />}>
          <Suspense fallback={<mesh><boxGeometry args={[2, 2, 2]} /><meshStandardMaterial color="#444" wireframe /></mesh>}>
            {glbUrl ? (
              <Model url={glbUrl} />
            ) : (
              <ProceduralFallback type={type} specs={bomItem?.specs} isPending={true} />
            )}
          </Suspense>
        </ErrorBoundary>

        {def.pins.map(pin => (
          <group key={pin.id} position={pin.pos} onClick={(e) => handlePinClick(e, pin)}>
            <mesh><sphereGeometry args={[0.4, 12, 12]} /><meshStandardMaterial color={activeWiringSource?.nodeId === id && activeWiringSource?.pinId === pin.id ? "#22c55e" : "#fbbf24"} emissive={activeWiringSource ? "#fbbf24" : "#000"} emissiveIntensity={activeWiringSource ? 0.5 : 0} /></mesh>
            <Html distanceFactor={25} position={[0, 0.8, 0]} pointerEvents="none">
              <div className="text-[7px] font-black bg-black/80 text-yellow-400 px-1 rounded uppercase tracking-tighter opacity-50 whitespace-nowrap">{pin.id}</div>
            </Html>
          </group>
        ))}

        {isSelected && mode === "IDLE" && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
            <ringGeometry args={[2.6, 2.8, 32]} /><meshBasicMaterial color="#3b82f6" transparent opacity={0.8} />
          </mesh>
        )}
      </group>
    </PivotControls>
  );
});

// ??$$$ NEW FLOW — Tube wire rendered with CatmullRomCurve3 between anchor world positions
const TubeWire = ({ start, end, color }) => {
  const geo = useMemo(() => {
    const s = new THREE.Vector3(...start);
    const e = new THREE.Vector3(...end);
    const sag = new THREE.Vector3(0, -0.3, 0);
    const mid = s.clone().lerp(e, 0.5).add(sag);
    const curve = new THREE.CatmullRomCurve3([s, mid, e]);
    return new THREE.TubeGeometry(curve, 20, 0.018, 8, false);
  }, [start[0], start[1], start[2], end[0], end[1], end[2]]);

  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color={color || "#3b82f6"} roughness={0.55} metalness={0.1} />
    </mesh>
  );
};

// ??$$$ NEW FLOW — Animated flow pulse that travels along CatmullRom curve
const WireFlowMarker = ({ start, end, color }) => {
  const markerRef = useRef();
  useFrame((state) => {
    if (!markerRef.current) return;
    const t = (state.clock.getElapsedTime() * 0.5) % 1.0;
    const s = new THREE.Vector3(...start);
    const e = new THREE.Vector3(...end);
    const sag = new THREE.Vector3(0, -0.3, 0);
    const mid = s.clone().lerp(e, 0.5).add(sag);
    const curve = new THREE.CatmullRomCurve3([s, mid, e]);
    const pos = curve.getPoint(t);
    markerRef.current.position.copy(pos);
  });
  return (
    <mesh ref={markerRef}>
      <sphereGeometry args={[0.3, 8, 8]} />
      <meshBasicMaterial color={color || "#3b82f6"} toneMapping={false} />
    </mesh>
  );
};

function Wires({ pinAnchors }) {
  const connections = useSimulatorStore(s => s.connections);
  const nodes = useSimulatorStore(s => s.nodes);
  const { mode, activeWiringSource } = useSimulatorStore(s => s.transient);
  const [mousePos, setMousePos] = useState([0, 0, 0]);

  useFrame(({ raycaster }) => {
    if (mode !== "WIRING" || !activeWiringSource) return;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(plane, hit)) setMousePos([hit.x, hit.y, hit.z]);
  });

  // ??$$$ NEW FLOW — resolve wire endpoint: SnapEDA anchor → nodeRef registry pin → null
  const resolveEndpoint = useCallback((pinRef) => {
    const anchor = pinAnchors[pinRef];
    if (anchor) {
      const wp = new THREE.Vector3();
      anchor.getWorldPosition(wp);
      return [wp.x, wp.y, wp.z];
    }
    const [nodeId, pinId] = pinRef.split(":");
    const nodeRef = nodeRefs[nodeId];
    if (nodeRef?.getPinWorldPos) {
      const wp = nodeRef.getPinWorldPos(pinId);
      return [wp.x, wp.y, wp.z];
    }
    return null;
  }, [pinAnchors]);

  const renderedWires = useMemo(() => {
    return connections.map(conn => {
      const fromKey = `${conn.from.nodeId}:${conn.from.pinId}`;
      const toKey = `${conn.to.nodeId}:${conn.to.pinId}`;
      const start = resolveEndpoint(fromKey);
      const end = resolveEndpoint(toKey);
      if (!start || !end) return null;
      return (
        <group key={conn.id}>
          <TubeWire start={start} end={end} color={conn.color || "#3b82f6"} />
          <WireFlowMarker start={start} end={end} color={conn.color || "#3b82f6"} />
        </group>
      );
    }).filter(Boolean);
  }, [connections, nodes, pinAnchors, resolveEndpoint]);

  return (
    <group>
      {renderedWires}
      {mode === "WIRING" && activeWiringSource && (
        <QuadraticBezierLine
          start={activeWiringSource.worldPos}
          end={mousePos}
          mid={[
            (activeWiringSource.worldPos[0] + mousePos[0]) / 2,
            Math.max(activeWiringSource.worldPos[1], mousePos[1]) + 20,
            (activeWiringSource.worldPos[2] + mousePos[2]) / 2
          ]}
          color="#22c55e"
          lineWidth={2}
          transparent
          opacity={0.6}
          dashed
        />
      )}
    </group>
  );
}

// ??$$$ NEW FLOW — Dev-mode pin debug spheres (only visible when showPinDebug=true)
function PinDebugSpheres({ pinAnchors, showPinDebug }) {
  if (!showPinDebug) return null;
  return (
    <group>
      {Object.entries(pinAnchors).map(([key, anchor]) => {
        if (!anchor) return null;
        const parts = key.split(":");
        if (parts.length < 2) return null;
        // Skip duplicate name-keyed entries (only render short/numeric id ones)
        const pinId = parts[1];
        if (isNaN(Number(pinId)) && pinId.length > 8) return null;
        const wp = new THREE.Vector3();
        try { anchor.getWorldPosition(wp); } catch { return null; }
        return (
          <group key={key} position={[wp.x, wp.y, wp.z]}>
            <mesh>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshBasicMaterial color={PIN_TYPE_COLORS["digital"]} />
            </mesh>
            <Html distanceFactor={30} position={[0, 0.2, 0]} pointerEvents="none">
              <div style={{ fontSize: "6px", background: "rgba(0,0,0,0.8)", color: "#fff", padding: "1px 4px", borderRadius: "3px", whiteSpace: "nowrap" }}>
                {key}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

export default function Simulator3D({ diagram, hexCode, registry = {}, bom = [], projectId, onDiagramChange }) {
  const nodes = useSimulatorStore(s => s.nodes);
  const connections = useSimulatorStore(s => s.connections);
  const pinAnchors = useSimulatorStore(s => s.pinAnchors);
  const setPinAnchors = useSimulatorStore(s => s.setPinAnchors);
  const { mode, selectedNodeId } = useSimulatorStore(s => s.transient);
  const orbitRef = useRef();

  // ??$$$ NEW FLOW — live BOM state (starts from prop, updated via pins:ready socket)
  const [liveBom, setLiveBom] = useState(bom);
  useEffect(() => { setLiveBom(bom); }, [bom]);

  // ??$$$ NEW FLOW — dev mode pin debug toggle (only relevant in DEV)
  const [showPinDebug, setShowPinDebug] = useState(false);

  // Dynamic GLB URL mapping from initial BOM
  const [liveGlbUrls, setLiveGlbUrls] = useState({});
  useEffect(() => {
    const initialMap = {};
    if (bom) {
      bom.forEach(b => {
        if (b.glbUrl) initialMap[b.key.toLowerCase()] = b.glbUrl;
      });
    }
    setLiveGlbUrls(initialMap);
  }, [bom]);

  // ??$$$ NEW FLOW — socket: handle model:ready (GLB) + pins:ready (pin anchors)
  useEffect(() => {
    if (!projectId) return;
    const socketUrl = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";
    const socket = io(socketUrl);

    socket.on("model:ready", (data) => {
      if (data && String(data.projectId) === String(projectId) && data.bomKey && data.glbUrl) {
        setLiveGlbUrls(prev => ({ ...prev, [data.bomKey.toLowerCase()]: data.glbUrl }));
      }
    });

    // ??$$$ NEW FLOW — live pin metadata update from SnapEDA resolution
    socket.on("pins:ready", (data) => {
      if (!data || String(data.projectId) !== String(projectId)) return;
      const { bomKey, pins } = data;
      setLiveBom(prev => prev.map(b =>
        b.key.toLowerCase() === bomKey.toLowerCase() ? { ...b, pins: pins || [] } : b
      ));
    });

    return () => { socket.disconnect(); };
  }, [projectId]);

  // ??$$$ Flag to suppress sync-back when we just loaded nodes from the diagram prop
  const syncingFromProp = useRef(false);

  useEffect(() => {
    if (!diagram) return;
    const { parts = [], connections = [] } = diagram;
    const newNodes = parts.map(p => ({
      id: p.id,
      // ??$$$ Use replaceAll (with regex g flag) so e.g. esp32-devkit-v1 → ESP32_DEVKIT_V1
      type: p.type.toUpperCase().replace('WOKWI-', '').replace(/-/g, '_'),
      position: [
        typeof p.left === 'number' && Number.isFinite(p.left) ? p.left / 10 : 0,
        0,
        typeof p.top === 'number' && Number.isFinite(p.top) ? p.top / 10 : 0
      ],
      rotation: [0, 0, 0],
      attrs: p.attrs || {}
    }));

    const newConns = connections.map((c, i) => {
      const [from, to, color] = c;
      const [fNode, fPin] = from.split(':');
      const [tNode, tPin] = to.split(':');
      return { id: `wire_${i}`, from: { nodeId: fNode, pinId: fPin }, to: { nodeId: tNode, pinId: tPin }, color };
    });

    // Auto-wiring fallback from BOM if diagram connections are empty
    if (newConns.length === 0 && liveBom && liveBom.length > 0) {
      let connIdCounter = 0;
      liveBom.forEach(item => {
        if (item.pinConnections) {
          item.pinConnections.forEach(pc => {
            if (pc.pin && pc.connectsTo) {
              const [targetKey, targetPin] = pc.connectsTo.split(':');
              if (targetKey && targetPin) {
                const fromNode = newNodes.find(n => n.id === item.key || n.id.toLowerCase() === item.key.toLowerCase());
                const toNode = newNodes.find(n => n.id === targetKey || n.id.toLowerCase() === targetKey.toLowerCase());
                if (fromNode && toNode) {
                  newConns.push({
                    id: `wire_auto_${connIdCounter++}`,
                    from: { nodeId: fromNode.id, pinId: pc.pin },
                    to: { nodeId: toNode.id, pinId: targetPin },
                    color: "green"
                  });
                }
              }
            }
          });
        }
      });
    }

    // ??$$$ Set flag BEFORE setting store state to suppress sync-back in the nodes/connections effect
    syncingFromProp.current = true;
    useSimulatorStore.setState({ nodes: newNodes, connections: newConns });
    // ??$$$ Reset the flag on the next microtask tick, after the store update has settled
    Promise.resolve().then(() => { syncingFromProp.current = false; });
  }, [diagram, liveBom]);

  // Diagram change synchronization
  const onDiagramChangeRef = useRef(onDiagramChange);
  useEffect(() => { onDiagramChangeRef.current = onDiagramChange; }, [onDiagramChange]);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (syncingFromProp.current) return;
    const updated = {
      version: 1, author: "NovaAI", editor: "wokwi",
      parts: nodes.map(n => ({
        id: n.id,
        type: n.type.toLowerCase().startsWith('wokwi') ? n.type.toLowerCase().replace(/_/g, '-') : `wokwi-${n.type.toLowerCase().replace(/_/g, '-')}`,
        left: Math.round(n.position[0] * 10),
        top: Math.round(n.position[2] * 10),
        attrs: n.attrs || {}
      })),
      connections: connections.map(c => [
        `${c.from.nodeId}:${c.from.pinId}`,
        `${c.to.nodeId}:${c.to.pinId}`,
        c.color || "green", []
      ])
    };
    if (diagram) {
      const partsDiff = JSON.stringify(updated.parts) !== JSON.stringify(diagram.parts);
      const connsDiff = JSON.stringify(updated.connections) !== JSON.stringify(diagram.connections);
      if ((partsDiff || connsDiff) && onDiagramChangeRef.current) {
        onDiagramChangeRef.current(updated);
      }
    }
  }, [nodes, connections]);

  const COMPONENT_DEFS = useMemo(() => {
    const defs = {};
    Object.keys(registry).forEach(key => {
      const reg = registry[key];
      defs[key] = {
        name: key,
        scale: key === "ARDUINO_UNO" ? 5 : 3,
        gltf: key === "ARDUINO_UNO" ? "/models/arduino_uno.glb" : (reg.gltf || null),
        pins: (reg.pins || []).map((p, i) => ({
          id: p.name,
          pos: p.name === "GND" ? [2, 0.8, 8.2] : p.name === "5V" ? [1.2, 0.8, 8.2] : [-6.4 + i * 0.2, 0.8, -8.2]
        }))
      };
    });
    return defs;
  }, [registry]);

  return (
    <div className="h-full w-full relative bg-[#0a0a0a]">
      <Canvas dpr={[1, 1.5]} onPointerMissed={() => useSimulatorStore.getState().setTransient({ selectedNodeId: null, mode: "IDLE" })}>
        <PerspectiveCamera makeDefault position={[100, 100, 100]} fov={35} />
        <ambientLight intensity={1.5} /><pointLight position={[50, 100, 50]} intensity={2.5} />
        <Suspense fallback={null}>
          {nodes.map(node => {
            const lowercaseType = node.type.toLowerCase();
            // ??$$$ NEW FLOW — find BOM item by key/type from liveBom (has real glbUrl + pins)
            const bomItem = liveBom.find(b =>
              b.key.toLowerCase() === lowercaseType ||
              b.key.toLowerCase() === node.id.toLowerCase() ||
              (b.wokwiPartType && b.wokwiPartType.toLowerCase() === lowercaseType) ||
              (b.displayName && b.displayName.toLowerCase().replace(/[^a-z0-9]/g, '').includes(lowercaseType.replace(/[^a-z0-9]/g, '')))
            );
            const bomKey = bomItem ? bomItem.key.toLowerCase() : null;
            // ??$$$ NEW FLOW — GLB priority: liveBom.glbUrl → socket liveGlbUrls → registry gltf
            const glbUrl = bomItem?.glbUrl ||
              (bomKey && liveGlbUrls[bomKey]) ||
              COMPONENT_DEFS[node.type]?.gltf ||
              null;

            return (
              <DraggableComponent
                key={node.id}
                {...node}
                ref={el => nodeRefs[node.id] = el}
                def={COMPONENT_DEFS[node.type] || { pins: [] }}
                isSelected={selectedNodeId === node.id}
                bomItem={bomItem}
                glbUrl={glbUrl}
              />
            );
          })}
          {/* ??$$$ NEW FLOW — pass live pinAnchors to Wires for anchor-resolved wire positions */}
          <Wires pinAnchors={pinAnchors} />
          {/* ??$$$ NEW FLOW — dev mode pin debug spheres */}
          {import.meta.env.DEV && <PinDebugSpheres pinAnchors={pinAnchors} showPinDebug={showPinDebug} />}
          <Environment preset="city" />
          <Grid infiniteGrid fadeDistance={250} fadeStrength={5} sectionSize={5} sectionColor="#444" cellColor="#222" />
        </Suspense>
        <OrbitControls ref={orbitRef} makeDefault enabled={mode === "IDLE" || (mode === "WIRING" && !selectedNodeId)} minDistance={10} maxDistance={1000} enableDamping />
      </Canvas>

      {/* HUD */}
      <div className="absolute top-4 right-4 z-10 pointer-events-none">
        <div className="bg-black/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/5 flex flex-col items-end gap-1 shadow-xl">
          <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2"><Cpu className="w-3 h-3" /> 3D ENGINE ACTIVE</span>
          <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider">{nodes.length} Parts | {mode}</span>
        </div>
      </div>

      {/* ??$$$ NEW FLOW — dev mode toggle button */}
      {import.meta.env.DEV && (
        <button
          onClick={() => setShowPinDebug(p => !p)}
          className="absolute bottom-4 right-4 z-10 flex items-center gap-2 px-3 py-2 rounded-xl bg-black/70 border border-white/10 text-[9px] font-bold text-white hover:border-blue-500/50 transition-all"
        >
          {showPinDebug ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          {showPinDebug ? "Hide Pins" : "Show Pins"}
        </button>
      )}
    </div>
  );
}
