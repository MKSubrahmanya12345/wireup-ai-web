# Codebase Context: Simulation, Compilation, & Formulation Pipeline

This document provides full contents and architectural context for the simulator integration files.

---

## 1. File Contents

### File: `frontend/src/components/sim/Avr8jsRunner.ts`
```typescript
// ??$$$ group 5 - Circuit Simulation (Phase 4)
// @ts-nocheck
import { CPU, avrInstruction, AVRIOPort, portAConfig, portBConfig, portCConfig, portDConfig, portEConfig, portFConfig, portGConfig, portHConfig, portJConfig, portKConfig, portLConfig, AVRTimer, timer0Config, AVRUSART, usart0Config } from 'avr8js';

// ??$$$ Newer code for browser-safe Intel HEX parser
export function parseIntelHex(hexString) {
  const mem = new Uint8Array(256 * 1024); // Mega has 256KB
  for (const line of hexString.split('\n')) {
    const l = line.trim();
    if (!l.startsWith(':')) continue;
    const byteCount = parseInt(l.substring(1, 3), 16);
    const address = parseInt(l.substring(3, 7), 16);
    const recType = parseInt(l.substring(7, 9), 16);
    if (recType === 0) {
      for (let i = 0; i < byteCount; i++) {
        mem[address + i] = parseInt(l.substring(9 + i * 2, 11 + i * 2), 16);
      }
    }
  }
  return mem;
}

export function startAvr8jsRun(opts) {
  const { hex, diagram, onPartStateBatch, onSerialLine, onLog } = opts;

  const bytes = parseIntelHex(hex);
  const program = new Uint16Array(128 * 1024); // Mega has 128K words
  for (let i = 0; i < bytes.length; i += 2) program[i >> 1] = bytes[i] | (bytes[i + 1] << 8);
  const cpu = new CPU(program);

  new AVRTimer(cpu, timer0Config);
  const portA = new AVRIOPort(cpu, portAConfig);
  const portB = new AVRIOPort(cpu, portBConfig);
  const portC = new AVRIOPort(cpu, portCConfig);
  const portD = new AVRIOPort(cpu, portDConfig);
  const portE = new AVRIOPort(cpu, portEConfig);
  const portF = new AVRIOPort(cpu, portFConfig);
  const portG = new AVRIOPort(cpu, portGConfig);
  const portH = new AVRIOPort(cpu, portHConfig);
  const portJ = new AVRIOPort(cpu, portJConfig);
  const portK = new AVRIOPort(cpu, portKConfig);
  const portL = new AVRIOPort(cpu, portLConfig);

  // ??$$$ Expanded Mega pin mapping (partial for now)
  const megaPins = {
    '13': { port: portB, bit: 7 }, // Mega Pin 13 is PB7
    '12': { port: portB, bit: 6 },
    '11': { port: portB, bit: 5 },
    '10': { port: portB, bit: 4 },
    '9': { port: portH, bit: 6 }, // Simplified, portH not yet defined
    '8': { port: portH, bit: 5 },
    'A0': { port: portF, bit: 0 }, // Simplified, portF not yet defined
    'A1': { port: portF, bit: 1 },
  };

  // For now, let's stick to a basic mapping that works with the existing avr8js configs
  // We'll map 'mega:13' to PB7, etc.
  const pinMapping = {
    '13': { port: portB, bit: 7 },
    '12': { port: portB, bit: 6 },
    '11': { port: portB, bit: 5 },
    '10': { port: portB, bit: 4 },
    '9': { port: portH, bit: 6 },
    '8': { port: portH, bit: 5 },
    '7': { port: portH, bit: 4 },
    '6': { port: portH, bit: 3 },
    '5': { port: portE, bit: 3 },
    '4': { port: portG, bit: 5 },
    '3': { port: portE, bit: 5 },
    '2': { port: portE, bit: 4 },
    '1': { port: portE, bit: 1 },
    '0': { port: portE, bit: 0 },
    'A0': { port: portF, bit: 0 },
    'A1': { port: portF, bit: 1 },
    'A2': { port: portF, bit: 2 },
    'A3': { port: portF, bit: 3 },
  };

  const portAListeners = [];
  const portBListeners = [];
  const portCListeners = [];
  const portDListeners = [];
  const portEListeners = [];
  const portFListeners = [];
  const portGListeners = [];
  const portHListeners = [];
  const portJListeners = [];
  const portKListeners = [];
  const portLListeners = [];

  const stateUpdates = {};
  let stateChanged = false;
  const updatePartState = (partId, updates) => {
    stateUpdates[partId] = { ...(stateUpdates[partId] || {}), ...updates };
    stateChanged = true;
  };

  diagram.connections.forEach(conn => {
    const [p1, p2] = conn;
    // Handle both 'mega:13' and 'uno:13' for compatibility
    const megaSrc = (p1.startsWith('mega:') || p1.startsWith('uno:')) ? p1.split(':')[1] : 
                   ((p2.startsWith('mega:') || p2.startsWith('uno:')) ? p2.split(':')[1] : null);
    const dest = (p1.startsWith('mega:') || p1.startsWith('uno:')) ? p2 : 
                 ((p2.startsWith('mega:') || p2.startsWith('uno:')) ? p1 : null);

    if (megaSrc && dest) {
      const [destId, destPin] = dest.split(':');
      const pinDef = pinMapping[megaSrc];
      if (pinDef) {
        if (destPin === 'A' || destPin === '1' || destPin === 'SIG') {
          const listener = () => {
            const val = pinDef.port.pinState(pinDef.bit) === 1;
            updatePartState(destId, { value: val });
          };
          if (pinDef.port === portA) portAListeners.push(listener);
          if (pinDef.port === portB) portBListeners.push(listener);
          if (pinDef.port === portC) portCListeners.push(listener);
          if (pinDef.port === portD) portDListeners.push(listener);
          if (pinDef.port === portE) portEListeners.push(listener);
          if (pinDef.port === portF) portFListeners.push(listener);
          if (pinDef.port === portG) portGListeners.push(listener);
          if (pinDef.port === portH) portHListeners.push(listener);
          if (pinDef.port === portJ) portJListeners.push(listener);
          if (pinDef.port === portK) portKListeners.push(listener);
          if (pinDef.port === portL) portLListeners.push(listener);
        }
      }
    }
  });

  portA.addListener(() => portAListeners.forEach(fn => fn()));
  portB.addListener(() => portBListeners.forEach(fn => fn()));
  portC.addListener(() => portCListeners.forEach(fn => fn()));
  portD.addListener(() => portDListeners.forEach(fn => fn()));
  portE.addListener(() => portEListeners.forEach(fn => fn()));
  portF.addListener(() => portFListeners.forEach(fn => fn()));
  portG.addListener(() => portGListeners.forEach(fn => fn()));
  portH.addListener(() => portHListeners.forEach(fn => fn()));
  portJ.addListener(() => portJListeners.forEach(fn => fn()));
  portK.addListener(() => portKListeners.forEach(fn => fn()));
  portL.addListener(() => portLListeners.forEach(fn => fn()));

  const serialBuf = { current: '' };
  let serialIdx = 0;

  const usart = new AVRUSART(cpu, usart0Config, 16e6);
  usart.onByteTransmit = (byte) => {
    const ch = String.fromCharCode(byte);
    if (ch === '\n') {
      const line = serialBuf.current;
      serialBuf.current = '';
      const now = new Date();
      const ts = now.toLocaleTimeString('en-US', { hour12: false }) + '.' + String(now.getMilliseconds()).padStart(3, '0');
      onSerialLine({ text: line, timestamp: ts, idx: serialIdx++ });
    } else if (ch !== '\r') {
      serialBuf.current += ch;
    }
  };

  onLog('Simulation running (Mega mode)...');

  let stopped = false;
  let rafId = null;

  const tick = () => {
    if (stopped) return;
    for (let i = 0; i < 50000; i++) {
      avrInstruction(cpu);
      cpu.tick();
    }

    if (stateChanged) {
      onPartStateBatch({ ...stateUpdates });
      for (const key in stateUpdates) delete stateUpdates[key];
      stateChanged = false;
    }

    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);

  return {
    stop: () => {
      stopped = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      onLog('Simulation stopped.');
    },
  };
}
```

---

### File: `frontend/src/components/sim/SimulatorWorkspace.tsx`
```typescript
// ??$$$ group 5 - Circuit Simulation (Phase 4)
// @ts-nocheck
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { 
  Play, Square, Loader2, Code2, Cpu, Wifi, Move, Plus, Braces, Terminal, 
  ChevronRight, ChevronLeft, FolderTree, Save, RotateCcw, X 
} from 'lucide-react';
import '@wokwi/elements';

import ComponentLibrary from './ComponentLibrary';
import LibraryManager from './LibraryManager';
import DiagramViewer from './DiagramViewer';
import SerialMonitor from './SerialMonitor';

import { loadDiagram, loadLibraries, loadSketch, saveDiagram, saveLibraries, saveSketch, resetDiagramStorage } from './diagramStorage';
import { WirePreview } from './WirePreview';
import { SimCanvas } from './SimCanvas';
import { startAvr8jsRun } from './Avr8jsRunner';
import { CodeEditor } from './CodeEditor';

const WIRE_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#a855f7', '#06b6d4', '#f97316'];

export default function SimulatorWorkspace({ 
  projectId, 
  projectPath, 
  tree, 
  onFileSelect, 
  selectedFilePath,
  embedded = false 
}) {
  const [code, setCode] = useState(() => loadSketch() || '');
  const [isCompiling, setCompiling] = useState(false);
  const [isRunning, setRunning] = useState(false);
  const [log, setLog] = useState('Ready. Sketchpad initialized.');
  const [partStates, setPartStates] = useState({});
  const [diagram, setDiagram] = useState(loadDiagram);
  const [libraries, setLibraries] = useState(loadLibraries);
  
  // UI State
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editorOpen, setEditorOpen] = useState(true);
  const [libOpen, setLibOpen] = useState(false);
  const [libMgrOpen, setLibMgrOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [serialOpen, setSerialOpen] = useState(false);

  const [serialLines, setSerialLines] = useState([]);
  const [wiringFrom, setWiringFrom] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const apiBaseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

  const runHandleRef = useRef(null);

  const stopSim = useCallback(() => {
    if (runHandleRef.current) {
      runHandleRef.current.stop();
      runHandleRef.current = null;
    }
    setRunning(false);
    setPartStates({});
    setLog('Simulation stopped.');
  }, []);

  useEffect(() => () => stopSim(), [stopSim]);
  useEffect(() => { if (code) saveSketch(code); }, [code]);
  useEffect(() => { saveLibraries(libraries); }, [libraries]);

  useEffect(() => {
    if (!wiringFrom) return;
    const handler = (e) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, [wiringFrom]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setWiringFrom(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handlePinClick = useCallback((partId, pin, screenX, screenY) => {
    if (!wiringFrom) {
      setWiringFrom({ partId, pin, screenX, screenY });
      setLog('Wiring ' + partId + ':' + pin + ' — click another pin. Esc to cancel.');
      return;
    }

    if (wiringFrom.partId === partId && wiringFrom.pin === pin) { setWiringFrom(null); return; }
    const color = WIRE_COLORS[diagram.connections.length % WIRE_COLORS.length];
    const conn = [
      wiringFrom.partId + ':' + wiringFrom.pin,
      partId + ':' + pin,
      color,
      [],
    ];
    setDiagram(prev => {
      const next = { ...prev, connections: [...prev.connections, conn] };
      saveDiagram(next);
      return next;
    });
    setWiringFrom(null);
    setLog('Wire added.');
  }, [wiringFrom, diagram.connections.length]);

  const handleDragEnd = useCallback((id, top, left) => {
    setDiagram(prev => {
      const next = { ...prev, parts: prev.parts.map(p => p.id === id ? { ...p, top, left } : p) };
      saveDiagram(next);
      return next;
    });
  }, []);

  const addPart = useCallback((type, attrs) => {
    setDiagram(prev => {
      const count = prev.parts.filter(p => p.type === type).length;
      const baseId = type.replace('wokwi-', '').replace(/-/g, '');
      const id = baseId + (count + 1);
      const spread = count * 40;
      const next = { ...prev, parts: [...prev.parts, { type, id, top: spread, left: spread, attrs }] };
      saveDiagram(next);
      return next;
    });
  }, []);

  const deletePart = useCallback((id) => {
    setDiagram(prev => {
      const next = {
        ...prev,
        parts: prev.parts.filter(p => p.id !== id),
        connections: prev.connections.filter(c => !c[0].startsWith(id + ':') && !c[1].startsWith(id + ':')),
      };
      saveDiagram(next);
      return next;
    });
  }, []);

  const resetLayout = () => {
    if (confirm('Reset canvas to default?')) {
      resetDiagramStorage();
      setDiagram(loadDiagram());
    }
  };

  const handleDiagramEdit = useCallback((raw) => {
    if (!Array.isArray(raw.parts) || !Array.isArray(raw.connections)) return;
    saveDiagram(raw);
    setDiagram(raw);
  }, []);

  const runSim = async () => {
    stopSim();
    setSerialLines([]);
    setSerialOpen(true);
    setCompiling(true);
    setLog('Compiling project...');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBaseUrl}/wokwi/local/compile-hex`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          projectId,
          projectPath,
          sketchCode: code,
          diagramJson: diagram,
          fqbn: 'arduino:avr:mega'
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setLog('Error: ' + (data.error || data.stderr || 'Compile failed'));
        setCompiling(false);
        return;
      }
      const hex = data.hex;
      if (!hex) { setLog('Compile failed: missing HEX'); setCompiling(false); return; }

      setLog('Running simulation...');
      runHandleRef.current = startAvr8jsRun({
        hex,
        diagram,
        onLog: setLog,
        onSerialLine: (line) => setSerialLines(prev => [...prev, line]),
        onPartStateBatch: (updates) => {
          setPartStates(prev => {
            const next = { ...prev };
            for (const [id, u] of Object.entries(updates)) next[id] = { ...(next[id] || {}), ...u };
            return next;
          });
        },
      });

      setCompiling(false);
      setRunning(true);
    } catch (e) {
      setLog('Error: ' + e.message);
      setCompiling(false);
    }
  };

  // Render Explorer Tree
  const renderTree = (nodes, depth = 0) => {
    if (!nodes) return null;
    return nodes.map((node) => {
      const isDir = node.type === 'directory';
      const isSelected = selectedFilePath === node.path;
      
      return (
        <div key={node.path}>
          <button
            onClick={() => !isDir && onFileSelect(node.path)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors ${
              isSelected ? 'bg-indigo-500/20 text-indigo-300' : 'text-neutral-400 hover:bg-white/5'
            }`}
            style={{ paddingLeft: `${depth * 12 + 12}px` }}
          >
            {isDir ? <FolderTree className="h-3 w-3 text-neutral-600" /> : <div className="w-3 h-3 border border-neutral-700 rounded-sm" />}
            <span className="truncate">{node.name}</span>
          </button>
          {isDir && renderTree(node.children, depth + 1)}
        </div>
      );
    });
  };

  return (
    <div className="relative w-full h-full bg-[#1a1a1a] text-neutral-100 font-sans overflow-hidden">
      {/* Background Sketchpad Grid */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle, #444 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

      {wiringFrom && (
        <WirePreview
          fromX={wiringFrom.screenX}
          fromY={wiringFrom.screenY}
          toX={mousePos.x}
          toY={mousePos.y}
          color={WIRE_COLORS[diagram.connections.length % WIRE_COLORS.length]}
        />
      )}

      {/* Full Screen Canvas (Sketchpad) */}
      <div className="absolute inset-0 z-0">
        <TransformWrapper initialScale={0.8} minScale={0.1} maxScale={5} centerOnInit>
          <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }}>
            <SimCanvas 
              diagram={diagram} 
              partStates={partStates} 
              wiringFrom={wiringFrom} 
              onDragEnd={handleDragEnd} 
              onDelete={deletePart} 
              onPinClick={handlePinClick} 
            />
          </TransformComponent>
        </TransformWrapper>
      </div>

      {/* Floating Toolbar (Top Center) */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 p-1.5 rounded-2xl bg-neutral-900/60 backdrop-blur-2xl border border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all">
        <div className="flex items-center gap-3 px-4 mr-2 border-r border-white/5">
          <div className={`h-2 w-2 rounded-full ${isRunning ? 'bg-emerald-400 shadow-[0_0_10px_#34d399] animate-pulse' : 'bg-neutral-600'}`} />
          <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">{isRunning ? 'Running' : 'Idle'}</span>
        </div>

        <button 
          onClick={isRunning ? stopSim : runSim} 
          disabled={isCompiling}
          className={`group flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${
            isRunning 
              ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 ring-1 ring-red-500/30' 
              : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.4)]'
          }`}
        >
          {isCompiling ? <Loader2 className="h-4 w-4 animate-spin" /> : isRunning ? <Square className="h-4 w-4" fill="currentColor" /> : <Play className="h-4 w-4" fill="currentColor" />}
          <span>{isCompiling ? 'Compiling' : isRunning ? 'Stop' : 'Deploy'}</span>
        </button>

        <button onClick={() => setLibOpen(true)} className="flex items-center justify-center h-9 w-9 rounded-xl hover:bg-white/10 text-neutral-300 transition-all" title="Add Component">
          <Plus className="h-4 w-4" />
        </button>
        <button onClick={() => setSerialOpen(true)} className="relative flex items-center justify-center h-9 w-9 rounded-xl hover:bg-white/10 text-neutral-300 transition-all" title="Serial Monitor">
          <Terminal className="h-4 w-4" />
          {serialLines.length > 0 && <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_#10b981]" />}
        </button>
        <button onClick={() => setJsonOpen(true)} className="flex items-center justify-center h-9 w-9 rounded-xl hover:bg-white/10 text-neutral-300 transition-all" title="View Diagram JSON">
          <Braces className="h-4 w-4" />
        </button>
        <button onClick={resetLayout} className="flex items-center justify-center h-9 w-9 rounded-xl hover:bg-white/10 text-neutral-300 transition-all" title="Reset Layout">
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      {/* Project Explorer (Floating Sidebar Left) */}
      <div className={`absolute top-24 bottom-24 left-6 z-40 flex flex-col w-64 rounded-3xl bg-neutral-900/60 backdrop-blur-2xl border border-white/5 shadow-2xl transition-all duration-500 ${sidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-[calc(100%+24px)] opacity-0'}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <FolderTree className="h-4 w-4 text-indigo-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-white">Project</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="text-neutral-500 hover:text-white transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-3 scrollbar-hide">
          {tree ? renderTree(tree.children) : (
            <div className="px-6 py-10 text-center text-[11px] text-neutral-600">No project loaded</div>
          )}
        </div>
      </div>
      {!sidebarOpen && (
        <button onClick={() => setSidebarOpen(true)} className="absolute top-1/2 -translate-y-1/2 left-0 z-40 h-16 w-6 rounded-r-xl bg-neutral-900/80 backdrop-blur-md border border-l-0 border-white/5 flex items-center justify-center text-neutral-400 hover:text-white transition-all">
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {/* Code Editor (Floating Panel Right) */}
      <div className={`absolute top-24 bottom-24 right-6 z-40 flex flex-col w-[480px] rounded-3xl bg-neutral-900/40 backdrop-blur-3xl border border-white/5 shadow-2xl transition-all duration-500 ${editorOpen ? 'translate-x-0 opacity-100' : 'translate-x-[calc(100%+24px)] opacity-0'}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-indigo-500/20 ring-1 ring-indigo-500/30">
              <Code2 className="h-4 w-4 text-indigo-400" />
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">Editor</span>
              <span className="block text-xs font-medium text-white truncate max-w-[200px]">{selectedFilePath?.split('/').pop() || 'sketch.ino'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-white/10 text-neutral-400 transition-all" title="Save File">
              <Save className="h-4 w-4" />
            </button>
            <button onClick={() => setEditorOpen(false)} className="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-white/10 text-neutral-400 transition-all">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 rounded-b-3xl overflow-hidden">
          <CodeEditor value={code} onChange={setCode} />
        </div>
      </div>
      {!editorOpen && (
        <button onClick={() => setEditorOpen(true)} className="absolute top-1/2 -translate-y-1/2 right-0 z-40 h-16 w-6 rounded-l-xl bg-neutral-900/80 backdrop-blur-md border border-r-0 border-white/5 flex items-center justify-center text-neutral-400 hover:text-white transition-all">
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}

      {/* Floating Status / Log (Bottom Left) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 px-6 py-2.5 rounded-full bg-neutral-900/80 backdrop-blur-md border border-white/5 flex items-center gap-3 shadow-xl">
        <Wifi className="h-3.5 w-3.5 text-neutral-500" />
        <span className="text-[11px] font-medium text-neutral-400 whitespace-nowrap">{log}</span>
      </div>

      {/* Overlays / Modals */}
      <ComponentLibrary isOpen={libOpen} onClose={() => setLibOpen(false)} onAdd={addPart} />
      <LibraryManager isOpen={libMgrOpen} onClose={() => setLibMgrOpen(false)} libraries={libraries} setLibraries={setLibraries} />
      <DiagramViewer isOpen={jsonOpen} onClose={() => setJsonOpen(false)} diagram={diagram} onDiagramChange={handleDiagramEdit} />
      <SerialMonitor 
        isOpen={serialOpen} 
        onClose={() => setSerialOpen(false)} 
        lines={serialLines} 
        onClear={() => setSerialLines([])} 
        running={isRunning} 
        baudRate={9600} 
      />

      {/* Wiring Overlay Message */}
      {wiringFrom && (
        <div className="absolute inset-0 z-[60] bg-indigo-600/10 backdrop-blur-[2px] pointer-events-none flex items-center justify-center">
          <div className="px-8 py-4 rounded-3xl bg-indigo-600 text-white shadow-2xl flex items-center gap-4 animate-in fade-in zoom-in duration-300">
            <div className="h-3 w-3 rounded-full bg-white animate-pulse" />
            <span className="text-sm font-bold">Wiring Mode: Click destination pin or Esc to cancel</span>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

### File: `virtual-playground/frontend/src/simulation/SimulationEngine.ts`
```typescript
import type { ComponentItem, Wiring } from '../types/project';
import { compileSketch } from './compiler';
import { ButtonPeripheral } from './peripherals/ButtonPeripheral';
import { LCDPeripheral } from './peripherals/LCDPeripheral';

type LogType = 'boot' | 'info' | 'input' | 'output' | 'system';
type GPIOListener = (pins: Record<string, boolean>) => void;
type LCDListener = (line1: string, line2: string, backlight: boolean) => void;
type SerialListener = (text: string) => void;
type LogListener = (text: string, type: LogType) => void;

type WorkerMessage =
  | { type: 'ready' }
  | { type: 'gpio'; pins: Record<string, boolean> }
  | { type: 'lcd'; line1: string; line2: string; backlight: boolean }
  | { type: 'serial'; text: string }
  | { type: 'error'; error: string };

export class SimulationEngine {
  private worker: Worker | null = null;
  private lcd: LCDPeripheral | null = null;
  private button: ButtonPeripheral | null = null;
  private lcdUnsubscribe: (() => void) | null = null;
  private lcdListeners = new Set<LCDListener>();
  private gpioListeners = new Set<GPIOListener>();
  private serialListeners = new Set<SerialListener>();
  private logListeners = new Set<LogListener>();

  clearListeners() {
    this.lcdListeners.clear();
    this.gpioListeners.clear();
    this.serialListeners.clear();
    this.logListeners.clear();
  }

  onLCDUpdate(listener: LCDListener) {
    this.lcdListeners.add(listener);
    return () => this.lcdListeners.delete(listener);
  }

  onGPIOUpdate(listener: GPIOListener) {
    this.gpioListeners.add(listener);
    return () => this.gpioListeners.delete(listener);
  }

  onSerial(listener: SerialListener) {
    this.serialListeners.add(listener);
    return () => this.serialListeners.delete(listener);
  }

  onLog(listener: LogListener) {
    this.logListeners.add(listener);
    return () => this.logListeners.delete(listener);
  }

  async start(sketch: string, bom: ComponentItem[], wiring: Wiring[], fqbn = 'arduino:avr:uno') {
    this.stop();

    // ??$$$ newer code — emit compile phases as distinct log steps (not per render)
    this.emitLog('[SIM] Compiling sketch for Arduino Uno (avr-gcc)', 'info');
    const hex = await compileSketch(sketch, fqbn);
    this.emitLog('[SIM] Linking firmware binary...', 'info');
    this.emitLog('[SIM] Flashing firmware to virtual CPU...', 'info');

    this.lcd = new LCDPeripheral(wiring, bom);
    this.button = new ButtonPeripheral(wiring, bom);
    this.lcdUnsubscribe = this.lcd.onUpdate((line1, line2, backlight) => {
      for (const listener of this.lcdListeners) {
        listener(line1, line2, backlight);
      }
    });

    const worker = new Worker(new URL('./cpu.worker.ts', import.meta.url), {
      type: 'module'
    });

    this.worker = worker;

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const data = event.data;

      if (data.type === 'gpio') {
        for (const listener of this.gpioListeners) {
          listener(data.pins);
        }
        return;
      }

      if (data.type === 'lcd') {
        this.lcd?.applyUpdate(data.line1, data.line2, data.backlight);
        return;
      }

      if (data.type === 'serial') {
        for (const listener of this.serialListeners) {
          listener(data.text);
        }
        return;
      }

      if (data.type === 'error') {
        this.emitLog(`[SIM] ${data.error}`, 'system');
      }
    };

    const ready = new Promise<void>((resolve, reject) => {
      const handleMessage = (event: MessageEvent<WorkerMessage>) => {
        if (event.data.type === 'ready') {
          worker.removeEventListener('message', handleMessage);
          resolve();
        }

        if (event.data.type === 'error') {
          worker.removeEventListener('message', handleMessage);
          reject(new Error(event.data.error));
        }
      };

      const handleError = (event: ErrorEvent) => {
        worker.removeEventListener('error', handleError);
        reject(event.error || new Error(event.message));
      };

      worker.addEventListener('message', handleMessage);
      worker.addEventListener('error', handleError, { once: true });
    });

    worker.postMessage({
      type: 'start',
      hex,
      buttonPins: this.button ? [this.button.pin] : []
    });

    await ready;
    this.button?.release(worker);
    this.emitLog('[SIM] Compiled and running real sketch', 'boot');
  }

  pressButton() {
    this.button?.press(this.worker);
  }

  releaseButton() {
    this.button?.release(this.worker);
  }

  stop() {
    if (this.worker) {
      this.worker.postMessage({ type: 'stop' });
      this.worker.terminate();
      this.worker = null;
    }

    this.lcdUnsubscribe?.();
    this.lcdUnsubscribe = null;
    this.lcd = null;
    this.button = null;
  }

  private emitLog(text: string, type: LogType) {
    for (const listener of this.logListeners) {
      listener(text, type);
    }
  }
}

export const simulationEngine = new SimulationEngine();
```

---

### File: `virtual-playground/frontend/src/simulation/compiler.ts`
```typescript
const DEFAULT_API_BASE = 'http://localhost:5000/api';
const FALLBACK_COMPILE_ENDPOINT = 'http://localhost:5001/api/compile';

const resolvePrimaryCompileEndpoint = () => {
  const apiBase = (import.meta.env.VITE_API_URL || DEFAULT_API_BASE).replace(/\/$/, '');
  return `${apiBase}/compile`;
};

const readErrorMessage = async (response: Response) => {
  const data = await response.json().catch(() => ({}));
  return String(data?.error || data?.message || `Compile request failed (${response.status})`);
};

export const compileSketch = async (sketch: string, fqbn = 'arduino:avr:uno') => {
  // ??$$$ newer code: Use primary backend for compilation, falling back to 5001 only in development
  const endpoints = [
    resolvePrimaryCompileEndpoint(),
    ...(import.meta.env.DEV ? [FALLBACK_COMPILE_ENDPOINT] : [])
  ];
  let lastError = 'Compilation request failed';

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ sketch, fqbn })
      });

      if (!response.ok) {
        lastError = await readErrorMessage(response);
        continue;
      }

      const data = await response.json();
      const hex = String(data?.hex || '').trim();

      if (!hex) {
        lastError = String(data?.error || 'Compilation succeeded without firmware output');
        continue;
      }

      return hex;
    } catch (error: any) {
      lastError = error?.message || String(error);
    }
  }

  throw new Error(lastError);
};
```

---

### File: `virtual-playground/frontend/src/App.tsx`
```typescript
// ??$$$ non-important
import { useEffect, useMemo, useState } from 'react';
import { useProjectStore } from './store/useProjectStore';
import { projectData } from './data/project';
import { Topbar } from './components/layout/Topbar';
import { Sidebar } from './components/layout/Sidebar';
import { RightSidebar } from './components/layout/RightSidebar';
import { BottomPanel } from './components/layout/BottomPanel';
import { Scene } from './components/three/Scene';
import { CodeEditor } from './components/editor/CodeEditor';
/* old code
import {
  Play,
  Cpu,
  Layers,
  Terminal,
  Sparkles,
  ChevronRight,
  Code
} from 'lucide-react';
*/
// ??$$$ newer code: added FolderOpen and Settings icons for mobile layout toggles
import {
  Play,
  Cpu,
  Layers,
  Terminal,
  Sparkles,
  ChevronRight,
  Code,
  FolderOpen,
  Settings
} from 'lucide-react';
import { motion } from 'framer-motion';



// ??$$$ newer code — map API BOM fields to Scene.tsx component type strings
const deriveComponentType = (item: any): string => {
  const subsystem = String(item?.subsystem || '').toLowerCase();
  const mpn = String(item?.mpn || '').toLowerCase();
  const key = String(item?.key || '').toLowerCase();
  const name = String(item?.displayName || item?.name || '').toLowerCase();

  // Microcontroller
  if (subsystem === 'mcu' || key === 'mcu' || name.includes('arduino') || name.includes('uno') || mpn.includes('arduino')) {
    return 'microcontroller';
  }
  // LED
  if (subsystem === 'output' && (name.includes('led') || mpn.includes('led')) || key === 'led' || name.includes('led')) {
    return 'led';
  }
  // Button / Switch
  if (subsystem === 'input' || key === 'button' || name.includes('button') || name.includes('pushbutton') || name.includes('switch') || mpn.includes('pushbutton') || mpn.includes('tactile')) {
    return 'button';
  }
  // Display (LCD, OLED, screen)
  if (subsystem === 'display' || key === 'lcd' || name.includes('lcd') || name.includes('oled') || name.includes('display') || name.includes('screen') || mpn.includes('lcd')) {
    return 'display';
  }
  // Passive (resistor, capacitor, etc)
  if (subsystem === 'passive' || key === 'resistor' || name.includes('resistor') || name.includes('capacitor') || mpn.includes('resistor')) {
    return 'passive';
  }

  // Fallback: use existing type or 'module'
  return String(item?.type || 'module').toLowerCase();
};

const buildPlaygroundProject = (rawProject: any) => {
  const bom = Array.isArray(rawProject?.bom) ? rawProject.bom : [];
  const wiring = Array.isArray(rawProject?.wiring) ? rawProject.wiring : [];
  const milestones = Array.isArray(rawProject?.milestones) ? rawProject.milestones : [];
  /* old code
  const componentCount = Math.max(bom.length, 1);
  */

  // ??$$$ newer code: Expand BOM items by quantity
  const normalizedBom: any[] = [];
  const totalExpandedCount = bom.reduce((acc: number, item: any) => acc + Math.max(Number(item?.qty || 1), 1), 0);
  let partIndex = 0;

  bom.forEach((item: any) => {
    const qty = Math.max(Number(item?.qty || 1), 1);
    
    // Calculate base fallback position for this group
    const angle = (partIndex / Math.max(totalExpandedCount, 1)) * Math.PI * 2;
    // ??$$$ newer code
    const isMcu = String(item?.type || '').toLowerCase() === 'microcontroller';
    const isZeroPos = Array.isArray(item?.position) && 
                      Number(item.position[0]) === 0 && 
                      Number(item.position[1]) === 0 && 
                      Number(item.position[2]) === 0;
    const hasPosition = Array.isArray(item?.position) && 
                        item.position.length === 3 && 
                        !(isZeroPos && !isMcu);
    // ??$$$ newer code
    const col = partIndex % 4;
    const row = Math.floor(partIndex / 4);
    const fallbackPosition: [number, number, number] = [
      col * 1.5 - 3,
      0.08,
      row * 1.5 - 1.5
    ];
    
    const baseX = hasPosition ? Number(item.position[0]) : fallbackPosition[0];
    const baseY = hasPosition ? Number(item.position[1]) : fallbackPosition[1];
    const baseZ = hasPosition ? Number(item.position[2]) : fallbackPosition[2];

    const offsetDistance = 0.45;

    for (let i = 0; i < qty; i++) {
      const key = i === 0 
        ? String(item?.key || item?.partId || item?.mpn || `part-${partIndex + 1}`)
        : `${String(item?.key || item?.partId || item?.mpn || `part-${partIndex + 1}`)}_${i}`;

      const displayName = qty > 1 
        ? `${String(item?.displayName || item?.name || item?.mpn || item?.wokwiPartType || `Part ${partIndex + 1}`)} (${i + 1}/${qty})`
        : String(item?.displayName || item?.name || item?.mpn || item?.wokwiPartType || `Part ${partIndex + 1}`);

      const posX = baseX + (i - (qty - 1) / 2) * offsetDistance;

      normalizedBom.push({
        key,
        displayName,
        // ??$$$ newer code
        // ??$$$ newer code — derive correct type for Scene.tsx dispatch
        type: deriveComponentType(item),
        glbUrl: String(item?.glbUrl || ''),
        position: [Number(posX.toFixed(2)), baseY, baseZ],
        rotation: Array.isArray(item?.rotation) && item.rotation.length === 3 ? item.rotation : [0, Number((angle * -1).toFixed(2)), 0],
        pins: Array.isArray(item?.pins) ? item.pins : [],
        qty
      });

      partIndex++;
    }
  });

  return {
    id: String(rawProject?.id || rawProject?._id || 'project-001'),
    name: String(rawProject?.name || rawProject?.description || 'Wireup Project'),
    description: String(rawProject?.description || ''),
    author: String(rawProject?.author || 'Wireup AI'),
    createdAt: String(rawProject?.createdAt || new Date().toISOString().slice(0, 10)),
    bom: normalizedBom,
    wiring,
    editableJson: {
      simulationSpeed: Number(rawProject?.editableJson?.simulationSpeed || 1),
      ledInitialState: Boolean(rawProject?.editableJson?.ledInitialState ?? false),
      buttonInitialState: Boolean(rawProject?.editableJson?.buttonInitialState ?? false)
    },
    // ??$$$ old code
    /*
    sketch: String(rawProject?.sketch || ''),
    */
    // ??$$$ newer code
    sketch: String(
      rawProject?.sketch ||
      [...milestones]
        .sort((a: any, b: any) => Number(b?.order || 0) - Number(a?.order || 0))
        .find((m: any) => String(m?.code || '').trim().length > 0)?.code ||
      ''
    ),
    context: rawProject?.context || rawProject?.ideation?.snapshot || undefined,
    phases: Array.isArray(rawProject?.phases) ? rawProject.phases : (rawProject?.context?.subsystems || []),
    milestones,
    additionalTools: Array.isArray(rawProject?.additionalTools) ? rawProject.additionalTools : []
  };
};
function App() {
  /* old code
  const { currentTab, setTab, loadProject, addLog } = useProjectStore();
  const [viewMode, setViewMode] = useState<'split' | 'three' | 'code'>('split');
  const [loadingRemoteProject, setLoadingRemoteProject] = useState(false);
  const [remoteLoadError, setRemoteLoadError] = useState<string | null>(null);
  */
  // ??$$$ newer code: added mobile tracking states and drawer toggle states
  const { currentTab, setTab, loadProject, addLog } = useProjectStore();
  const [viewMode, setViewMode] = useState<'split' | 'three' | 'code'>('split');
  const [loadingRemoteProject, setLoadingRemoteProject] = useState(false);
  const [remoteLoadError, setRemoteLoadError] = useState<string | null>(null);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [mobileLeftOpen, setMobileLeftOpen] = useState(false);
  const [mobileRightOpen, setMobileRightOpen] = useState(false);
  const [mobileBottomOpen, setMobileBottomOpen] = useState(false);

  const activeView = isMobile && viewMode === 'split' ? 'three' : viewMode;

  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const sessionId = searchParams.get('sessionId');
  const projectId = searchParams.get('projectId');
  const apiBaseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

  useEffect(() => {
    if (!sessionId && !projectId) return;

    let cancelled = false;

    const bootRemoteProject = async () => {
      setLoadingRemoteProject(true);
      setRemoteLoadError(null);
      try {
        let loadedProject: any = null;

        if (projectId) {
          const projectRes = await fetch(`${apiBaseUrl}/project/${projectId}`, {
            method: 'GET',
            credentials: 'include'
          });

          if (projectRes.ok) {
            loadedProject = await projectRes.json();
          }
        }

        if (!loadedProject && sessionId) {
          // ??$$$ old code
          /*
          const res = await fetch(`${apiBaseUrl}/new-flow/virtual-project/${sessionId}`, {
            method: 'GET',
            credentials: 'include'
          });

          if (!res.ok) {
            throw new Error(`Failed to load formulation payload (${res.status})`);
          }

          const data = await res.json();
          loadedProject = data?.project || null;
          */
          // ??$$$ newer code
          try {
            const res = await fetch(`${apiBaseUrl}/new-flow/virtual-project/${sessionId}`, {
              method: 'GET',
              credentials: 'include'
            });
            if (res.ok) {
              const data = await res.json();
              loadedProject = data?.project || null;
            }
          } catch (e) {
            console.warn("Main backend load failed. Trying local playground server...", e);
          }

          if (!loadedProject) {
            // ??$$$ old code
            // const res = await fetch(`http://localhost:5001/api/project?sessionId=${sessionId}`);
            // ??$$$ newer code: Use consolidated playground route
            const res = await fetch(`${apiBaseUrl}/playground/project?sessionId=${sessionId}`);
            if (res.ok) {
              loadedProject = await res.json();
            } else {
              throw new Error(`Failed to load formulation payload from both main backend and playground backend`);
            }
          }
        }

        if (!cancelled && loadedProject) {
          loadProject(buildPlaygroundProject(loadedProject));
          setTab('playground');
          addLog(projectId ? '[SYSTEM] Loaded persisted project payload' : '[SYSTEM] Loaded AI-formulated project payload', 'system');
          if (projectId) {
            addLog(`[INFO] Linked project: ${projectId}`, 'info');
          }
        } else if (!cancelled) {
          throw new Error('No project payload was available');
        }
      } catch (err: any) {
        if (!cancelled) {
          const message = err?.message || 'Could not load project payload';
          addLog(`[ERROR] ${message}`, 'system');
          setRemoteLoadError(message);
        }
      } finally {
        if (!cancelled) {
          setLoadingRemoteProject(false);
        }
      }
    };

    bootRemoteProject();
    return () => {
      cancelled = true;
    };
  }, [sessionId, projectId, apiBaseUrl, loadProject, setTab, addLog]);

  const handleLaunch = () => {
    loadProject(projectData);
    setTab('playground');
    addLog('[SYSTEM] Loaded Virtual Arduino Circuit Demo', 'system');
  };

  if (sessionId && currentTab === 'landing') {
    return (
      <div className="min-h-screen page-bg text-slate-800 dark:text-slate-100 flex items-center justify-center px-4">
        <div className="surface max-w-md w-full rounded-xl p-6 text-center space-y-4">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Loading formulated playground</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Pulling AI-generated project data from the backend and preparing the 5174 workspace.
            </p>
          </div>
          {remoteLoadError && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {remoteLoadError}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (currentTab === 'landing') {
    return (
      <div className="min-h-screen page-bg text-slate-800 dark:text-slate-100 relative overflow-hidden flex flex-col justify-between">
        <div className="absolute top-[-20%] left-[20%] w-125 h-125 rounded-full bg-blue-500/10 blur-[120px] pointer-events-none" />
        <div className="absolute top-[-10%] right-[10%] w-150 h-150 rounded-full bg-sky-400/10 blur-[130px] pointer-events-none" />

        <header className="h-16 px-8 flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md relative z-10">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded bg-linear-to-tr from-blue-600 to-sky-500 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-white" />
            </div>
            <span className="font-mono text-sm font-bold tracking-widest text-slate-900 dark:text-slate-100 uppercase">
              WIREUP<span className="text-blue-600 dark:text-blue-400">.AI</span>
            </span>
          </div>
          <div className="flex items-center space-x-4 text-xs font-mono text-slate-600 dark:text-slate-300">
            <span className="flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              <span>NODE: ACTIVE</span>
            </span>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 relative z-10 max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center space-x-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3.5 py-1.5 rounded-full text-xs font-mono text-blue-600 dark:text-blue-400 mb-6"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 animate-spin" />
            <span>INTERACTIVE HARDWARE SIMULATION PROXY</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="text-4xl sm:text-6xl font-bold tracking-tight font-sans text-slate-900 dark:text-slate-100 mb-6 uppercase"
          >
            Virtual Hardware <br />
            <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-600 via-sky-500 to-cyan-500">
              Playground
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.35 }}
            className="text-slate-600 dark:text-slate-300 text-sm sm:text-lg font-mono max-w-2xl mb-10 leading-relaxed"
          >
            Interactive browser-based electronics simulation. Connect sensors, write logic, and run microcontrollers in a high-fidelity 3D sandbox.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: '0 0 18px rgba(29, 78, 216, 0.3)' }}
              whileTap={{ scale: 0.98 }}
              onClick={handleLaunch}
              className="flex items-center space-x-3 px-8 py-4 bg-linear-to-r from-blue-600 to-sky-500 rounded-lg text-sm font-mono font-bold tracking-wider text-white uppercase cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Launch Demo</span>
              <ChevronRight className="w-4 h-4" />
            </motion.button>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 w-full text-left font-mono">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="p-5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md space-y-2.5"
            >
              <div className="w-9 h-9 rounded bg-blue-100 border border-blue-200 flex items-center justify-center">
                <Layers className="w-4 h-4 text-blue-600" />
              </div>
              <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">3D Electronics Lab</h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                Interact with procedural 3D microcontrollers, buttons, and breadboards inside a responsive Three.js environment.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="p-5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md space-y-2.5"
            >
              <div className="w-9 h-9 rounded bg-sky-100 border border-sky-200 flex items-center justify-center">
                <Code className="w-4 h-4 text-sky-600" />
              </div>
              <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">Integrated Monaco IDE</h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                Inspect Arduino sketch code (sketch.ino), editable hardware parameters, and wiring configuration schemas side-by-side.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="p-5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md space-y-2.5"
            >
              <div className="w-9 h-9 rounded bg-emerald-100 border border-emerald-200 flex items-center justify-center">
                <Terminal className="w-4 h-4 text-emerald-600" />
              </div>
              <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">Telemetry Serial Log</h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                Monitor CPU core utilization, running clock FPS, voltage streams, and reactive debug logs live as you play.
              </p>
            </motion.div>
          </div>
        </main>

        <footer className="h-14 px-8 flex items-center justify-between border-t border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 text-[10px] text-slate-600 dark:text-slate-300 font-mono relative z-10">
          <span>© 2026 Wireup Virtual electronics demo. All fake data simulated locally.</span>
          <span className="text-blue-600 dark:text-blue-400">STABLE DEVELOPMENT COMPILATION</span>
        </footer>
      </div>
    );
  }

  // ??$$$ newer code: Responsive application layout and controls
  return (
    <div className="h-screen w-screen flex flex-col bg-[var(--bg)] text-[var(--text)] overflow-hidden font-sans relative">
      {loadingRemoteProject && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-8 py-5 text-sm font-semibold text-[var(--heading)] shadow-2xl">
            Loading formulated project…
          </div>
        </div>
      )}

      <Topbar />

      {/* body row — must be min-h-0 so it doesn't overflow the viewport */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        
        {/* Mobile menu backdrop overlays */}
        {isMobile && mobileLeftOpen && (
          <div className="fixed inset-0 top-12 bg-black/40 backdrop-blur-xs z-30 md:hidden" onClick={() => setMobileLeftOpen(false)} />
        )}
        {isMobile && mobileRightOpen && (
          <div className="fixed inset-0 top-12 bg-black/40 backdrop-blur-xs z-30 md:hidden" onClick={() => setMobileRightOpen(false)} />
        )}
        {isMobile && mobileBottomOpen && (
          <div className="fixed inset-0 top-12 bottom-12 bg-black/40 backdrop-blur-xs z-30 md:hidden" onClick={() => setMobileBottomOpen(false)} />
        )}

        {/* Left Sidebar */}
        <Sidebar isOpenMobile={mobileLeftOpen} />

        {/* centre column */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-[var(--bg)]">

          {/* view-mode switcher (Desktop only) */}
          <div className="hidden md:flex h-8 flex-shrink-0 bg-[var(--surface)] border-b border-[var(--border)] items-center px-4 gap-1 select-none">
            <span className="text-[var(--text-muted)] font-sans text-[10px] uppercase tracking-widest mr-3">View</span>
            {(['split', 'three', 'code'] as const).map((mode) => {
              const labels = { split: 'Split View', three: '3D Only', code: 'Code Only' };
              return (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    viewMode === mode
                      ? 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30'
                      : 'text-[var(--text-muted)] hover:text-[var(--heading)] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  {labels[mode]}
                </button>
              );
            })}
          </div>

          {/* canvas area — flex-1 min-h-0 is essential to prevent overflow */}
          <div className="flex-1 min-h-0 flex overflow-hidden">
            {activeView === 'split' && (
              <>
                <div className="w-1/2 h-full flex flex-col min-w-0 overflow-hidden border-r border-[var(--border)]">
                  <CodeEditor />
                </div>
                <div className="w-1/2 h-full relative min-w-0 overflow-hidden">
                  <Scene />
                </div>
              </>
            )}
            {activeView === 'three' && (
              <div className="w-full h-full relative overflow-hidden">
                <Scene />
              </div>
            )}
            {activeView === 'code' && (
              <div className="w-full h-full flex flex-col overflow-hidden">
                <CodeEditor />
              </div>
            )}
          </div>

          {/* Bottom logs console */}
          <BottomPanel isOpenMobile={mobileBottomOpen} />
        </div>

        {/* Right Sidebar */}
        <RightSidebar isOpenMobile={mobileRightOpen} />
      </div>

      {/* Mobile Toolbar (Mobile only) */}
      {isMobile && (
        <div className="h-12 bg-[var(--surface)] border-t border-[var(--border)] flex items-center justify-around z-50 md:hidden flex-shrink-0 select-none">
          <button
            onClick={() => { setMobileLeftOpen(!mobileLeftOpen); setMobileRightOpen(false); setMobileBottomOpen(false); }}
            className={`flex flex-col items-center justify-center flex-1 h-full text-[10px] font-semibold transition-all cursor-pointer ${
              mobileLeftOpen ? 'text-indigo-500 bg-indigo-500/5' : 'text-[var(--text-muted)]'
            }`}
          >
            <FolderOpen className="w-4.5 h-4.5 mb-0.5" />
            <span>Files</span>
          </button>
          
          <button
            onClick={() => { setViewMode(activeView === 'three' ? 'code' : 'three'); setMobileLeftOpen(false); setMobileRightOpen(false); setMobileBottomOpen(false); }}
            className={`flex flex-col items-center justify-center flex-1 h-full text-[10px] font-semibold transition-all cursor-pointer ${
              activeView === 'code' ? 'text-indigo-500 bg-indigo-500/5' : 'text-[var(--text-muted)]'
            }`}
          >
            <Code className="w-4.5 h-4.5 mb-0.5" />
            <span>{activeView === 'code' ? '3D View' : 'Code View'}</span>
          </button>

          <button
            onClick={() => { setMobileRightOpen(!mobileRightOpen); setMobileLeftOpen(false); setMobileBottomOpen(false); }}
            className={`flex flex-col items-center justify-center flex-1 h-full text-[10px] font-semibold transition-all cursor-pointer ${
              mobileRightOpen ? 'text-indigo-500 bg-indigo-500/5' : 'text-[var(--text-muted)]'
            }`}
          >
            <Settings className="w-4.5 h-4.5 mb-0.5" />
            <span>Inspect</span>
          </button>

          <button
            onClick={() => { setMobileBottomOpen(!mobileBottomOpen); setMobileLeftOpen(false); setMobileRightOpen(false); }}
            className={`flex flex-col items-center justify-center flex-1 h-full text-[10px] font-semibold transition-all cursor-pointer ${
              mobileBottomOpen ? 'text-indigo-500 bg-indigo-500/5' : 'text-[var(--text-muted)]'
            }`}
          >
            <Terminal className="w-4.5 h-4.5 mb-0.5" />
            <span>Console</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
```

---

### File: `virtual-playground/frontend/src/components/three/Scene.tsx`
```typescript
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
import { Resistor } from './Resistor'; // ??$$ newer code
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
    <div className="w-full h-full bg-slate-100 dark:bg-slate-955 relative">
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

              // ??$$$ newer code — render resistor as proper 3D component
              if (itemType === 'passive' || itemName.includes('resistor')) {
                return (
                  <Resistor
                    key={item?.key || `resistor-${index}`}
                    position={position}
                    componentKey={String(item?.key || `resistor${index + 1}`)}
                    displayName={String(item?.displayName || 'Resistor')}
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
```

---

### File: `virtual-playground/frontend/src/store/useProjectStore.ts`
```typescript
import { create } from 'zustand';
import { projectData } from '../data/project';
import { simulationEngine } from '../simulation/SimulationEngine';
import type { ComponentItem, ProjectData, Wiring } from '../types/project';

const EMPTY_LCD_LINE = ''.padEnd(16, ' ');

const normalizeProjectData = (data: ProjectData): ProjectData => {
  const editableJson = {
    simulationSpeed: 1,
    ledInitialState: false,
    buttonInitialState: false,
    ...((data.editableJson as any) || {})
  };

  return {
    ...data,
    bom: Array.isArray(data.bom) ? data.bom : [],
    wiring: Array.isArray(data.wiring) ? data.wiring : [],
    editableJson,
    milestones: Array.isArray(data.milestones) ? data.milestones : [],
    additionalTools: Array.isArray(data.additionalTools) ? data.additionalTools : []
  };
};

const parseEndpoint = (value: string) => {
  const [partKey = '', ...pinParts] = String(value || '').split('.');
  return {
    partKey: partKey.trim().toLowerCase(),
    pin: pinParts.join('.').trim()
  };
};

const normalizePin = (value: string) => {
  let pin = String(value || '').trim().toUpperCase();
  if (!pin) {
    return '';
  }

  if (pin === 'SDA') {
    return 'A4';
  }

  if (pin === 'SCL') {
    return 'A5';
  }

  if (pin === 'RX') {
    return 'D0';
  }

  if (pin === 'TX') {
    return 'D1';
  }

  if (/^GPIO\d+$/.test(pin)) {
    pin = `D${pin.slice(4)}`;
  }

  if (/^\d+$/.test(pin)) {
    pin = `D${pin}`;
  }

  return pin;
};

const matchesComponent = (item: ComponentItem, matcher: (name: string, type: string) => boolean) => {
  const name = String(item?.displayName || item?.key || '').toLowerCase();
  const type = String(item?.type || '').toLowerCase();
  return matcher(name, type);
};

const isMicrocontrollerComponent = (item: ComponentItem) =>
  matchesComponent(item, (name, type) => type === 'microcontroller' || name.includes('arduino') || name.includes('uno'));

// ??$$$ newer code — power/ground rail pin names — never valid GPIO signal pins
const POWER_PINS = new Set([
  'GND', 'VCC', '5V', '3V3', '3.3V', 'VIN', 'AREF', 'RESET',
  'K', 'C', // LED cathode legs often wired to GND via these
]);

// ??$$$ newer code — build undirected adjacency graph of wiring connections
// so we can resolve multi-hop paths like mcu.D13 -> resistor.1 -> led.A
const buildWiringGraph = (wiring: Wiring[]) => {
  // ??$$$ newer code — each edge stores neighborPin = the pin on the DESTINATION side.
  // e.g. wire "mcu.D13 -> resistor.1":
  //   forward edge  mcu->resistor: neighborPin = "1"   (resistor's pin)
  //   backward edge resistor->mcu: neighborPin = "D13" (MCU's pin)
  // So when BFS reaches the MCU node, neighborPin IS the MCU GPIO pin.
  const graph = new Map<string, { partKey: string; neighborPin: string }[]>();

  const add = (fromPart: string, toPart: string, toPin: string) => {
    if (!graph.has(fromPart)) graph.set(fromPart, []);
    graph.get(fromPart)!.push({ partKey: toPart, neighborPin: toPin });
  };

  for (const wire of wiring || []) {
    const from = parseEndpoint(wire.from);
    const to = parseEndpoint(wire.to);
    if (!from.partKey || !to.partKey) continue;
    add(from.partKey, to.partKey, normalizePin(to.pin));   // forward
    add(to.partKey, from.partKey, normalizePin(from.pin)); // backward
  }

  return graph;
};

const findWiredPin = (
  project: ProjectData,
  matcher: (item: ComponentItem) => boolean
) => {
  // ??$$$ newer code — collect all wiring part keys so we can bridge key mismatches
  // The wiring uses short role keys ("led", "resistor") while BOM items have
  // safeId-ified keys like "red-led-5mm". We resolve by substring matching.
  const allWiringPartKeys = new Set<string>();
  for (const wire of project.wiring || []) {
    const from = parseEndpoint(wire.from);
    const to = parseEndpoint(wire.to);
    if (from.partKey) allWiringPartKeys.add(from.partKey);
    if (to.partKey) allWiringPartKeys.add(to.partKey);
  }

  // Build the set of effective keys for the matched BOM items:
  // 1. Use item.key directly (exact match)
  // 2. Also add any wiring part-key that is a substring of item.key, or vice versa
  const matchedBomItems = project.bom.filter(matcher);
  const componentKeys = new Set<string>();
  for (const item of matchedBomItems) {
    const bomKey = String(item.key || '').toLowerCase();
    if (bomKey) componentKeys.add(bomKey);
    // Bridge: if a wiring part-key is a token inside the BOM key (or vice versa), treat as same part
    for (const wiringKey of allWiringPartKeys) {
      if (bomKey.includes(wiringKey) || wiringKey.includes(bomKey)) {
        componentKeys.add(wiringKey);
      }
    }
  }

  const mcuItems = project.bom.filter(isMicrocontrollerComponent);
  const mcuKeys = new Set<string>(['arduino', 'mcu']);
  for (const item of mcuItems) {
    const bomKey = String(item.key || '').toLowerCase();
    if (bomKey) mcuKeys.add(bomKey);
    for (const wiringKey of allWiringPartKeys) {
      if (bomKey.includes(wiringKey) || wiringKey.includes(bomKey)) {
        mcuKeys.add(wiringKey);
      }
    }
  }


  // ??$$$ newer code — fast path: direct single-hop wire, must be a GPIO signal pin
  for (const wire of project.wiring || []) {
    const from = parseEndpoint(wire.from);
    const to = parseEndpoint(wire.to);

    if (componentKeys.has(from.partKey) && mcuKeys.has(to.partKey)) {
      const pin = normalizePin(to.pin);
      if (pin && !POWER_PINS.has(pin)) return pin;
    }
    if (componentKeys.has(to.partKey) && mcuKeys.has(from.partKey)) {
      const pin = normalizePin(from.pin);
      if (pin && !POWER_PINS.has(pin)) return pin;
    }
  }

  // ??$$$ newer code — multi-hop BFS toward MCU.
  // neighborPin = the pin on the DESTINATION node when traversing each edge.
  // When we step onto an MCU node, neighborPin is the exact MCU GPIO pin.
  // Skip power-rail pins so led.K->mcu.GND never masks mcu.D13->resistor->led.
  const graph = buildWiringGraph(project.wiring || []);

  for (const startKey of componentKeys) {
    const visited = new Set<string>([startKey]);
    const queue: string[] = [startKey];

    while (queue.length > 0) {
      const current = queue.shift()!;

      for (const { partKey: next, neighborPin } of graph.get(current) || []) {
        // ??$$$ newer code — always check MCU nodes regardless of visited,
        // because a power-rail edge (led.K->GND) can mark MCU visited BEFORE
        // the signal-path edge (resistor->mcu.D13) is reached, silently skipping it.
        if (mcuKeys.has(next)) {
          if (neighborPin && !POWER_PINS.has(neighborPin)) return neighborPin;
          // Power-rail to MCU — keep searching, do NOT add to visited
          continue;
        }

        if (visited.has(next)) continue;
        visited.add(next);
        queue.push(next);
      }
    }
  }

  return '';
};


const resolveLedState = (project: ProjectData, pins: Record<string, boolean>) => {
  const pin = findWiredPin(project, (item) =>
    matchesComponent(item, (name, type) => type === 'led' || name.includes('led'))
  );

  return pin ? Boolean(pins[pin]) : false;
};

const inferLogType = (text: string): LogEntry['type'] => {
  const normalized = String(text || '').trim().toUpperCase();

  if (normalized.startsWith('[BOOT]')) {
    return 'boot';
  }

  if (normalized.startsWith('[INPUT]')) {
    return 'input';
  }

  if (normalized.startsWith('[OUTPUT]')) {
    return 'output';
  }

  if (normalized.startsWith('[SYSTEM]') || normalized.startsWith('[ERROR]') || normalized.startsWith('[SIM]')) {
    return 'system';
  }

  return 'info';
};

export interface LogEntry {
  id: string;
  timestamp: string;
  text: string;
  type: 'boot' | 'info' | 'input' | 'output' | 'system';
}

interface ProjectState {
  currentTab: 'landing' | 'playground';
  project: ProjectData;
  simulationRunning: boolean;
  compiling: boolean; // ??$$$ newer code — distinct compile-phase flag
  compilePhase: string; // ??$$$ newer code — current compile step message
  ledState: boolean;
  buttonPressed: boolean;
  lcdLine1: string;
  lcdLine2: string;
  lcdBacklight: boolean;
  gpioPins: Record<string, boolean>;
  logs: LogEntry[];
  selectedFile: string;
  selectedComponent: string | null;
  showWires: boolean;
  showLabels: boolean;
  fps: number;
  cpuUsage: number;
  voltage: number;

  setTab: (tab: 'landing' | 'playground') => void;
  loadProject: (data: ProjectData) => void;
  setSimulationRunning: (running: boolean) => Promise<void>;
  setLedState: (state: boolean) => void;
  setButtonPressed: (pressed: boolean) => void;
  addLog: (text: string, type?: LogEntry['type']) => void;
  clearLogs: () => void;
  setSelectedFile: (file: string) => void;
  setSelectedComponent: (key: string | null) => void;
  toggleWires: () => void;
  toggleLabels: () => void;
  resetSimulation: () => void;
  tickTelemetry: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentTab: 'landing',
  project: projectData,
  simulationRunning: false,
  compiling: false,       // ??$$$ newer code
  compilePhase: '',       // ??$$$ newer code
  ledState: false,
  buttonPressed: false,
  lcdLine1: EMPTY_LCD_LINE,
  lcdLine2: EMPTY_LCD_LINE,
  lcdBacklight: false,
  gpioPins: {},
  logs: [],
  selectedFile: 'sketch.ino',
  selectedComponent: null,
  showWires: true,
  showLabels: true,
  fps: 60,
  cpuUsage: 0,
  voltage: 0,

  setTab: (tab) => set({ currentTab: tab }),

  loadProject: (data) => {
    simulationEngine.stop();
    simulationEngine.clearListeners();

    const normalized = normalizeProjectData(data);
    set({
      project: normalized,
      simulationRunning: false,
      ledState: normalized.editableJson.ledInitialState,
      buttonPressed: normalized.editableJson.buttonInitialState,
      lcdLine1: EMPTY_LCD_LINE,
      lcdLine2: EMPTY_LCD_LINE,
      lcdBacklight: false,
      gpioPins: {},
      voltage: 0,
      cpuUsage: 0
    });
  },

  setSimulationRunning: async (running) => {
    if (!running) {
      simulationEngine.stop();
      simulationEngine.clearListeners();
      set({
        simulationRunning: false,
        compiling: false,
        compilePhase: '',
        voltage: 0,
        cpuUsage: 0,
        ledState: false,
        lcdLine1: EMPTY_LCD_LINE,
        lcdLine2: EMPTY_LCD_LINE,
        lcdBacklight: false,
        gpioPins: {}
      });
      get().addLog('[SYSTEM] Simulation paused', 'system');
      return;
    }

    // ??$$$ newer code — block if already running OR compiling
    if (get().simulationRunning || get().compiling) {
      return;
    }

    const project = normalizeProjectData(get().project);

    simulationEngine.stop();
    simulationEngine.clearListeners();

    // ??$$$ newer code — enter compile phase
    set({ compiling: true, compilePhase: 'Sending sketch to compiler...' });
    get().addLog('[SIM] Starting compilation pipeline...', 'system');

    simulationEngine.onLCDUpdate((line1, line2, backlight) => {
      set({
        lcdLine1: line1,
        lcdLine2: line2,
        lcdBacklight: backlight
      });
    });

    simulationEngine.onGPIOUpdate((pins) => {
      // ??$$$ newer code — debug: dump BOM + wiring + resolved pin on FIRST gpio event only
      if (Object.keys(get().gpioPins).length === 0) {
        const bomDump = project.bom.map((i: any) => `${i.key}[${i.type}]`).join(', ');
        const wiringDump = (project.wiring || []).map((w: any) => `${w.from}->${w.to}`).join(' | ');
        get().addLog(`[DEBUG-BOM] ${bomDump}`, 'system');
        get().addLog(`[DEBUG-WIRING] ${wiringDump}`, 'system');
      }
      const ledPin = (() => {
        try {
          return findWiredPin(project, (item) =>
            matchesComponent(item, (name, type) => type === 'led' || name.includes('led'))
          );
        } catch { return 'ERR'; }
      })();
      const d13Val = pins['D13'];
      if (d13Val !== undefined) {
        get().addLog(`[DEBUG] D13=${d13Val} | resolvedLedPin="${ledPin}" | ledState=${Boolean(pins[ledPin])}`, 'system');
      }
      set({
        gpioPins: pins,
        ledState: resolveLedState(project, pins)
      });
    });



    simulationEngine.onSerial((text) => {
      get().addLog(text, inferLogType(text));
    });

    // ??$$$ newer code — intercept log events to also update compilePhase
    simulationEngine.onLog((text, type) => {
      get().addLog(text, type);
      if (text.includes('Compiling')) {
        set({ compilePhase: 'Compiling Arduino sketch (avr-gcc)...' });
      } else if (text.includes('Linking')) {
        set({ compilePhase: 'Linking firmware binary...' });
      } else if (text.includes('Flashing')) {
        set({ compilePhase: 'Flashing firmware to virtual CPU...' });
      } else if (text.includes('Compiled') || text.includes('running') || text.includes('online')) {
        set({ compilePhase: 'Firmware ready — booting CPU...' });
      }
    });

    try {
      set({ compilePhase: 'Compiling Arduino sketch (avr-gcc)...' });
      await simulationEngine.start(project.sketch || '', project.bom, project.wiring);
      set({
        simulationRunning: true,
        compiling: false,
        compilePhase: '',
        voltage: 5,
        cpuUsage: 14,
        // ??$$$ newer code — do NOT reset LCD here; setup() already wrote via listeners
        buttonPressed: false
      });
      get().addLog('[SIM] CPU core online — sketch executing', 'boot');
    } catch (error: any) {
      simulationEngine.stop();
      simulationEngine.clearListeners();
      set({
        simulationRunning: false,
        compiling: false,
        compilePhase: '',
        voltage: 0,
        cpuUsage: 0,
        lcdBacklight: false
      });
      get().addLog(`[ERROR] ${error?.message || 'Failed to start simulation'}`, 'system');
    }
  },

  setLedState: (state) => set({ ledState: state }),

  setButtonPressed: (pressed) => {
    const running = get().simulationRunning;
    set({ buttonPressed: pressed });

    if (!running) {
      return;
    }

    if (pressed) {
      simulationEngine.pressButton();
      get().addLog('[INPUT] Button pressed (INPUT_PULLUP -> LOW)', 'input');
      return;
    }

    simulationEngine.releaseButton();
    get().addLog('[INPUT] Button released (INPUT_PULLUP -> HIGH)', 'input');
  },

  addLog: (text, type = 'info') => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).slice(2, 11),
      timestamp: new Date().toLocaleTimeString(),
      text,
      type
    };

    set((state) => ({
      logs: [...state.logs.slice(-99), newLog]
    }));
  },

  clearLogs: () => set({ logs: [] }),

  setSelectedFile: (file) => set({ selectedFile: file }),

  setSelectedComponent: (key) => set({ selectedComponent: key }),

  toggleWires: () => set((state) => ({ showWires: !state.showWires })),

  toggleLabels: () => set((state) => ({ showLabels: !state.showLabels })),

  resetSimulation: () => {
    simulationEngine.stop();
    simulationEngine.clearListeners();

    const normalized = normalizeProjectData(get().project);
    set({
      simulationRunning: false,
      compiling: false,       // ??$$$ newer code
      compilePhase: '',       // ??$$$ newer code
      ledState: normalized.editableJson.ledInitialState,
      buttonPressed: normalized.editableJson.buttonInitialState,
      lcdLine1: EMPTY_LCD_LINE,
      lcdLine2: EMPTY_LCD_LINE,
      lcdBacklight: false,
      gpioPins: {},
      voltage: 0,
      cpuUsage: 0
    });
    get().clearLogs();
    get().addLog('[SYSTEM] Simulation reset completed', 'system');
  },

  tickTelemetry: () => {
    if (!get().simulationRunning) {
      return;
    }

    set((state) => {
      const cpuJitter = Math.floor(Math.random() * 8) - 4;
      const fpsJitter = Math.floor(Math.random() * 4) - 2;
      const voltageJitter = Math.random() * 0.08 - 0.04;

      return {
        cpuUsage: Math.max(6, Math.min(95, 18 + (state.buttonPressed ? 10 : 0) + cpuJitter)),
        fps: Math.max(50, Math.min(61, 60 + fpsJitter)),
        voltage: Math.max(4.9, Math.min(5.1, 5 + voltageJitter))
      };
    });
  }
}));
```

---

### File: `virtual-playground/frontend/src/types/project.ts`
```typescript
// ??$$$ non-important
// ??$$$
export interface Pin {
  id: string;
  x: number;
  y: number;
  z: number;
  type: string;
}

export interface ComponentItem {
  key: string;
  displayName: string;
  type: string;
  glbUrl: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  pins: Pin[];
}

export interface Wiring {
  from: string;
  to: string;
  color: string;
}

export interface EditableJson {
  simulationSpeed: number;
  ledInitialState: boolean;
  buttonInitialState: boolean;
}

export interface ProjectData {
  id: string;
  name: string;
  description: string;
  author: string;
  createdAt: string;
  bom: ComponentItem[];
  wiring: Wiring[];
  editableJson: EditableJson;
  sketch: string;
  context?: {
    mcu?: string;
    powerSource?: string;
    connectivity?: string;
    constraints?: string[];
  };
  phases?: string[];
  milestones?: Array<{
    id?: string;
    order?: number;
    title?: string;
    objective?: string;
    expectedOutput?: string;
    passCondition?: string;
  }>;
  additionalTools?: string[];
}
```

---

### File: `virtual-playground/frontend/src/simulation/cpu.worker.ts`
```typescript
import {
  AVRIOPort,
  AVRTWI,
  AVRTimer,
  AVRUSART,
  CPU,
  avrInstruction,
  portBConfig,
  portCConfig,
  portDConfig,
  timer0Config,
  timer1Config,
  timer2Config,
  twiConfig,
  usart0Config,
  type TWIEventHandler
} from 'avr8js';

const CLOCK_HZ = 16_000_000;
const CYCLES_PER_SLICE = 50_000;
const LCD_ADDRESS = 0x27;
const LCD_WIDTH = 16;

const PCF8574_BACKLIGHT = 0x08;
const PCF8574_ENABLE = 0x04;
const PCF8574_RW = 0x02;
const PCF8574_RS = 0x01;

type WorkerStartMessage = {
  type: 'start';
  hex: string;
  buttonPins?: string[];
};

type WorkerButtonMessage = {
  type: 'button';
  pin: string;
  state: boolean;
};

type WorkerStopMessage = {
  type: 'stop';
};

type WorkerMessage = WorkerStartMessage | WorkerButtonMessage | WorkerStopMessage;

type PinDescriptor = {
  bit: number;
  key: string;
  port: AVRIOPort;
};

type RunnerState = {
  cpu: CPU;
  portB: AVRIOPort;
  portC: AVRIOPort;
  portD: AVRIOPort;
  pinMap: Record<string, PinDescriptor>;
  snapshotKeys: string[];
  lastPins: Record<string, boolean>;
  tickHandle: number;
};

class LCDController {
  private emit: (line1: string, line2: string, backlight: boolean) => void;
  private ddram = new Map<number, string>();
  private displayEnabled = true;
  private increment = true;
  private cursorAddress = 0;
  private backlight = false;
  private lastExpanderByte = 0;
  private pendingNibble: number | null = null;
  private pendingRs = false;
  private lastRenderedLine1 = ''.padEnd(LCD_WIDTH, ' ');
  private lastRenderedLine2 = ''.padEnd(LCD_WIDTH, ' ');
  private lastRenderedBacklight = false;

  constructor(emit: (line1: string, line2: string, backlight: boolean) => void) {
    this.emit = emit;
  }

  writeExpanderByte(value: number) {
    const nextBacklight = Boolean(value & PCF8574_BACKLIGHT);
    if (nextBacklight !== this.backlight) {
      this.backlight = nextBacklight;
      this.flush();
    }

    const fallingEdge =
      Boolean(this.lastExpanderByte & PCF8574_ENABLE) &&
      !Boolean(value & PCF8574_ENABLE);

    if (fallingEdge) {
      this.latchNibble(value);
    }

    this.lastExpanderByte = value;
  }

  private latchNibble(value: number) {
    if (value & PCF8574_RW) {
      return;
    }

    const nibble = (value >> 4) & 0x0f;
    const rs = Boolean(value & PCF8574_RS);

    if (this.pendingNibble === null) {
      this.pendingNibble = nibble;
      this.pendingRs = rs;
      return;
    }

    const byte = (this.pendingNibble << 4) | nibble;
    const byteRs = this.pendingRs;

    this.pendingNibble = null;
    this.pendingRs = false;

    if (byteRs) {
      this.writeData(byte);
    } else {
      this.executeCommand(byte);
    }
  }

  private executeCommand(value: number) {
    if (value === 0x01) {
      this.ddram.clear();
      this.cursorAddress = 0;
      this.flush();
      return;
    }

    if (value === 0x02) {
      this.cursorAddress = 0;
      this.flush();
      return;
    }

    if ((value & 0x80) === 0x80) {
      this.cursorAddress = value & 0x7f;
      return;
    }

    if ((value & 0x08) === 0x08) {
      this.displayEnabled = Boolean(value & 0x04);
      this.flush();
      return;
    }

    if ((value & 0x04) === 0x04) {
      this.increment = Boolean(value & 0x02);
      return;
    }
  }

  private writeData(value: number) {
    this.ddram.set(this.cursorAddress, this.toDisplayChar(value));
    this.advanceCursor();
    this.flush();
  }

  private advanceCursor() {
    if (this.increment) {
      if (this.cursorAddress === 0x0f) {
        this.cursorAddress = 0x40;
      } else if (this.cursorAddress === 0x4f) {
        this.cursorAddress = 0x00;
      } else {
        this.cursorAddress += 1;
      }
      return;
    }

    if (this.cursorAddress === 0x40) {
      this.cursorAddress = 0x0f;
    } else if (this.cursorAddress === 0x00) {
      this.cursorAddress = 0x4f;
    } else {
      this.cursorAddress -= 1;
    }
  }

  private toDisplayChar(value: number) {
    if (value < 32 || value > 126) {
      return ' ';
    }

    return String.fromCharCode(value);
  }

  private flush() {
    const [line1, line2] = this.renderLines();
    if (
      line1 === this.lastRenderedLine1 &&
      line2 === this.lastRenderedLine2 &&
      this.backlight === this.lastRenderedBacklight
    ) {
      return;
    }

    this.lastRenderedLine1 = line1;
    this.lastRenderedLine2 = line2;
    this.lastRenderedBacklight = this.backlight;
    this.emit(line1, line2, this.backlight);
  }

  private renderLines() {
    if (!this.displayEnabled) {
      return [''.padEnd(LCD_WIDTH, ' '), ''.padEnd(LCD_WIDTH, ' ')];
    }

    const line1 = Array.from({ length: LCD_WIDTH }, (_, index) => this.ddram.get(index) || ' ').join('');
    const line2 = Array.from(
      { length: LCD_WIDTH },
      (_, index) => this.ddram.get(0x40 + index) || ' '
    ).join('');

    return [line1, line2] as const;
  }
}

class LCDTWIHandler implements TWIEventHandler {
  private twi: AVRTWI;
  private lcd: LCDController;
  private activeAddress: number | null = null;
  private writeMode = true;

  constructor(twi: AVRTWI, lcd: LCDController) {
    this.twi = twi;
    this.lcd = lcd;
  }

  start() {
    this.twi.completeStart();
  }

  stop() {
    this.activeAddress = null;
    this.twi.completeStop();
  }

  connectToSlave(addr: number, write: boolean) {
    this.activeAddress = addr;
    this.writeMode = write;
    this.twi.completeConnect(addr === LCD_ADDRESS);
  }

  writeByte(value: number) {
    if (this.activeAddress === LCD_ADDRESS && this.writeMode) {
      this.lcd.writeExpanderByte(value);
      this.twi.completeWrite(true);
      return;
    }

    this.twi.completeWrite(false);
  }

  readByte() {
    this.twi.completeRead(0xff);
  }
}

const normalizePin = (value: string) => {
  let pin = String(value || '').trim().toUpperCase();
  if (!pin) {
    return '';
  }

  if (pin === 'RX') {
    return 'D0';
  }

  if (pin === 'TX') {
    return 'D1';
  }

  if (pin === 'SDA') {
    return 'A4';
  }

  if (pin === 'SCL') {
    return 'A5';
  }

  if (/^GPIO\d+$/.test(pin)) {
    pin = `D${pin.slice(4)}`;
  }

  if (/^\d+$/.test(pin)) {
    pin = `D${pin}`;
  }

  return pin;
};

const parseIntelHex = (hex: string) => {
  const bytes = new Uint8Array(0x8000);
  let upperAddress = 0;

  for (const rawLine of String(hex || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith(':')) {
      continue;
    }

    const byteCount = Number.parseInt(line.slice(1, 3), 16);
    const address = Number.parseInt(line.slice(3, 7), 16);
    const recordType = Number.parseInt(line.slice(7, 9), 16);

    if (recordType === 0x04) {
      upperAddress = Number.parseInt(line.slice(9, 13), 16) << 16;
      continue;
    }

    if (recordType !== 0x00) {
      continue;
    }

    for (let index = 0; index < byteCount; index += 1) {
      const byte = Number.parseInt(line.slice(9 + index * 2, 11 + index * 2), 16);
      const target = upperAddress + address + index;
      if (target < bytes.length) {
        bytes[target] = byte;
      }
    }
  }

  const program = new Uint16Array(bytes.length / 2);
  for (let index = 0; index < bytes.length; index += 2) {
    program[index / 2] = bytes[index] | (bytes[index + 1] << 8);
  }

  return program;
};

const buildPinMap = (portB: AVRIOPort, portC: AVRIOPort, portD: AVRIOPort) => {
  const pinMap: Record<string, PinDescriptor> = {};

  for (let bit = 0; bit <= 7; bit += 1) {
    pinMap[`D${bit}`] = { key: `D${bit}`, port: portD, bit };
  }

  for (let bit = 0; bit <= 5; bit += 1) {
    pinMap[`D${bit + 8}`] = { key: `D${bit + 8}`, port: portB, bit };
  }

  for (let bit = 0; bit <= 5; bit += 1) {
    pinMap[`A${bit}`] = { key: `A${bit}`, port: portC, bit };
  }

  pinMap.SDA = pinMap.A4;
  pinMap.SCL = pinMap.A5;
  return pinMap;
};

const readPinLevel = (runner: RunnerState, key: string) => {
  const descriptor = runner.pinMap[key];
  if (!descriptor) {
    return false;
  }

  const { port, bit } = descriptor;
  // ??$$$ newer code — AVR architecture: DDR=1 means OUTPUT (write to PORT register),
  // DDR=0 means INPUT (read from PIN register). Using PORT for output pins is correct
  // because digitalWrite() writes to PORT, not PIN. Reading PIN for an output pin
  // reflects external input, not what the MCU is driving — so D13 LED always read false.
  const ddrRegister = port.portConfig.DDR;
  const isOutput = Boolean(runner.cpu.data[ddrRegister] & (1 << bit));
  const reg = isOutput ? port.portConfig.PORT : port.portConfig.PIN;
  return Boolean(runner.cpu.data[reg] & (1 << bit));
};

const capturePins = (runner: RunnerState) => {
  const nextPins: Record<string, boolean> = {};
  let changed = false;

  for (const key of runner.snapshotKeys) {
    const value = readPinLevel(runner, key);
    nextPins[key] = value;
    if (runner.lastPins[key] !== value) {
      changed = true;
    }
  }

  if (!changed) {
    return null;
  }

  runner.lastPins = nextPins;
  return nextPins;
};

const postPins = (runner: RunnerState, force = false) => {
  const pins = force
    ? Object.fromEntries(runner.snapshotKeys.map((key) => [key, readPinLevel(runner, key)]))
    : capturePins(runner);

  if (!pins) {
    return;
  }

  if (force) {
    runner.lastPins = { ...pins };
  }

  self.postMessage({ type: 'gpio', pins });
};

const stopRunner = (runner: RunnerState | null) => {
  if (!runner) {
    return null;
  }

  clearInterval(runner.tickHandle);
  return null;
};

let runner: RunnerState | null = null;

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  if (message.type === 'stop') {
    runner = stopRunner(runner);
    return;
  }

  if (message.type === 'button') {
    if (!runner) {
      return;
    }

    const normalized = normalizePin(message.pin);
    const descriptor = runner.pinMap[normalized];
    if (!descriptor) {
      return;
    }

    descriptor.port.setPin(descriptor.bit, message.state);
    postPins(runner, true);
    return;
  }

  if (message.type !== 'start') {
    return;
  }

  try {
    runner = stopRunner(runner);

    const cpu = new CPU(parseIntelHex(message.hex));
    const portB = new AVRIOPort(cpu, portBConfig);
    const portC = new AVRIOPort(cpu, portCConfig);
    const portD = new AVRIOPort(cpu, portDConfig);

    new AVRTimer(cpu, timer0Config);
    new AVRTimer(cpu, timer1Config);
    new AVRTimer(cpu, timer2Config);

    const usart = new AVRUSART(cpu, usart0Config, CLOCK_HZ);
    usart.onLineTransmit = (text) => {
      self.postMessage({ type: 'serial', text });
    };

    const lcd = new LCDController((line1, line2, backlight) => {
      self.postMessage({ type: 'lcd', line1, line2, backlight });
    });

    const twi = new AVRTWI(cpu, twiConfig, CLOCK_HZ);
    twi.eventHandler = new LCDTWIHandler(twi, lcd);

    const pinMap = buildPinMap(portB, portC, portD);
    const snapshotKeys = [
      'D0',
      'D1',
      'D2',
      'D3',
      'D4',
      'D5',
      'D6',
      'D7',
      'D8',
      'D9',
      'D10',
      'D11',
      'D12',
      'D13',
      'A0',
      'A1',
      'A2',
      'A3',
      'A4',
      'A5'
    ];

    const nextRunner: RunnerState = {
      cpu,
      portB,
      portC,
      portD,
      pinMap,
      snapshotKeys,
      lastPins: {},
      tickHandle: 0
    };

    for (const pin of message.buttonPins || []) {
      const descriptor = pinMap[normalizePin(pin)];
      descriptor?.port.setPin(descriptor.bit, true);
    }

    nextRunner.tickHandle = self.setInterval(() => {
      try {
        for (let index = 0; index < CYCLES_PER_SLICE; index += 1) {
          avrInstruction(cpu);
          cpu.tick();
        }

        postPins(nextRunner);
      } catch (error: any) {
        self.postMessage({
          type: 'error',
          error: error?.message || 'CPU execution failed'
        });
        runner = stopRunner(nextRunner);
      }
    }, 0);

    runner = nextRunner;
    postPins(nextRunner, true);
    self.postMessage({ type: 'ready' });
  } catch (error: any) {
    self.postMessage({
      type: 'error',
      error: error?.message || 'Failed to start AVR simulation'
    });
  }
};
```

---

### File: `virtual-playground/frontend/src/components/layout/Topbar.tsx`
```typescript
// ??$$$ non-important
import React, { useEffect } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import {
  Play, Pause, RotateCcw, Eye, EyeOff, Activity, LogOut, HardDrive
} from 'lucide-react';
import { motion } from 'framer-motion';

export const Topbar: React.FC = () => {
  // ??$$$ newer code: mobile navigation menu state
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const {
    simulationRunning, compiling, compilePhase,
    setSimulationRunning, resetSimulation,
    showWires, toggleWires, showLabels, toggleLabels,
    fps, cpuUsage, voltage, tickTelemetry, setTab
  } = useProjectStore();

  useEffect(() => {
    let interval: any;
    if (simulationRunning) interval = setInterval(tickTelemetry, 1000);
    return () => clearInterval(interval);
  }, [simulationRunning, tickTelemetry]);

  const [exporting, setExporting] = React.useState(false);
  const handleExport = async () => {
    const sessionId = new URLSearchParams(window.location.search).get('sessionId');
    if (!sessionId) { alert('No session ID in URL.'); return; }
    setExporting(true);
    try {
      const base = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
      const res = await fetch(`${base}/new-flow/export-local`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      alert(res.ok ? data.message || 'Exported!' : data.error || 'Export failed.');
    } catch { alert('Export error.'); }
    finally { setExporting(false); }
  };

  return (
    <header className="h-12 flex-shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-4 flex items-center justify-between select-none z-50 relative">

      {/* Brand */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm shadow-indigo-500/30">
          <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div>
          <p className="text-xs font-bold tracking-tight text-[var(--heading)] leading-none">Virtual Playground</p>
          <p className="text-[9px] text-[var(--text-muted)] leading-none mt-0.5">Arduino Workspace Runtime</p>
        </div>
      </div>

      {/* Controls */}
      {/* ??$$$ newer code: hide controls on mobile */}
      <div className="hidden md:flex items-center gap-1 bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl p-1">
        {/* RUN */}
        <motion.button
          whileTap={{ scale: compiling ? 1 : 0.95 }}
          onClick={() => { if (!compiling) void setSimulationRunning(true); }}
          disabled={compiling}
          title={compiling ? 'Compiling…' : 'Run'}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            compiling
              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 cursor-not-allowed'
              : simulationRunning
              ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 shadow-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--heading)] hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          {compiling
            ? <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
            : <Play className={`w-3.5 h-3.5 ${simulationRunning ? 'fill-current' : ''}`} />
          }
          <span>{compiling ? 'Building' : 'Run'}</span>
        </motion.button>

        {/* PAUSE */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => void setSimulationRunning(false)}
          title="Pause"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--heading)] hover:bg-black/5 dark:hover:bg-white/5 transition-all"
        >
          <Pause className="w-3.5 h-3.5" />
          <span>Pause</span>
        </motion.button>

        {/* RESET */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={resetSimulation}
          title="Reset"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-all"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </motion.button>

        <div className="w-px h-4 bg-[var(--border)] mx-0.5" />

        {/* WIRES */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={toggleWires}
          title="Toggle Wires"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            showWires
              ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10'
              : 'text-[var(--text-muted)] hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          {showWires ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          <span>Wires</span>
        </motion.button>

        {/* LABELS */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={toggleLabels}
          title="Toggle Labels"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            showLabels
              ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10'
              : 'text-[var(--text-muted)] hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          {showLabels ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          <span>Labels</span>
        </motion.button>
      </div>

      {/* Right: telemetry + actions */}
      {/* ??$$$ newer code: hide right panel on mobile */}
      <div className="hidden md:flex items-center gap-4 text-xs font-mono border-l border-[var(--border)] pl-4">

        {/* compile phase banner */}
        {compiling && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-400 text-[10px]"
          >
            <svg className="w-3 h-3 animate-spin flex-shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <span className="truncate max-w-[160px]">{compilePhase || 'Compiling…'}</span>
          </motion.div>
        )}

        {/* telemetry pills */}
        <div className="flex items-center gap-3 text-[var(--text-muted)]">
          <span>VCC: <span className={`font-semibold ${simulationRunning ? 'text-emerald-500' : 'text-[var(--text-muted)]'}`}>{voltage.toFixed(2)}V</span></span>
          <span>CPU: <span className={`font-semibold ${simulationRunning ? 'text-indigo-400' : 'text-[var(--text-muted)]'}`}>{cpuUsage}%</span>
            {simulationRunning && <Activity className="inline w-3 h-3 text-indigo-400 ml-0.5 animate-pulse" />}
          </span>
          <span>FPS: <span className={`font-semibold ${simulationRunning ? 'text-violet-400' : 'text-[var(--text-muted)]'}`}>{simulationRunning ? fps : 0}</span></span>
        </div>

        {/* Export */}
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text-muted)] hover:border-indigo-300 hover:text-indigo-600 dark:hover:border-indigo-500/40 dark:hover:text-indigo-400 text-xs font-sans transition-all disabled:opacity-50 cursor-pointer"
        >
          <HardDrive className="w-3 h-3" />
          <span>{exporting ? 'Exporting…' : 'Export'}</span>
        </button>

        {/* Exit */}
        <button
          onClick={() => { resetSimulation(); setTab('landing'); }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text-muted)] hover:border-red-300 hover:text-red-500 dark:hover:border-red-500/40 dark:hover:text-red-400 text-xs font-sans transition-all cursor-pointer"
        >
          <LogOut className="w-3 h-3" />
          <span>Exit</span>
        </button>
      </div>

      {/* ??$$$ newer code: Mobile hamburger menu toggle button */}
      <div className="flex md:hidden items-center gap-2">
        {compiling && (
          <span className="text-[10px] text-amber-500 font-mono animate-pulse max-w-[80px] truncate">
            {compilePhase || 'Building'}
          </span>
        )}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
        >
          {mobileMenuOpen ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* ??$$$ newer code: Hamburger dropdown overlay menu */}
      {mobileMenuOpen && (
        <div className="absolute top-12 left-0 right-0 bg-[var(--surface)] border-b border-[var(--border)] shadow-xl p-4 flex flex-col gap-4 z-50 md:hidden">
          {/* Simulation Commands */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Simulator Control</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => { if (!compiling) { void setSimulationRunning(true); setMobileMenuOpen(false); } }}
                disabled={compiling}
                className={`flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold border cursor-pointer ${
                  compiling
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : simulationRunning
                    ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                    : 'bg-[var(--surface-alt)] text-[var(--text)] border-[var(--border)]'
                }`}
              >
                <Play className="w-3 h-3" />
                <span>Run</span>
              </button>
              <button
                onClick={() => { void setSimulationRunning(false); setMobileMenuOpen(false); }}
                className="flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold bg-[var(--surface-alt)] text-[var(--text)] border border-[var(--border)] cursor-pointer"
              >
                <Pause className="w-3 h-3" />
                <span>Pause</span>
              </button>
              <button
                onClick={() => { resetSimulation(); setMobileMenuOpen(false); }}
                className="flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold bg-[var(--surface-alt)] text-red-500 border border-[var(--border)] cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Telemetry metrics */}
          <div className="bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl p-3">
            <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Telemetry</p>
            <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
              <div className="border-r border-[var(--border)]">
                <span className="text-[9px] text-[var(--text-muted)] block">VCC</span>
                <span className={`font-semibold ${simulationRunning ? 'text-emerald-500' : 'text-[var(--text-muted)]'}`}>{voltage.toFixed(2)}V</span>
              </div>
              <div className="border-r border-[var(--border)]">
                <span className="text-[9px] text-[var(--text-muted)] block">CPU</span>
                <span className={`font-semibold ${simulationRunning ? 'text-indigo-400' : 'text-[var(--text-muted)]'}`}>{cpuUsage}%</span>
              </div>
              <div>
                <span className="text-[9px] text-[var(--text-muted)] block">FPS</span>
                <span className={`font-semibold ${simulationRunning ? 'text-violet-400' : 'text-[var(--text-muted)]'}`}>{simulationRunning ? fps : 0}</span>
              </div>
            </div>
          </div>

          {/* View Toggles */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Visual Layers</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={toggleWires}
                className={`py-2 rounded-lg text-xs font-semibold border cursor-pointer text-center ${
                  showWires
                    ? 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20'
                    : 'text-[var(--text-muted)] bg-[var(--surface-alt)] border-[var(--border)]'
                }`}
              >
                Wires: {showWires ? 'Show' : 'Hide'}
              </button>
              <button
                onClick={toggleLabels}
                className={`py-2 rounded-lg text-xs font-semibold border cursor-pointer text-center ${
                  showLabels
                    ? 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20'
                    : 'text-[var(--text-muted)] bg-[var(--surface-alt)] border-[var(--border)]'
                }`}
              >
                Labels: {showLabels ? 'Show' : 'Hide'}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2 border-t border-[var(--border)] pt-3">
            <button
              onClick={() => { void handleExport(); setMobileMenuOpen(false); }}
              disabled={exporting}
              className="flex items-center justify-center gap-1 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text)] text-xs font-semibold cursor-pointer"
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>{exporting ? 'Exporting' : 'Export'}</span>
            </button>
            <button
              onClick={() => { resetSimulation(); setTab('landing'); setMobileMenuOpen(false); }}
              className="flex items-center justify-center gap-1 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] text-red-500 text-xs font-semibold cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Exit</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
```

---

### File: `virtual-playground/backend/index.js`
```javascript
// ??$$$ non-important
// ??$$$
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 5001;

const allowedOrigins = new Set([
  'http://localhost:5174',
  'http://127.0.0.1:5174'
]);

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.has(origin)) return callback(null, true);
    if (/^https?:\/\/localhost:\d+$/.test(origin) || /^https?:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json());

// Mock project database store
const mockProject = {
  id: "starter-project",
  name: "Virtual Playground Starter",
  description: "Load a formulated project payload to simulate its real sketch, wiring, and components.",
  author: "Virtual Playground",
  createdAt: "2026-06-06",
  bom: [],
  wiring: [],
  editableJson: {
    simulationSpeed: 1,
    ledInitialState: false,
    buttonInitialState: false
  },
  sketch: `// Starter sketch placeholder.
// Real behavior should come from the loaded project payload.

void setup() {
}

void loop() {
}
`
};

import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

app.get('/api/project', (req, res) => {
  const sessionId = req.query.sessionId;
  if (sessionId) {
    const exportDir = path.join("E:", "wireup_formulation_exports", `session_${sessionId}`);
    if (fs.existsSync(exportDir)) {
      try {
        console.log(`[API] Serving dynamic session project from E: drive for session: ${sessionId}`);
        const bom = JSON.parse(fs.readFileSync(path.join(exportDir, "bom.json"), "utf8") || "[]");
        const wiring = JSON.parse(fs.readFileSync(path.join(exportDir, "wiring.json"), "utf8") || "[]");
        const milestones = JSON.parse(fs.readFileSync(path.join(exportDir, "milestones.json"), "utf8") || "[]");
        const context = JSON.parse(fs.readFileSync(path.join(exportDir, "context.json"), "utf8") || "{}");
        const sketch = fs.readFileSync(path.join(exportDir, "sketch.ino"), "utf8") || "";

        // Build normalized projectData structure as expected by the frontend
        const projectPayload = {
          id: sessionId,
          name: context.corePurpose || "Wireup Project",
          description: "AI-formulated project loaded from E: drive",
          author: "Wireup AI",
          createdAt: new Date().toISOString().slice(0, 10),
          bom,
          wiring,
          editableJson: {
            simulationSpeed: 1,
            ledInitialState: false,
            buttonInitialState: false
          },
          sketch,
          context,
          phases: Array.isArray(context.subsystems)
            ? context.subsystems
            : (context.subsystems && typeof context.subsystems === "object"
                ? [
                    ...(context.subsystems.inputs || []),
                    ...(context.subsystems.outputs || []),
                    ...(context.subsystems.communication || []),
                    ...(context.subsystems.storage || []),
                    ...(context.subsystems.power || [])
                  ]
                : []),
          milestones,
          additionalTools: [
            "Soldering iron",
            "Solder wire",
            "Wire stripper",
            "Wire cutter",
            "Multimeter"
          ]
        };
        return res.json(projectPayload);
      } catch (err) {
        console.error(`[API] Error reading session exports for ${sessionId}:`, err);
      }
    } else {
      console.warn(`[API] Export directory not found for session: ${sessionId}`);
    }
  }

  console.log('[API] GET /api/project requested - serving fallback mockProject');
  res.json(mockProject);
});

const resolveArduinoCliPath = () => {
  if (process.env.ARDUINO_CLI_PATH?.trim()) {
    return process.env.ARDUINO_CLI_PATH.trim();
  }

  const home = process.env.USERPROFILE || process.env.HOME || '';
  const windowsLocal = path.join(home, '.arduino-cli', 'bin', 'arduino-cli.exe');
  const unixLocal = path.join(home, '.arduino-cli', 'bin', 'arduino-cli');

  if (fs.existsSync(windowsLocal)) return windowsLocal;
  if (fs.existsSync(unixLocal)) return unixLocal;

  return 'arduino-cli';
};

const runArduinoCli = (args, cwd = process.cwd()) =>
  new Promise((resolve) => {
    const child = spawn(resolveArduinoCliPath(), args, {
      cwd,
      shell: process.platform === 'win32'
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      resolve({ ok: code === 0, stdout, stderr });
    });

    child.on('error', (error) => {
      resolve({ ok: false, stdout, stderr: `${stderr}\n${error.message}`.trim() });
    });
  });

const liquidCrystalHeader = /#include\s*[<"]LiquidCrystal_I2C\.h[>"]/;
const liquidCrystalCandidates = ['LiquidCrystal_I2C', 'LiquidCrystal I2C'];
const installedLibraries = new Set();

const isLibraryInstalled = async (name) => {
  if (installedLibraries.has(name)) {
    return true;
  }

  const result = await runArduinoCli(['lib', 'list']);
  if (!result.ok) {
    return false;
  }

  const found = result.stdout.toLowerCase().includes(name.toLowerCase());
  if (found) {
    installedLibraries.add(name);
  }

  return found;
};

const ensureSketchLibraries = async (sketch) => {
  if (!liquidCrystalHeader.test(sketch || '')) {
    return;
  }

  for (const candidate of liquidCrystalCandidates) {
    if (await isLibraryInstalled(candidate)) {
      return;
    }
  }

  let lastError = null;
  for (const candidate of liquidCrystalCandidates) {
    const result = await runArduinoCli(['lib', 'install', candidate]);
    if (result.ok) {
      installedLibraries.add(candidate);
      return;
    }

    lastError = result.stderr || result.stdout || `Failed to install ${candidate}`;
  }

  throw new Error(lastError || 'LiquidCrystal_I2C is required but could not be installed');
};

app.post('/api/compile', async (req, res) => {
  const sketch = String(req.body?.sketch || '');
  const fqbn = String(req.body?.fqbn || 'arduino:avr:uno');

  if (!sketch.trim()) {
    return res.status(400).json({ error: 'sketch is required' });
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wireup-vp-compile-'));
  const sketchDir = path.join(tempRoot, 'sketch');
  const buildDir = path.join(tempRoot, 'build');

  try {
    await ensureSketchLibraries(sketch);

    fs.mkdirSync(sketchDir, { recursive: true });
    fs.mkdirSync(buildDir, { recursive: true });
    fs.writeFileSync(path.join(sketchDir, 'sketch.ino'), sketch, 'utf8');

    const result = await runArduinoCli(
      ['compile', '--fqbn', fqbn, '--output-dir', buildDir, sketchDir],
      sketchDir
    );

    if (!result.ok) {
      return res.status(400).json({
        error: result.stderr || result.stdout || 'Compilation failed'
      });
    }

    const firmwareName = fs.readdirSync(buildDir).find((name) => name.endsWith('.ino.hex'));
    if (!firmwareName) {
      return res.status(500).json({
        error: 'Compilation succeeded but firmware hex was not found'
      });
    }

    const hex = fs.readFileSync(path.join(buildDir, firmwareName), 'utf8');
    return res.json({ hex });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || 'Failed to compile sketch'
    });
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', database: 'mock-local-memory', timestamp: new Date() });
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 MERN BACKEND SERVER RUNNING ON PORT ${PORT}`);
  console.log(`📡 API endpoint: http://localhost:${PORT}/api/project`);
  console.log(`==================================================`);
});
```

---

### File: `frontend/src/components/DiscoveryModal/phases/FormulationPhase.tsx`
```typescript
import React from "react";
import {
  Terminal,
  Cpu,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  HardDrive,
  PlayCircle,
  LayoutDashboard,
  Copy,
} from "lucide-react";
import { ProgressTracker } from "../panels/ProgressTracker";
import { AgentConsole } from "../panels/AgentConsole";
import { HardwareAssembly } from "../panels/HardwareAssembly";
import { MilestonesPanel } from "../panels/MilestonesPanel";
import { BomPanel } from "../panels/BomPanel";

interface FormulationPhaseProps {
  dark: boolean;
  // state
  isCompleted: boolean;
  isFailed: boolean;
  activeStage: string;
  workspaceTab: "visual" | "console";
  setWorkspaceTab: (tab: "visual" | "console") => void;
  logs: any[];
  bom: any[];
  wiring: any[];
  milestones: any[];
  context: any;
  candidates: string[];
  decisions: string[];
  conflictDetails: {
    title: string;
    description: string;
    options: string[];
  } | null;
  exporting: boolean;
  restarting: boolean;
  loading: boolean;
  rescuing: boolean;
  selectedLog: any;
  setSelectedLog: (log: any) => void;
  finalSketch: string;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  // handlers
  handleRestart: () => void;
  handleGoToSimulator: () => void;
  handleExportLocal: () => void;
  handleCopyAllData: () => void;
  handleResume: () => void;
  handleRescue: () => void;
  resolveConflict: (choice: string) => void;
  // ??$$$ newer code
  blueprint: any;
  requirementsDoc: string;
  setShowContextModal: (show: boolean) => void;
}

export const FormulationPhase: React.FC<FormulationPhaseProps> = ({
  dark,
  isCompleted,
  isFailed,
  activeStage,
  workspaceTab,
  setWorkspaceTab,
  logs,
  bom,
  wiring,
  milestones,
  context,
  candidates,
  decisions,
  conflictDetails,
  exporting,
  restarting,
  loading,
  rescuing,
  selectedLog,
  setSelectedLog,
  finalSketch,
  scrollContainerRef,
  handleRestart,
  handleGoToSimulator,
  handleExportLocal,
  handleCopyAllData,
  handleResume,
  handleRescue,
  resolveConflict,
  // ??$$$ newer code
  blueprint,
  requirementsDoc,
  setShowContextModal,
}) => {
  return (
    /* PHASE 2: AUTOMATED FORMULATION LOOP */
    <div className="flex h-full overflow-hidden">
      {/* Left/Center Main Workspace */}
      <div
        className={`flex-1 flex flex-col overflow-hidden border-r ${
          dark
            ? "bg-[#0d0d12] border-white/[0.06]"
            : "bg-slate-50 border-slate-200"
        }`}
      >
        {/* Pipeline header */}
        <div
          className={`border-b px-6 py-4 flex flex-col md:flex-row justify-between gap-4 select-none ${
            dark
              ? "border-white/[0.06] bg-[#0d0d12]/80"
              : "border-slate-200 bg-white/80"
          }`}
        >
          <div className="space-y-2">
            <p
              className={`text-[10px] font-bold uppercase tracking-[0.18em] ${
                dark ? "text-slate-600" : "text-slate-400"
              }`}
            >
              AI Sourcing Pipeline
            </p>
            <ProgressTracker
              isCompleted={isCompleted}
              isFailed={isFailed}
              activeStage={activeStage}
              dark={dark}
            />
          </div>
          <div className="flex items-center gap-2.5">
            {/* tab switcher */}
            <div
              className={`flex rounded-xl p-0.5 border ${
                dark
                  ? "bg-white/[0.03] border-white/[0.06]"
                  : "bg-slate-100 border-slate-200"
              }`}
            >
              <button
                onClick={() => setWorkspaceTab("visual")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  workspaceTab === "visual"
                    ? dark
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                      : "bg-white text-indigo-700 shadow-sm border border-slate-200"
                    : dark
                    ? "text-slate-500 hover:text-slate-300"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                Visual Overview
              </button>
              <button
                onClick={() => setWorkspaceTab("console")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  workspaceTab === "console"
                    ? dark
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                      : "bg-white text-indigo-700 shadow-sm border border-slate-200"
                    : dark
                    ? "text-slate-500 hover:text-slate-300"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Terminal className="h-3.5 w-3.5" />
                Deep Agent Console
              </button>
            </div>

            <button
              onClick={handleRestart}
              disabled={restarting}
              className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all disabled:opacity-50 ${
                dark
                  ? "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.06]"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  restarting
                    ? "animate-spin text-indigo-400"
                    : dark
                    ? "text-slate-500"
                    : "text-slate-400"
                }`}
              />
              Restart Build
            </button>

            <button
              onClick={() => setShowContextModal(true)}
              className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all ${
                dark
                  ? "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.06]"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <Cpu className="h-3.5 w-3.5 text-indigo-400" />
              View Shared Context
            </button>

            {isCompleted && (
              <button
                onClick={handleGoToSimulator}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-indigo-500/25 hover:bg-indigo-700 transition-all"
              >
                <PlayCircle className="h-3.5 w-3.5" />
                Launch Playground
              </button>
            )}
          </div>
        </div>

        {/* Main Workspace View Panels */}
        {workspaceTab === "visual" ? (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Completion card */}
              {isCompleted && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-5 text-zinc-300 space-y-4 shadow-xl">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-zinc-100">
                        Formulation Completed Successfully!
                      </h4>
                      <p className="text-[11px] text-zinc-450">
                        BOM, wiring netlists, and code curriculum are generated.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleExportLocal}
                      disabled={exporting}
                      className="flex items-center gap-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-all"
                    >
                      <HardDrive className="h-3.5 w-3.5 text-emerald-400" />
                      {exporting ? "Exporting..." : "Export Data to local E:"}
                    </button>
                    <button
                      onClick={handleCopyAllData}
                      className="flex items-center gap-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-all"
                    >
                      <Copy className="h-3.5 w-3.5 text-emerald-455" />
                      Copy All Data
                    </button>
                    <button
                      onClick={handleGoToSimulator}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-450 px-4 py-1.5 text-xs font-bold text-zinc-950 transition-all"
                    >
                      <PlayCircle className="h-3.5 w-3.5" />
                      Open Virtual Playground
                    </button>
                  </div>
                </div>
              )}

              {/* Constraint conflict card */}
              {conflictDetails && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-955/15 p-5 text-zinc-300 space-y-3 shadow-lg">
                  <div className="flex items-center gap-2.5 text-amber-400 font-bold text-xs">
                    <AlertTriangle className="h-4 w-4 animate-pulse" />
                    <span>{conflictDetails.title}</span>
                  </div>
                  <p className="text-xs text-zinc-450 leading-relaxed">
                    {conflictDetails.description}
                  </p>
                  <div className="space-y-2 pt-2">
                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider font-mono">
                      Choose Resolution Path:
                    </div>
                    {conflictDetails.options.map((opt, idx) => (
                      <button
                        key={idx}
                        onClick={() => resolveConflict(opt)}
                        disabled={loading}
                        className="w-full text-left rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 hover:border-amber-550/50 p-3 text-xs text-zinc-300 transition-all active:scale-[0.99]"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Failure card */}
              {isFailed && !isCompleted && !conflictDetails && (
                <div className="rounded-xl border border-red-500/20 bg-red-950/10 p-5 text-zinc-300 space-y-3 shadow-lg">
                  <div className="flex items-center gap-2.5 text-red-400 font-bold text-xs">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Formulation Interrupted</span>
                  </div>
                  <p className="text-xs text-zinc-450 leading-relaxed font-sans">
                    The formulation loop stopped. You can resume from where it
                    was left off.
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      onClick={handleResume}
                      disabled={loading || rescuing}
                      className="flex items-center gap-1.5 rounded-lg bg-red-500 hover:bg-red-450 px-4 py-2 text-xs font-bold text-zinc-950 transition-all disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                      />
                      {loading ? "Resuming..." : "Resume Formulation"}
                    </button>

                    <button
                      onClick={handleRescue}
                      disabled={loading || rescuing}
                      className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-550 hover:to-amber-450 px-4 py-2 text-xs font-bold text-zinc-950 shadow-md shadow-amber-600/20 transition-all disabled:opacity-50"
                    >
                      <Cpu
                        className={`h-3.5 w-3.5 ${
                          rescuing ? "animate-pulse" : ""
                        }`}
                      />
                      {rescuing
                        ? "Rescuing..."
                        : "API Rescue (Groq/Cerebras/Gemini)"}
                    </button>
                  </div>
                </div>
              )}

              {/* Section 1: Live Hardware Assembly */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-mono">
                  Assembly Preview
                </div>
                <HardwareAssembly bom={bom} wiring={wiring} context={context} />
              </div>

              {/* Section 2: Milestone Timeline */}
              <MilestonesPanel milestones={milestones} />
            </div>

            {/* Bottom drawer/tray (Live AI activity log) */}
            <div className="h-44 border-t border-zinc-800 bg-zinc-955 flex flex-col">
              <div className="flex h-9 border-b border-zinc-850 bg-zinc-900/10 px-4 items-center justify-between select-none">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                  Live AI Activity Log
                </span>
                {logs.some(
                  (l) => l.type === "thinking" || l.type === "tool_call"
                ) && (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-[10px] leading-relaxed text-zinc-400">
                {logs.length === 0 && (
                  <div className="text-zinc-600 italic">
                    No logs initialized.
                  </div>
                )}
                {logs.slice(-15).map((log, i) => {
                  const timestampStr = log.timestamp
                    ? new Date(log.timestamp).toLocaleTimeString()
                    : "";
                  if (log.type === "thinking") {
                    return (
                      <div key={i} className="text-zinc-400 truncate">
                        <span className="text-zinc-600">[{timestampStr}]</span>{" "}
                        <span className="text-blue-400 font-bold">THINK:</span>{" "}
                        {log.text}
                      </div>
                    );
                  }
                  if (log.type === "tool_call") {
                    return (
                      <div key={i} className="text-zinc-300">
                        <span className="text-zinc-500">[{timestampStr}]</span>{" "}
                        <span className="text-emerald-400 font-bold">
                          TOOL:
                        </span>{" "}
                        {log.name} ({log.status})
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          </>
        ) : (
          /* DEEP AGENT CONSOLE */
          <AgentConsole
            logs={logs}
            selectedLog={selectedLog}
            setSelectedLog={setSelectedLog}
            scrollContainerRef={scrollContainerRef}
            finalSketch={finalSketch}
            handleCopyAllData={handleCopyAllData}
          />
        )}
      </div>

      {/* Right Sidebar */}
      <aside
        className={`w-72 border-l overflow-y-auto p-5 space-y-6 ${
          dark
            ? "border-white/[0.06] bg-[#0d0d12]"
            : "border-slate-200 bg-white"
        }`}
      >
        {/* Project Constraints */}
        <div>
          <p
            className={`text-[10px] font-bold uppercase tracking-[0.18em] mb-3 ${
              dark ? "text-slate-600" : "text-slate-400"
            }`}
          >
            Project Constraints
          </p>
          <div className="space-y-3">
            {[
              { label: "Core Purpose", value: context.corePurpose },
              { label: "Compute Brain", value: context.mcu },
              { label: "Power Source", value: context.powerSource },
              {
                label: "Connectivity",
                value: Array.isArray(context.connectivity)
                  ? context.connectivity.join(", ")
                  : context.connectivity
              },
              { label: "Form Factor", value: context.formFactor },
              { label: "Estimated Budget", value: context.estimatedBudget }
            ]
              .filter((f) => f.value && (typeof f.value !== "string" || f.value.trim() !== ""))
              .map(({ label, value }) => (
                <div key={label}>
                  <p
                    className={`text-[10px] font-semibold mb-1 uppercase tracking-wider ${
                      dark ? "text-slate-600" : "text-slate-400"
                    }`}
                  >
                    {label}
                  </p>
                  <p
                    className={`text-sm font-medium leading-snug ${
                      dark ? "text-slate-300" : "text-slate-700"
                    }`}
                  >
                    {value}
                  </p>
                </div>
              ))}
            {!context.corePurpose && !context.mcu && (
              <p
                className={`text-xs italic ${
                  dark ? "text-slate-700" : "text-slate-400"
                }`}
              >
                Extracting from idea…
              </p>
            )}
          </div>
        </div>

        {/* Confirmed BOM + Candidates */}
        <BomPanel bom={bom} candidates={candidates} dark={dark} />

        {/* AI Rationale */}
        {decisions.length > 0 && (
          <div
            className={`border-t pt-5 ${
              dark ? "border-white/[0.06]" : "border-slate-100"
            }`}
          >
            <p
              className={`text-[10px] font-bold uppercase tracking-[0.18em] mb-3 ${
                dark ? "text-slate-600" : "text-slate-400"
              }`}
            >
              AI Rationale
            </p>
            <div className="space-y-2">
              {decisions.map((dec, idx) => (
                <div
                  key={idx}
                  className={`rounded-xl border p-3 text-xs leading-relaxed ${
                    dark
                      ? "border-white/[0.05] bg-white/[0.02] text-slate-400"
                      : "border-slate-100 bg-slate-50 text-slate-600"
                  }`}
                >
                  {dec}
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
};
```

---

## 2. Additional Context

### Active Formulation Integration (Backend $\rightarrow$ Frontend)
The formulation agent (running in the backend) produces structured hardware session data that is saved in `NewFlowSession` MongoDB documents:
- **BOM (`session.bom`)**: Array of components (keys, names, purpose, quantity, pinConnections).
- **Wiring (`session.wiring`)**: Connection definitions (`{ from: string, to: string, net: string, color: string }`).
- **Milestones (`session.milestones`)**: Ordered development stages containing code strings (`code`), explanations, objectives.
- **Sketch (`session.finalSketch`)**: The complete finalized compilable Arduino firmware code.

When transitioning from the **Formulation Phase** modal to the **Virtual Playground**, the frontend retrieves a mapped payload via:
`GET /api/new-flow/session-project/:sessionId`

This hits the backend handler `getVirtualProjectData` in `backend/src/controllers/newflow.controller.ts`, which runs `mapSessionToVirtualProject(session)` to bridge the data structures.

### Key Bridging Responsibilities in `mapSessionToVirtualProject`:
1. **Circular Component Arrangement**: Computes standard 3D grid layout positions `[x, y, z]` and inward rotations around the central MCU since the formulation agent outputs are non-spatial.
2. **Category Classification**: Translates component keywords and wokwi parts to classifications (`led`, `button`, `display`, `sensor`, `motor`).
3. **Pin Coordinates mapping**: Translates database Part footprints to 3D simulation terminal points.
4. **Wokwi Simulator Pin Translation (`normalizeMcuPin`)**: Translates microcontroller GPIO and power/GND pin names generated by LLMs to simulation-compatible names (e.g. `GPIO21` $\rightarrow$ `mcu.SDA`, `GPIO22` $\rightarrow$ `mcu.SCL`, `3V3` $\rightarrow$ `mcu.3.3V`).
5. **Sketch Selection**: Binds the final sketch code or the latest completed milestone code to the workspace's editor.
