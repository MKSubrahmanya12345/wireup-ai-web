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
      // ??$$$ newer code
      const hex = data.hex;
      if (!hex) {
        if (data.isESP32) {
          setLog('ESP32 simulation manifest updated via Socket.io');
          setCompiling(false);
          setRunning(true);
          return;
        }
        setLog('Compile failed: missing HEX');
        setCompiling(false);
        return;
      }


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

