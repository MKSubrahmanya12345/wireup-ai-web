// @ts-nocheck
// ??$$$ 3D Simulator Production Engine - Unified Interaction Model
import React, { Suspense, useState, useRef, useMemo, useEffect, useImperativeHandle, forwardRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, PerspectiveCamera, Html, QuadraticBezierLine, Grid, GizmoHelper, GizmoViewport, useCursor, PivotControls, useGLTF } from "@react-three/drei";

// ??$$$ newer code — ErrorBoundary to catch model loading errors
class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err) { console.error("GLTF load error:", err); }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

// ??$$$ newer code — GLTFComponent for rendering loaded 3D models
const GLTFComponent = ({ url }) => {
  const { scene } = useGLTF(url);
  const clonedScene = useMemo(() => scene.clone(), [scene]);
  return <primitive object={clonedScene} />;
}
import * as THREE from "three";
import { motion, AnimatePresence } from "framer-motion";
import { useThemeStore } from "../store/useThemeStore";
import { useSimulatorStore } from "../store/useSimulatorStore";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Box, Plus, Zap, Trash2, Cpu, Lightbulb, Move, ZoomIn, ZoomOut, Target, X, Eye, Undo2, Redo2, Download, Upload, Save } from "lucide-react";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";

// --- Global Registry ---
const nodeRefs = {}; 

const GRID_SIZE = 5; 
const snapToGrid = (val) => Math.round(val / GRID_SIZE) * GRID_SIZE;

// --- Procedural Meshes ---

const ArduinoUnoMesh = () => (
  <group>
    <mesh position={[0, -0.4, 0]}><boxGeometry args={[13.7, 0.4, 10.6]} /><meshStandardMaterial color="#006699" roughness={0.2} /></mesh>
    <mesh position={[2, 0, 0]}><boxGeometry args={[4.5, 0.6, 1.4]} /><meshStandardMaterial color="#111" /></mesh>
    <mesh position={[-5.8, 0.5, -3.2]}><boxGeometry args={[3, 1.8, 2.4]} /><meshStandardMaterial color="#ddd" metalness={0.8} /></mesh>
    <mesh position={[-5.8, 0.5, 3.2]}><boxGeometry args={[3.2, 2, 2]} /><meshStandardMaterial color="#111" /></mesh>
    <mesh position={[-1, 0.4, -8.2]}><boxGeometry args={[11.5, 0.8, 1.2]} /><meshStandardMaterial color="#1a1a1a" /></mesh>
    <mesh position={[4, 0.4, 8.2]}><boxGeometry args={[5, 0.8, 1.2]} /><meshStandardMaterial color="#1a1a1a" /></mesh>
  </group>
);

const LEDMesh = ({ color = "#ef4444" }) => (
  <group>
    <mesh position={[-0.2, -1, 0]}><cylinderGeometry args={[0.05, 0.05, 2]} /><meshStandardMaterial color="silver" /></mesh>
    <mesh position={[0.2, -1.2, 0]}><cylinderGeometry args={[0.05, 0.05, 2.4]} /><meshStandardMaterial color="silver" /></mesh>
    <mesh position={[0, 0.6, 0]}><cylinderGeometry args={[0.4, 0.4, 1.2, 12]} /><meshStandardMaterial color={color} transparent opacity={0.7} emissive={color} emissiveIntensity={0.8} /></mesh>
    <mesh position={[0, 1.2, 0]}><sphereGeometry args={[0.4, 16, 12]} /><meshStandardMaterial color={color} transparent opacity={0.7} emissive={color} emissiveIntensity={0.8} /></mesh>
  </group>
);

// --- Draggable Component ---

const DraggableComponent = forwardRef(({ id, type, position, rotation, isSelected, def, glbUrl }, ref) => {
  const groupRef = useRef();
  const { mode, activeWiringSource } = useSimulatorStore(s => s.transient);
  const livePos = useSimulatorStore(s => s.transient.livePositions[id]);
  const setTransient = useSimulatorStore(s => s.setTransient);
  const moveNode = useSimulatorStore(s => s.moveNode);
  const commitNodeMove = useSimulatorStore(s => s.commitNodeMove);
  const addConnection = useSimulatorStore(s => s.addConnection);
  
  const currentPos = livePos || position;
  const [hovered, setHovered] = useState(false);
  const dragState = useRef({ active: false, offset: new THREE.Vector3() });
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  useCursor(hovered && mode === "IDLE");

  useImperativeHandle(ref, () => ({
    getPinWorldPos: (pinId) => {
      const pin = def.pins.find(p => p.id === pinId);
      if (!pin || !groupRef.current) return new THREE.Vector3();
      return new THREE.Vector3(...pin.pos).applyMatrix4(groupRef.current.matrixWorld);
    }
  }));

  useFrame(({ raycaster }) => {
    if (!dragState.current.active || mode !== "DRAGGING") return;
    const hit = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(plane, hit)) {
      moveNode(id, [
        hit.x + dragState.current.offset.x,
        position[1],
        hit.z + dragState.current.offset.z
      ]);
    }
  });

  const onDown = (e) => {
    e.stopPropagation();
    if (mode === "WIRING") return; // Wiring has priority

    // Select and start drag
    setTransient({ selectedNodeId: id, mode: "DRAGGING", dragId: id });
    
    const hit = new THREE.Vector3();
    e.ray.intersectPlane(plane, hit);
    dragState.current = {
      active: true,
      offset: new THREE.Vector3(currentPos[0] - hit.x, 0, currentPos[2] - hit.z)
    };
    
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
    <PivotControls
      depthTest={false}
      anchor={[0, 0, 0]}
      scale={isSelected && mode === "IDLE" ? 2.5 : 0}
      lineWidth={4}
      fixed={true}
      onDragEnd={(m) => {
        const p = new THREE.Vector3();
        const q = new THREE.Quaternion();
        const s = new THREE.Vector3();
        m.decompose(p, q, s);
        commitNodeMove(id, [p.x, p.y, p.z]);
      }}
    >
      <group 
        ref={groupRef}
        position={currentPos} 
        rotation={rotation} 
        scale={def.scale || 1}
        onPointerDown={onDown}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        {glbUrl ? (
          <ErrorBoundary fallback={
            <mesh>
              <boxGeometry args={[4, 0.5, 3]} />
              <meshStandardMaterial color="#3b82f6" roughness={0.3} />
            </mesh>
          }>
            <GLTFComponent url={glbUrl} />
          </ErrorBoundary>
        ) : (
          <>
            {type === "ARDUINO_UNO" && <ArduinoUnoMesh />}
            {type === "LED" && <LEDMesh />}
            {type === "RESISTOR" && (
              <group rotation={[0, 0, Math.PI / 2]}>
                <mesh><cylinderGeometry args={[0.04, 0.04, 3]} /><meshStandardMaterial color="silver" /></mesh>
                <mesh><cylinderGeometry args={[0.4, 0.4, 1.5, 12]} /><meshStandardMaterial color="#d2b48c" /></mesh>
              </group>
            )}
            {!["ARDUINO_UNO", "LED", "RESISTOR"].includes(type) && (
              <mesh>
                <boxGeometry args={[4, 0.5, 3]} />
                <meshStandardMaterial color="#005d3c" roughness={0.3} />
              </mesh>
            )}
          </>
        )}

        {def.pins.map(pin => (
          <group key={pin.id} position={pin.pos} onClick={(e) => handlePinClick(e, pin)}>
            <mesh>
              <sphereGeometry args={[0.4, 12, 12]} />
              <meshStandardMaterial 
                color={activeWiringSource?.nodeId === id && activeWiringSource?.pinId === pin.id ? "#22c55e" : "#fbbf24"} 
                emissive={activeWiringSource ? "#fbbf24" : "#000"} 
                emissiveIntensity={activeWiringSource ? 0.5 : 0} 
              />
            </mesh>
            <Html distanceFactor={25} position={[0, 0.8, 0]} pointerEvents="none">
              <div className="text-[7px] font-black bg-black/80 text-yellow-400 px-1 rounded uppercase tracking-tighter opacity-50 whitespace-nowrap">
                {pin.id}
              </div>
            </Html>
          </group>
        ))}

        {isSelected && mode === "IDLE" && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
            <ringGeometry args={[2.6, 2.8, 32]} />
            <meshBasicMaterial color="#3b82f6" transparent opacity={0.8} />
          </mesh>
        )}
      </group>
    </PivotControls>
  );
});

// --- Wire Manager ---

function Wires() {
  const connections = useSimulatorStore(s => s.connections);
  const nodes = useSimulatorStore(s => s.nodes);
  const { mode, activeWiringSource } = useSimulatorStore(s => s.transient);
  const [mousePos, setMousePos] = useState([0, 0, 0]);

  useFrame(({ raycaster }) => {
    if (mode !== "WIRING" || !activeWiringSource) return;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(plane, hit)) {
      setMousePos([hit.x, hit.y, hit.z]);
    }
  });

  const renderedWires = useMemo(() => {
    return connections.map(conn => {
      const fromRef = nodeRefs[conn.from.nodeId];
      const toRef = nodeRefs[conn.to.nodeId];
      if (!fromRef?.getPinWorldPos || !toRef?.getPinWorldPos) return null;
      const start = fromRef.getPinWorldPos(conn.from.pinId);
      const end = toRef.getPinWorldPos(conn.to.pinId);
      return (
        <QuadraticBezierLine
          key={conn.id}
          start={[start.x, start.y, start.z]}
          end={[end.x, end.y, end.z]}
          mid={[ (start.x + end.x) / 2, Math.max(start.y, end.y) + 15, (start.z + end.z) / 2 ]}
          color={conn.color || "#3b82f6"}
          lineWidth={4}
        />
      );
    }).filter(Boolean);
  }, [connections, nodes]);

  return (
    <group>
      {renderedWires}
      {mode === "WIRING" && activeWiringSource && (
        <QuadraticBezierLine
          start={activeWiringSource.worldPos}
          end={mousePos}
          mid={[ (activeWiringSource.worldPos[0] + mousePos[0]) / 2, Math.max(activeWiringSource.worldPos[1], mousePos[1]) + 20, (activeWiringSource.worldPos[2] + mousePos[2]) / 2 ]}
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

// --- Interaction Manager (Global Shortcuts) ---

function InteractionManager() {
  const deleteNode = useSimulatorStore(s => s.deleteNode);
  const setTransient = useSimulatorStore(s => s.setTransient);
  const selectedId = useSimulatorStore(s => s.transient.selectedNodeId);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setTransient({ mode: "IDLE", selectedNodeId: null, activeWiringSource: null });
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        deleteNode(selectedId);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId]);

  return null;
}

// --- Main Page ---

export default function Simulator3DPage() {
  const { theme } = useThemeStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("projectId");
  const isDark = theme === "dark";
  
  const nodes = useSimulatorStore(s => s.nodes);
  const connections = useSimulatorStore(s => s.connections);
  const addNode = useSimulatorStore(s => s.addNode);
  const undo = useSimulatorStore(s => s.undo);
  const redo = useSimulatorStore(s => s.redo);
  const resetCircuit = useSimulatorStore(s => s.resetCircuit);
  const { mode, selectedNodeId } = useSimulatorStore(s => s.transient);

  const [registry, setRegistry] = useState({});
  const [projectBom, setProjectBom] = useState([]);
  const [saving, setSaving] = useState(false);
  const orbitRef = useRef();

  useEffect(() => {
    axiosInstance.get("/wokwi/registry").then(res => setRegistry(res.data)).catch(console.error);
  }, []);

  // ??$$$ newer code — fetch and populate project nodes and connections on mount
  useEffect(() => {
    if (!projectId) return;

    const loadProject = async () => {
      try {
        const projectRes = await axiosInstance.get(`/project/${projectId}`);
        const project = projectRes.data;
        if (project) {
          setProjectBom(project.bom || []);

          let diagram = project.diagram;
          if (typeof diagram === "string") {
            try {
              diagram = JSON.parse(diagram);
            } catch (e) {}
          }
          
          // Fetch registry first to do reverse mapping
          const registryRes = await axiosInstance.get("/wokwi/registry");
          const registryData = registryRes.data || {};
          
          const newNodes = [];
          const newConnections = [];

          const hasDiagramParts = diagram && diagram.parts && Array.isArray(diagram.parts) && diagram.parts.length > 0;

          if (hasDiagramParts) {
            diagram.parts.forEach((p: any, idx: number) => {
              // Find matching internal key in registry
              let internalType = p.type;
              for (const [key, val] of Object.entries(registryData)) {
                if ((val as any).wokwiType === p.type) {
                  internalType = key;
                  break;
                }
              }

              // Look up BOM item
              const bomItem = (project.bom || []).find(b => 
                b.key.toLowerCase() === p.id.toLowerCase() || 
                b.key.toLowerCase() === p.type.toLowerCase() ||
                b.key.toLowerCase() === internalType.toLowerCase()
              );

              // Position conversion from Wokwi left/top to 3D X/Z coordinates
              const x = typeof p.left === "number" ? p.left / 10 : (idx % 3) * 15 - 15;
              const z = typeof p.top === "number" ? p.top / 10 : Math.floor(idx / 3) * 15 - 15;
              const y = 0.8;

              newNodes.push({
                id: p.id,
                type: internalType,
                position: [x, y, z],
                rotation: [0, 0, 0],
                attrs: p.attrs || {},
                pins: bomItem ? bomItem.pins : [],
                glbUrl: bomItem ? bomItem.glbUrl : ""
              });
            });
          } else if (project.bom && Array.isArray(project.bom)) {
            // Auto layout components from project.bom
            project.bom.forEach((b: any, idx: number) => {
              const x = (idx % 3) * 20 - 20;
              const z = Math.floor(idx / 3) * 20 - 20;
              const y = 0.8;

              newNodes.push({
                id: b.key,
                type: b.key,
                position: [x, y, z],
                rotation: [0, 0, 0],
                attrs: {},
                pins: b.pins || [],
                glbUrl: b.glbUrl || ""
              });
            });

            // Auto connect wires from project.wiring
            if (project.wiring && Array.isArray(project.wiring)) {
              project.wiring.forEach((w: any, idx: number) => {
                const fromStr = w.from;
                const toStr = w.to;
                const color = w.color || "green";

                if (fromStr && toStr) {
                  const [fromNode, fromPin] = fromStr.split(".");
                  const [toNode, toPin] = toStr.split(".");
                  if (fromNode && fromPin && toNode && toPin) {
                    newConnections.push({
                      id: `wire_${idx}_${Date.now()}`,
                      from: { nodeId: fromNode, pinId: fromPin },
                      to: { nodeId: toNode, pinId: toPin },
                      color
                    });
                  }
                }
              });
            }
          }

          // Load diagram connections if they exist and we didn't populate auto wires
          if (diagram && diagram.connections && Array.isArray(diagram.connections) && newConnections.length === 0) {
            diagram.connections.forEach((c: any, idx: number) => {
              const fromStr = c[0];
              const toStr = c[1];
              const color = c[2] || "green";

              if (fromStr && toStr) {
                const [fromNode, fromPin] = fromStr.split(":");
                const [toNode, toPin] = toStr.split(":");
                if (fromNode && fromPin && toNode && toPin) {
                  newConnections.push({
                    id: `wire_${idx}_${Date.now()}`,
                    from: { nodeId: fromNode, pinId: fromPin },
                    to: { nodeId: toNode, pinId: toPin },
                    color
                  });
                }
              }
            });
          }

          // Update store values
          useSimulatorStore.setState({
            nodes: newNodes,
            connections: newConnections,
            past: [],
            future: []
          });
        }
      } catch (err) {
        console.error("Failed to load project diagram in 3D simulator:", err);
      }
    };

    loadProject();
  }, [projectId]);

  // ??$$$ newer code — save diagram modifications back to backend
  const saveProjectDiagram = async () => {
    if (!projectId) return;
    setSaving(true);
    try {
      const diagram = {
        version: 1,
        author: "NOVA CORE",
        editor: "wokwi",
        parts: nodes.map(n => ({
          type: registry[n.type]?.wokwiType || n.type,
          id: n.id,
          top: n.position[2] * 10,
          left: n.position[0] * 10,
          attrs: n.attrs || {}
        })),
        connections: connections.map(c => [
          `${c.from.nodeId}:${c.from.pinId}`,
          `${c.to.nodeId}:${c.to.pinId}`,
          c.color || "green", []
        ])
      };

      await axiosInstance.put(`/project/${projectId}`, { diagram }, { withCredentials: true });
      toast.success("Circuit diagram successfully saved to project!");
    } catch (err) {
      console.error("Failed to save project diagram:", err);
      toast.error("Failed to save project diagram.");
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = (type) => {
    const id = `${type}_${Date.now()}`;
    addNode({ id, type, position: [0, 2, 0], rotation: [0, 0, 0], attrs: {} });
    useSimulatorStore.getState().setTransient({ selectedNodeId: id, mode: "IDLE" });
  };

  const exportDiagram = () => {
    const diagram = {
      version: 1,
      author: "NOVA CORE",
      editor: "wokwi",
      parts: nodes.map(n => ({
        type: registry[n.type]?.wokwiType || n.type,
        id: n.id,
        top: n.position[2] * 10,
        left: n.position[0] * 10,
        attrs: n.attrs || {}
      })),
      connections: connections.map(c => [
        `${c.from.nodeId}:${c.from.pinId}`,
        `${c.to.nodeId}:${c.to.pinId}`,
        c.color || "green", []
      ])
    };
    const blob = new Blob([JSON.stringify(diagram, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `circuit_${Date.now()}.json`;
    a.click();
  };

  const getDefForNode = (node) => {
    const COMPONENT_DEFS = {
      ARDUINO_UNO: { 
        name: "Arduino Uno", scale: 5, 
        pins: (registry.ARDUINO_UNO?.pins || [
          { name: "D13" }, { name: "GND" }, { name: "5V" }
        ]).map((p, i) => ({ 
          id: p.name, 
          pos: p.name === "GND" ? [2, 0.8, 8.2] : p.name === "5V" ? [1.2, 0.8, 8.2] : [-6.4 + i*0.8, 0.8, -8.2] 
        }))
      },
      LED: { name: "LED", scale: 3.3, pins: [{ id: "A", pos: [-0.66, -3.9, 0] }, { id: "C", pos: [0.66, -3.9, 0] }] },
      RESISTOR: { name: "Resistor", scale: 3, pins: [{ id: "1", pos: [-1.5, 0, 0] }, { id: "2", pos: [1.5, 0, 0] }] }
    };

    if (COMPONENT_DEFS[node.type]) {
      return COMPONENT_DEFS[node.type];
    }

    // Dynamic resolution based on node.pins (from MongoDB)
    const nodePins = node.pins || [];
    const mappedPins = nodePins.map((p, i) => {
      if (p.modelPosition) {
        return { id: p.id || p.name, pos: [p.modelPosition.x, p.modelPosition.y, p.modelPosition.z] };
      }
      if (typeof p.x_mm === "number" || typeof p.y_mm === "number") {
        const x = (p.x_mm || 0) * 0.2;
        const z = (p.y_mm || 0) * 0.2;
        const y = (p.z_mm || 0) * 0.2 + 0.5;
        return { id: p.id || p.name, pos: [x, y, z] };
      }
      return { id: p.id || p.name, pos: [-4 + i * 1.5, 0.5, 0] };
    });

    return {
      name: node.type.replace(/_/g, " "),
      scale: node.glbUrl ? 1 : 3,
      pins: mappedPins.length > 0 ? mappedPins : [
        { id: "1", pos: [-1.5, 0.5, 0] },
        { id: "2", pos: [1.5, 0.5, 0] }
      ]
    };
  };

  return (
    <div className={`h-screen w-full flex overflow-hidden ${isDark ? "bg-[#050505] text-white" : "bg-[#f5f5f5] text-black"}`}>
      
      {/* Sidebar - Propagation Protected */}
      <div className={`w-85 flex flex-col border-r z-30 ${isDark ? "bg-[#0d0d0d] border-white/5" : "bg-white border-black/5"}`} onClick={(e) => e.stopPropagation()}>
        <div className="p-8 border-b border-white/5 flex items-center gap-4">
          <button onClick={() => navigate("/home")} className="p-2.5 hover:bg-white/5 rounded-2xl border border-white/5"><ArrowLeft className="w-5 h-5"/></button>
          <h1 className="font-black text-2xl tracking-tighter italic uppercase underline decoration-blue-500">NOVA<span className="text-blue-500">CORE</span></h1>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
          <div className="p-4 bg-blue-600/10 border border-blue-500/20 rounded-2xl flex items-center gap-4 mb-4">
            <div className={`w-3 h-3 rounded-full ${mode === "IDLE" ? "bg-green-500" : "bg-yellow-500 animate-pulse"}`} />
            <span className="text-[10px] font-black uppercase tracking-widest">{mode} ENGINE</span>
          </div>

          <section className="space-y-3">
            <h3 className="text-[9px] font-black uppercase tracking-widest text-gray-500">Project BOM Components</h3>
            <div className="grid grid-cols-1 gap-2">
              {projectBom.map((item) => (
                <div key={item.key} className="flex flex-col p-4 rounded-2xl border border-white/5 bg-white/5 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-400">{item.displayName}</span>
                    <span className="text-[8px] bg-white/10 px-1.5 py-0.5 rounded text-gray-400">Qty: {item.qty}</span>
                  </div>
                  <p className="text-[8px] text-gray-400 leading-tight">{item.purpose}</p>
                  <button 
                    onClick={() => {
                      const id = `${item.key}_${Date.now()}`;
                      addNode({ 
                        id, 
                        type: item.key, 
                        position: [0, 2, 0], 
                        rotation: [0, 0, 0], 
                        attrs: {},
                        pins: item.pins || [],
                        glbUrl: item.glbUrl || ""
                      });
                      useSimulatorStore.getState().setTransient({ selectedNodeId: id, mode: "IDLE" });
                    }} 
                    className="flex items-center justify-center gap-2 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[9px] font-black uppercase text-blue-400 hover:bg-blue-500/20 transition"
                  >
                    <Plus className="w-3 h-3"/> Place in Scene
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={undo} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold uppercase hover:bg-white/10 transition shadow-xl"><Undo2 className="w-3 h-3"/> Undo</button>
              <button onClick={redo} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold uppercase hover:bg-white/10 transition shadow-xl"><Redo2 className="w-3 h-3"/> Redo</button>
            </div>
            {/* ??$$$ newer code — project save action button */}
            {projectId && (
              <button 
                onClick={saveProjectDiagram} 
                disabled={saving}
                className="w-full py-3.5 flex items-center justify-center gap-2 text-[10px] font-black uppercase text-emerald-400 hover:text-emerald-300 transition bg-emerald-500/10 border border-emerald-500/20 rounded-xl disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? "Saving..." : "Save Project Circuit"}
              </button>
            )}
            <button onClick={resetCircuit} className="w-full py-3 text-[9px] font-black uppercase text-red-500/30 hover:text-red-500 transition border border-red-500/10 rounded-xl">Hard Reset</button>
          </section>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="flex-1 relative">
        <InteractionManager />
        <Canvas dpr={[1, 1.5]} onPointerMissed={() => useSimulatorStore.getState().setTransient({ selectedNodeId: null, mode: "IDLE" })}>
          <PerspectiveCamera makeDefault position={[100, 100, 100]} fov={35} />
          <ambientLight intensity={1.5} />
          <pointLight position={[50, 100, 50]} intensity={2.5} />
          
          <Suspense fallback={null}>
            {nodes.map(node => (
              <DraggableComponent 
                key={node.id} 
                {...node} 
                ref={el => nodeRefs[node.id] = el}
                def={getDefForNode(node)}
                isSelected={selectedNodeId === node.id} 
              />
            ))}
            <Wires />
            <Environment preset="city" />
            <Grid infiniteGrid fadeDistance={250} fadeStrength={5} sectionSize={5} sectionColor="#444" cellColor="#222" />
          </Suspense>

          <OrbitControls 
            ref={orbitRef} 
            makeDefault 
            enabled={mode === "IDLE" || (mode === "WIRING" && !selectedNodeId)} 
            minDistance={10} 
            maxDistance={1000} 
            enableDamping 
          />
          <GizmoHelper alignment="bottom-right" margin={[100, 100]}><GizmoViewport /></GizmoHelper>
        </Canvas>

        {/* HUD Controls - Propagation Protected */}
        <div className="absolute top-10 right-10 flex flex-col gap-4 items-end" onClick={(e) => e.stopPropagation()}>
          <div className="bg-black/90 backdrop-blur-3xl px-6 py-4 rounded-3xl border border-white/10 flex flex-col items-end gap-1 shadow-2xl">
            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2"><Cpu className="w-3 h-3"/> NOVA ENGINE</span>
            <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider">{nodes.length} Components | {connections.length} Wires</span>
          </div>
          
          <AnimatePresence>
            {selectedNodeId && (
              <motion.button initial={{x: 20, opacity: 0}} animate={{x: 0, opacity: 1}} exit={{x: 20, opacity: 0}} onClick={(e) => { e.stopPropagation(); useSimulatorStore.getState().deleteNode(selectedNodeId); }} className="p-4 bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl border border-red-500/30 transition shadow-2xl flex items-center gap-3 group">
                <Trash2 className="w-4 h-4 group-hover:scale-125 transition" />
                <span className="text-[10px] font-black uppercase">Destroy</span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Status HUD */}
        <AnimatePresence>
          {mode !== "IDLE" && (
            <motion.div initial={{y: 50, opacity: 0}} animate={{y: 0, opacity: 1}} exit={{y: 50, opacity: 0}} className="absolute bottom-24 left-1/2 -translate-x-1/2">
              <div className="bg-blue-600 text-white px-8 py-4 rounded-[2rem] shadow-2xl flex items-center gap-4 border border-white/20">
                <div className="animate-pulse bg-white/20 p-2 rounded-full"><Zap className="w-4 h-4"/></div>
                <span className="text-[10px] font-black uppercase tracking-widest">{mode} ACTIVE</span>
                <div className="w-px h-4 bg-white/20" />
                <span className="text-[8px] font-bold uppercase opacity-80">Press ESC to cancel</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Utility controls */}
        <div className="absolute bottom-10 left-10 flex gap-4" onClick={(e) => e.stopPropagation()}>
           <div className="flex flex-col gap-2">
             <button onClick={(e) => { e.stopPropagation(); orbitRef.current.object.position.multiplyScalar(0.8); orbitRef.current.update(); }} className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl border border-white/10 text-white shadow-xl transition"><ZoomIn className="w-5 h-5"/></button>
             <button onClick={(e) => { e.stopPropagation(); orbitRef.current.object.position.multiplyScalar(1.2); orbitRef.current.update(); }} className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl border border-white/10 text-white shadow-xl transition"><ZoomOut className="w-5 h-5"/></button>
           </div>
           <div className="flex flex-col gap-2">
             <button onClick={exportDiagram} title="Export diagram.json" className="p-3 bg-blue-600/20 hover:bg-blue-600 text-blue-500 hover:text-white rounded-xl border border-blue-500/20 transition shadow-xl"><Download className="w-5 h-5"/></button>
             <button title="Load Project" className="p-3 bg-white/10 hover:bg-white/20 rounded-xl border border-white/10 text-white shadow-xl transition"><Upload className="w-5 h-5"/></button>
           </div>
        </div>
      </div>
    </div>
  );
}

