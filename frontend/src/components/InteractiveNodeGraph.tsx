// ??$$$ group 3 - Components BOM & Wiring (Phase 2)
// ??$$$ FORGE: InteractiveNodeGraph.tsx — Visual pin-routing canvas with drag-and-drop and phase filtering
import React, { useState, useEffect, useRef } from "react";
import { axiosInstance } from "../lib/axios";

// SVG Bezier path helper
const getBezierPath = (x1: number, y1: number, x2: number, y2: number) => {
  const dx = Math.abs(x2 - x1) * 0.5;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
};

const getPinName = (pin: any): string => {
  if (typeof pin === "string") return pin;
  if (pin && typeof pin === "object") return pin.name || pin.displayName || "";
  return "";
};

interface Pin {
  name: string;
  isLeft: boolean;
  yOffset: number;
}

interface NodeData {
  id: string;
  displayName: string;
  type: string;
  x: number;
  y: number;
  phase: string;
  pins: Pin[];
  isMCU: boolean;
}

interface InteractiveNodeGraphProps {
  projectId: string;
  bom: any[];
  diagram: any;
  selectedPhase: string;
  nodeCoordinates: Record<string, { x: number; y: number; rotate?: number }>;
  phases: Record<string, string>;
  onSave: (
    nodeCoordinates: Record<string, { x: number; y: number }>,
    bomPhases: Record<string, string>,
    connections: any[]
  ) => Promise<void>;
}

export const InteractiveNodeGraph: React.FC<InteractiveNodeGraphProps> = ({
  projectId,
  bom,
  diagram,
  selectedPhase,
  nodeCoordinates,
  phases,
  onSave,
}) => {
  const [registry, setRegistry] = useState<Record<string, any>>({});
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragStartOffset = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  // Active wiring state
  const [wiringStart, setWiringStart] = useState<{
    nodeId: string;
    pinName: string;
    x: number;
    y: number;
  } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // 1. Fetch component registry
  useEffect(() => {
    const fetchRegistry = async () => {
      try {
        const res = await axiosInstance.get("/components/registry");
        setRegistry(res.data || {});
      } catch (err) {
        console.error("Failed to load components registry:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRegistry();
  }, []);

  // 2. Parse nodes and connections from BOM and diagram
  useEffect(() => {
    if (loading || !bom) return;

    // Parse nodes
    const parsedNodes: NodeData[] = bom.map((item, index) => {
      const type = item.wokwiPartType || item.key;
      const regDef = registry[type] || registry[item.displayName] || {};
      const rawPins = regDef.pins || ["GND", "VCC", "SIG"];
      const isMCU =
        String(regDef.category || "").toLowerCase() === "controller" ||
        item.displayName.toLowerCase().includes("arduino") ||
        item.displayName.toLowerCase().includes("esp32") ||
        item.displayName.toLowerCase().includes("board");

      // Layout pins: left vs right columns
      const pins: Pin[] = rawPins.map((p: any, pIdx: number) => {
        const name = getPinName(p);
        // Distribute pins left vs right for clean node interface
        const isLeft = isMCU ? pIdx < rawPins.length / 2 : true;
        const yOffset = 50 + (isMCU ? (isLeft ? pIdx : pIdx - Math.ceil(rawPins.length / 2)) : pIdx) * 24;
        return { name, isLeft, yOffset };
      });

      // Retrieve persisted coordinates or fallback to grid positioning
      const savedCoord = nodeCoordinates?.[item.key];
      const cols = 4;
      const xGrid = (index % cols) * 240 + 80;
      const yGrid = Math.floor(index / cols) * 280 + 100;

      return {
        id: item.key,
        displayName: item.displayName || item.key,
        type,
        x: savedCoord ? savedCoord.x : xGrid,
        y: savedCoord ? savedCoord.y : yGrid,
        phase: item.phase || "PHASE_1",
        pins,
        isMCU,
      };
    });

    setNodes(parsedNodes);

    // Parse connections
    const diagramConnections = diagram?.connections || [];
    setConnections(diagramConnections);
  }, [bom, diagram, nodeCoordinates, registry, loading]);

  // ??$$$ newer code: Robust global window event listeners for node dragging
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!draggingNodeId || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setNodes((prev) =>
        prev.map((node) =>
          node.id === draggingNodeId
            ? {
                ...node,
                x: Math.max(0, x - dragStartOffset.current.x),
                y: Math.max(0, y - dragStartOffset.current.y),
              }
            : node
        )
      );
    };

    const handleGlobalMouseUp = () => {
      setDraggingNodeId(null);
    };

    if (draggingNodeId) {
      window.addEventListener("mousemove", handleGlobalMouseMove);
      window.addEventListener("mouseup", handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [draggingNodeId]);

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!wiringStart || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });
  };

  const handleNodeDragStart = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    dragStartOffset.current = {
      x: canvasX - node.x,
      y: canvasY - node.y,
    };
    setDraggingNodeId(nodeId);
  };

  // Convert phase string keys to comparison indexes (e.g. PHASE_2 -> 2)
  const getPhaseIndex = (phaseKey: string) => {
    return parseInt(phaseKey.replace(/\D/g, "")) || 1;
  };

  const currentPhaseIndex = getPhaseIndex(selectedPhase);

  // Active / Visible Nodes in current phase scope
  const visibleNodes = nodes.filter((node) => getPhaseIndex(node.phase) <= currentPhaseIndex);
  const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));

  // Connections are active if both endpoints are visible in current phase scope
  const visibleConnections = connections.filter((conn) => {
    if (!Array.isArray(conn) || conn.length < 2) return false;
    const fromId = String(conn[0]).split(":")[0];
    const toId = String(conn[1]).split(":")[0];
    return visibleNodeIds.has(fromId) && visibleNodeIds.has(toId);
  });

  // ??$$$ newer code: Calculate pin visual coordinates (precisely aligned with the center of terminal dots)
  const getPinCoords = (nodeId: string, pinName: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };
    const pin = node.pins.find((p) => p.name === pinName);
    if (!pin) return { x: node.x + 100, y: node.y + 50 };

    const nodeWidth = 200;
    const x = pin.isLeft ? node.x + 13 : node.x + nodeWidth - 13;
    const y = node.y + pin.yOffset - 10;
    return { x, y };
  };

  // Handle wiring interactions
  const handlePinClick = (e: React.MouseEvent, nodeId: string, pinName: string) => {
    e.stopPropagation();
    const coords = getPinCoords(nodeId, pinName);

    if (!wiringStart) {
      setWiringStart({ nodeId, pinName, x: coords.x, y: coords.y });
      setMousePos(coords);
    } else {
      // Connect wires
      if (wiringStart.nodeId === nodeId) {
        // Cannot connect to same node
        setWiringStart(null);
        return;
      }

      const fromTerminal = `${wiringStart.nodeId}:${wiringStart.pinName}`;
      const toTerminal = `${nodeId}:${pinName}`;

      // Check if wire already exists
      const exists = connections.some(
        (c) =>
          (c[0] === fromTerminal && c[1] === toTerminal) ||
          (c[0] === toTerminal && c[1] === fromTerminal)
      );

      if (!exists) {
        // Color heuristic
        let color = "blue";
        const pinLower = pinName.toLowerCase();
        const startPinLower = wiringStart.pinName.toLowerCase();
        if (pinLower.includes("gnd") || startPinLower.includes("gnd")) color = "black";
        else if (pinLower.includes("5v") || startPinLower.includes("5v") || pinLower.includes("vcc") || startPinLower.includes("vcc") || pinLower.includes("3.3v") || startPinLower.includes("3.3v")) color = "red";
        else if (pinLower.includes("sda") || startPinLower.includes("sda") || pinLower.includes("scl") || startPinLower.includes("scl")) color = "orange";
        else if (pinLower.includes("tx") || startPinLower.includes("tx") || pinLower.includes("rx") || startPinLower.includes("rx")) color = "green";

        const newConn = [fromTerminal, toTerminal, color, []];
        setConnections((prev) => [...prev, newConn]);
      }

      setWiringStart(null);
    }
  };

  const handleRemoveConnection = (idx: number) => {
    setConnections((prev) => prev.filter((_, i) => i !== idx));
  };

  const handlePhaseChange = (nodeId: string, newPhase: string) => {
    setNodes((prev) =>
      prev.map((node) => (node.id === nodeId ? { ...node, phase: newPhase } : node))
    );
  };

  const handleSaveWiring = async () => {
    const coordsMap = Object.fromEntries(
      nodes.map((node) => [node.id, { x: node.x, y: node.y }])
    );
    const phasesMap = Object.fromEntries(
      nodes.map((node) => [node.id, node.phase])
    );
    await onSave(coordsMap, phasesMap, connections);
  };

  const handleResetLayout = () => {
    setNodes((prev) =>
      prev.map((node, index) => {
        const cols = 4;
        const xGrid = (index % cols) * 240 + 80;
        const yGrid = Math.floor(index / cols) * 280 + 100;
        return {
          ...node,
          x: xGrid,
          y: yGrid,
        };
      })
    );
  };

  if (loading) {
    return (
      <div className="flex h-[500px] items-center justify-center bg-[#0d0e12] text-zinc-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
          <span>Loading component definitions...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-full bg-[#0d0e12] rounded-xl border border-zinc-800 overflow-hidden shadow-2xl">
      {/* Canvas Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-[#13141b] border-b border-zinc-800">
        <div>
          <h3 className="text-sm font-semibold text-white">Visual Wiring Board</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Drag components and connect matching pins to design your circuit schematics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleResetLayout}
            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white bg-[#1e2030] hover:bg-[#25283c] rounded-md transition-all font-medium"
          >
            Reset Positions
          </button>
          <button
            onClick={handleSaveWiring}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded-md shadow-lg shadow-orange-950/20 transition-all"
          >
            Save Schema & Connections
          </button>
        </div>
      </div>

      {/* Editor Canvas Area */}
      <div
        ref={canvasRef}
        onMouseMove={handleCanvasMouseMove}
        className="relative flex-1 min-h-[550px] overflow-hidden select-none bg-[radial-gradient(#1e2030_1px,transparent_1px)] [background-size:20px_20px]"
        onClick={() => setWiringStart(null)}
      >
        {/* SVG wires layer */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
          {/* Temporary wire drawing */}
          {wiringStart && (
            <path
              d={getBezierPath(wiringStart.x, wiringStart.y, mousePos.x, mousePos.y)}
              stroke="#ff7a00"
              strokeWidth="2.5"
              strokeDasharray="4 4"
              fill="none"
            />
          )}

          {/* Rendered connections */}
          {visibleConnections.map((conn, idx) => {
            const [fromTerminal, toTerminal, color] = conn;
            const [fromId, fromPin] = fromTerminal.split(":");
            const [toId, toPin] = toTerminal.split(":");

            const fromCoords = getPinCoords(fromId, fromPin);
            const toCoords = getPinCoords(toId, toPin);

            let strokeColor = "#3b82f6"; // default blue
            if (color === "black") strokeColor = "#18181b"; // ground
            else if (color === "red") strokeColor = "#ef4444"; // power
            else if (color === "orange") strokeColor = "#f97316";
            else if (color === "green") strokeColor = "#22c55e";

            return (
              <g key={idx} className="pointer-events-auto group">
                // ??$$$ newer code
                <path
                  d={getBezierPath(fromCoords.x, fromCoords.y, toCoords.x, toCoords.y)}
                  stroke={strokeColor}
                  strokeWidth="3"
                  fill="none"
                  className="cursor-pointer hover:stroke-rose-500 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveConnection(idx);
                  }}
                >
                  <title>Click to remove connection</title>
                </path>
                {/* Visual glow on hover */}
                <path
                  d={getBezierPath(fromCoords.x, fromCoords.y, toCoords.x, toCoords.y)}
                  stroke={strokeColor}
                  strokeWidth="8"
                  strokeOpacity="0"
                  fill="none"
                  className="cursor-pointer hover:stroke-rose-500/20 transition-all duration-150"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveConnection(idx);
                  }}
                />
              </g>
            );
          })}
        </svg>

        {/* Node Cards */}
        {visibleNodes.map((node) => {
          const maxPinsInColumn = node.isMCU
            ? Math.ceil(node.pins.length / 2)
            : node.pins.length;
          const nodeHeight = 65 + maxPinsInColumn * 24;

          return (
            <div
              key={node.id}
              style={{
                left: `${node.x}px`,
                top: `${node.y}px`,
                height: `${nodeHeight}px`,
              }}
              className={`absolute w-[200px] rounded-lg border text-white z-20 shadow-xl overflow-hidden ${
                node.isMCU
                  ? "bg-gradient-to-b from-[#2b1c12] to-[#17100b] border-orange-500/40"
                  : "bg-gradient-to-b from-[#1c1d24] to-[#121318] border-zinc-800"
              }`}
            >
              {/* Node Header (draggable) */}
              <div
                onMouseDown={(e) => handleNodeDragStart(e, node.id)}
                className={`px-3 py-2 border-b cursor-grab flex items-center justify-between ${
                  node.isMCU ? "bg-orange-950/40 border-orange-500/20" : "bg-zinc-900/60 border-zinc-800"
                }`}
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-zinc-100 truncate">
                    {node.displayName}
                  </span>
                  <span className="text-[10px] text-zinc-500 truncate font-mono">
                    {node.type}
                  </span>
                </div>
              </div>

              {/* Node Body with pin terminals */}
              <div className="relative w-full h-full">
                {node.pins.map((pin) => (
                  <div
                    key={pin.name}
                    style={{ top: `${pin.yOffset - 16}px` }}
                    className={`absolute flex items-center gap-1.5 px-2 text-[10px] font-mono leading-none ${
                      pin.isLeft ? "left-0 flex-row" : "right-0 flex-row-reverse"
                    }`}
                  >
                    {/* Circle terminal dot */}
                    <button
                      onClick={(e) => handlePinClick(e, node.id, pin.name)}
                      className={`h-2.5 w-2.5 rounded-full border border-zinc-900 transition-all ${
                        wiringStart?.nodeId === node.id && wiringStart?.pinName === pin.name
                          ? "bg-orange-500 scale-125 ring-2 ring-orange-500/50"
                          : "bg-zinc-700 hover:bg-orange-500 hover:scale-110"
                      }`}
                    />
                    <span className="text-zinc-400 select-none">{pin.name}</span>
                  </div>
                ))}
              </div>

              {/* Node Footer for Phase selector */}
              <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-black/40 border-t border-zinc-800/40 flex items-center justify-between text-[9px] text-zinc-400">
                <span>Phase:</span>
                <select
                  value={node.phase}
                  onChange={(e) => handlePhaseChange(node.id, e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 text-zinc-300 rounded px-1 py-0.5 focus:outline-none focus:border-orange-500"
                >
                  {Object.keys(phases || {}).map((phaseKey) => (
                    <option key={phaseKey} value={phaseKey}>
                      {phaseKey.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
