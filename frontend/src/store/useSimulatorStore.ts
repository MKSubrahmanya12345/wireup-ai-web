// ??$$$ group 3 - Components BOM & Wiring (Phase 2), group 5 - Circuit Simulation (Phase 4)
// @ts-nocheck
// ??$$$ 3D Simulator Production State Store (Zustand) - Unified Interaction Model
import { create } from "zustand";
import * as THREE from "three";

const MAX_HISTORY = 50;

export const useSimulatorStore = create((set, get) => ({
  // --- Persistent State ---
  version: 1,
  nodes: [], 
  connections: [], 
  
  // --- History ---
  past: [],
  future: [],

  // ??$$$ NEW FLOW — Pin anchor registry: "nodeId:pinId" → THREE.Object3D
  pinAnchors: {},

  // --- Unified Interaction State ---
  transient: {
    mode: "IDLE", // "IDLE", "DRAGGING", "WIRING"
    dragId: null,
    selectedNodeId: null,
    activeWiringSource: null, 
    livePositions: {}, 
  },

  // --- Actions ---
  
  setTransient: (updates) => set((state) => ({ 
    transient: { ...state.transient, ...updates } 
  })),

  // ??$$$ NEW FLOW — Pin anchor management
  setPinAnchor: (key, obj) => set((state) => ({
    pinAnchors: { ...state.pinAnchors, [key]: obj }
  })),

  setPinAnchors: (anchors) => set((state) => ({
    pinAnchors: { ...state.pinAnchors, ...anchors }
  })),

  clearNodePinAnchors: (nodeId) => set((state) => {
    const updated = { ...state.pinAnchors };
    Object.keys(updated).forEach(key => {
      if (key.startsWith(`${nodeId}:`)) delete updated[key];
    });
    return { pinAnchors: updated };
  }),

  pushHistory: () => {
    const { nodes, connections, past } = get();
    const newPast = [...past, { nodes, connections }].slice(-MAX_HISTORY);
    set({ past: newPast, future: [] });
  },

  undo: () => {
    const { past, nodes, connections, future } = get();
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    set({
      nodes: prev.nodes,
      connections: prev.connections,
      past: past.slice(0, -1),
      future: [{ nodes, connections }, ...future].slice(0, MAX_HISTORY)
    });
  },

  redo: () => {
    const { past, nodes, connections, future } = get();
    if (future.length === 0) return;
    const next = future[0];
    set({
      nodes: next.nodes,
      connections: next.connections,
      past: [...past, { nodes, connections }].slice(-MAX_HISTORY),
      future: future.slice(1)
    });
  },

  addNode: (node) => {
    get().pushHistory();
    set((state) => ({ nodes: [...state.nodes, node] }));
  },

  moveNode: (id, position) => {
    set((state) => ({
      transient: {
        ...state.transient,
        livePositions: { ...state.transient.livePositions, [id]: position }
      }
    }));
  },

  commitNodeMove: (id, position) => {
    const existing = get().nodes.find(n => n.id === id);
    if (!existing) return;
    
    // Check if position actually changed
    const d = Math.sqrt((existing.position[0]-position[0])**2 + (existing.position[2]-position[2])**2);
    if (d < 0.1) {
       // Just clear transient if didn't move much
       set(state => ({ transient: { ...state.transient, livePositions: { ...state.transient.livePositions, [id]: undefined } } }));
       return;
    }

    get().pushHistory();
    set((state) => ({
      nodes: state.nodes.map(n => n.id === id ? { ...n, position } : n),
      transient: {
        ...state.transient,
        livePositions: { ...state.transient.livePositions, [id]: undefined }
      }
    }));
  },

  deleteNode: (id) => {
    if (!id) return;
    get().pushHistory();
    set((state) => ({
      nodes: state.nodes.filter(n => n.id !== id),
      connections: state.connections.filter(c => c.from.nodeId !== id && c.to.nodeId !== id),
      transient: { ...state.transient, selectedNodeId: state.transient.selectedNodeId === id ? null : state.transient.selectedNodeId }
    }));
  },

  addConnection: (from, to, color = "green") => {
    if (from.nodeId === to.nodeId && from.pinId === to.pinId) return; 
    get().pushHistory();
    set((state) => ({
      connections: [...state.connections, { 
        id: `wire_${Date.now()}`, 
        from, 
        to, 
        color 
      }]
    }));
  },

  removeConnection: (id) => {
    get().pushHistory();
    set((state) => ({
      connections: state.connections.filter(c => c.id !== id)
    }));
  },

  resetCircuit: () => {
    get().pushHistory();
    set({ 
      nodes: [], 
      connections: [],
      pinAnchors: {},
      transient: { ...get().transient, selectedNodeId: null, livePositions: {} }
    });
  }
}));


