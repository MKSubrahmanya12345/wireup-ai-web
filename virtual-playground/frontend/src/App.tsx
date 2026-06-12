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
// ??$$$ newer code - BehaviorPlayground import
import { BehaviorPlayground } from './components/behavior/BehaviorPlayground';



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

  // ??$$$ newer code - Intercept Behavior mode parameters
  const mode = searchParams.get('mode');
  if (mode === 'behavior') {
    return <BehaviorPlayground sessionId={sessionId} projectId={projectId} />;
  }

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
