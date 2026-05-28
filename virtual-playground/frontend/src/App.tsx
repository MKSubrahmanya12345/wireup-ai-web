// ??$$$
import { useState } from 'react';
import { useProjectStore } from './store/useProjectStore';
import { projectData } from './data/project';
import { Topbar } from './components/layout/Topbar';
import { Sidebar } from './components/layout/Sidebar';
import { RightSidebar } from './components/layout/RightSidebar';
import { BottomPanel } from './components/layout/BottomPanel';
import { Scene } from './components/three/Scene';
import { CodeEditor } from './components/editor/CodeEditor';
import { 
  Play, 
  Cpu, 
  Layers, 
  Terminal, 
  Sparkles, 
  ChevronRight, 
  Code 
} from 'lucide-react';
import { motion } from 'framer-motion';

/* Commenting out original App.tsx code to maintain rule compliance
import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <section id="center">
        ...
      </section>
    </>
  )
}
export default App
*/

// ??$$$
function App() {
  const { currentTab, setTab, loadProject, addLog } = useProjectStore();
  const [viewMode, setViewMode] = useState<'split' | 'three' | 'code'>('split');

  const handleLaunch = () => {
    loadProject(projectData);
    setTab('playground');
    addLog('[SYSTEM] Loaded Virtual Arduino Circuit Demo', 'system');
  };

  if (currentTab === 'landing') {
    return (
      <div className="min-h-screen bg-[#03030a] text-slate-100 relative overflow-hidden flex flex-col justify-between cyber-grid">
        {/* Ambient Top Glow Spheres */}
        <div className="absolute top-[-20%] left-[20%] w-[500px] h-[500px] rounded-full bg-purple-900/10 blur-[120px] pointer-events-none" />
        <div className="absolute top-[-10%] right-[10%] w-[600px] h-[600px] rounded-full bg-cyan-900/10 blur-[130px] pointer-events-none" />
        
        {/* Landing Top Header Bar */}
        <header className="h-16 px-8 flex items-center justify-between border-b border-[#1f1f45]/50 bg-black/20 backdrop-blur-md relative z-10">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center shadow-cyber">
              <Cpu className="w-4 h-4 text-white" />
            </div>
            <span className="font-mono text-sm font-bold tracking-widest text-white uppercase">
              WIREUP<span className="text-cyan-400">.AI</span>
            </span>
          </div>
          <div className="flex items-center space-x-4 text-xs font-mono text-slate-400">
            <span className="flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
              <span>NODE: ACTIVE</span>
            </span>
          </div>
        </header>

        {/* Hero Body section */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 relative z-10 max-w-5xl mx-auto text-center">
          {/* Sparkles intro card badge */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center space-x-2 bg-[#12122b] border border-[#00f0ff]/30 px-3.5 py-1.5 rounded-full text-xs font-mono text-cyan-300 shadow-cyber mb-6"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
            <span>INTERACTIVE HARDWARE SIMULATION PROTOXY</span>
          </motion.div>

          {/* Main Titles */}
          <motion.h1
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="text-4xl sm:text-6xl font-bold tracking-tight font-sans text-white mb-6 uppercase"
          >
            Virtual Hardware <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-purple-500 cyber-glow">
              Playground
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.35 }}
            className="text-slate-400 text-sm sm:text-lg font-mono max-w-2xl mb-10 leading-relaxed"
          >
            Interactive browser-based electronics simulation. Connect sensors, write logic, and run microcontrollers in a high-fidelity 3D sandbox.
          </motion.p>

          {/* Launch Action Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: '0 0 25px rgba(0, 240, 255, 0.4)' }}
              whileTap={{ scale: 0.98 }}
              onClick={handleLaunch}
              className="flex items-center space-x-3 px-8 py-4 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-lg text-sm font-mono font-bold tracking-wider text-white shadow-cyber uppercase cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Launch Playground</span>
              <ChevronRight className="w-4 h-4" />
            </motion.button>
          </motion.div>

          {/* Grid Cards showing features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 w-full text-left font-mono">
            {/* Feature 1 */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="p-5 rounded-lg border border-[#1f1f45] bg-[#07071c]/70 backdrop-blur-md space-y-2.5"
            >
              <div className="w-9 h-9 rounded bg-cyan-950/50 border border-cyan-800/40 flex items-center justify-center">
                <Layers className="w-4 h-4 text-cyan-400" />
              </div>
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider">3D Electronics Lab</h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Interact with procedural 3D microcontrollers, buttons, and breadboards inside a responsive Three.js environment.
              </p>
            </motion.div>

            {/* Feature 2 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="p-5 rounded-lg border border-[#1f1f45] bg-[#07071c]/70 backdrop-blur-md space-y-2.5"
            >
              <div className="w-9 h-9 rounded bg-purple-950/50 border border-purple-800/40 flex items-center justify-center">
                <Code className="w-4 h-4 text-purple-400" />
              </div>
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Integrated Monaco IDE</h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Inspect Arduino sketch code (`sketch.ino`), editable hardware parameters, and wiring configuration schemas side-by-side.
              </p>
            </motion.div>

            {/* Feature 3 */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="p-5 rounded-lg border border-[#1f1f45] bg-[#07071c]/70 backdrop-blur-md space-y-2.5"
            >
              <div className="w-9 h-9 rounded bg-emerald-950/50 border border-emerald-800/40 flex items-center justify-center">
                <Terminal className="w-4 h-4 text-emerald-400" />
              </div>
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Telemetry Serial Log</h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Monitor CPU core utilization, running clock FPS, voltage streams, and reactive debug logs live as you play.
              </p>
            </motion.div>
          </div>
        </main>

        {/* Footer info */}
        <footer className="h-14 px-8 flex items-center justify-between border-t border-[#1f1f45]/50 bg-black/40 text-[10px] text-slate-500 font-mono relative z-10">
          <span>© 2026 Wireup Virtual electronics demo. All fake data simulated locally.</span>
          <span className="text-cyan-600">STABLE DEVELOPMENT COMPILATION</span>
        </footer>
      </div>
    );
  }

  // Else, show playground view
  return (
    <div className="h-screen flex flex-col bg-[#03030c] text-slate-100 overflow-hidden font-sans">
      {/* Top Header Controls Panel */}
      <Topbar />

      {/* Main Sandbox Layout Area */}
      <div className="flex-1 flex min-h-0">
        {/* Left Explorer & BOM Sidebar */}
        <Sidebar />

        {/* Center Panel (Split or individual views) */}
        <div className="flex-1 flex flex-col bg-[#050512]">
          {/* View Selection Bar */}
          <div className="h-9 bg-[#0c0c24] border-b border-[#1f1f45] flex items-center px-4 space-x-3 text-xs select-none">
            <span className="text-slate-500 font-mono text-[10px] uppercase tracking-wider mr-2">Workspace Canvas View:</span>
            
            <button
              onClick={() => setViewMode('split')}
              className={`px-2.5 py-1 rounded text-xs font-mono transition-all cursor-pointer ${
                viewMode === 'split' ? 'bg-[#1b1b3f] text-cyan-400 border border-[#00f0ff]/30 shadow-cyber' : 'text-slate-400 hover:text-white'
              }`}
            >
              Split View
            </button>

            <button
              onClick={() => setViewMode('three')}
              className={`px-2.5 py-1 rounded text-xs font-mono transition-all cursor-pointer ${
                viewMode === 'three' ? 'bg-[#1b1b3f] text-cyan-400 border border-[#00f0ff]/30 shadow-cyber' : 'text-slate-400 hover:text-white'
              }`}
            >
              3D View Only
            </button>

            <button
              onClick={() => setViewMode('code')}
              className={`px-2.5 py-1 rounded text-xs font-mono transition-all cursor-pointer ${
                viewMode === 'code' ? 'bg-[#1b1b3f] text-cyan-400 border border-[#00f0ff]/30 shadow-cyber' : 'text-slate-400 hover:text-white'
              }`}
            >
              IDE Code Only
            </button>
          </div>

          {/* Main View Area */}
          <div className="flex-1 flex min-h-0 relative">
            {/* SPLIT VIEW (Code Left, 3D Right) */}
            {viewMode === 'split' && (
              <>
                <div className="w-1/2 h-full flex flex-col">
                  <CodeEditor />
                </div>
                <div className="w-1/2 h-full relative">
                  <Scene />
                </div>
              </>
            )}

            {/* 3D CANVAS VIEW */}
            {viewMode === 'three' && (
              <div className="w-full h-full relative">
                <Scene />
              </div>
            )}

            {/* CODE IDE VIEW */}
            {viewMode === 'code' && (
              <div className="w-full h-full flex flex-col">
                <CodeEditor />
              </div>
            )}
          </div>

          {/* Console Outputs & Ports Panel */}
          <BottomPanel />
        </div>

        {/* Right Metadata & Telemetry Inspector Sidebar */}
        <RightSidebar />
      </div>
    </div>
  );
}

export default App;
