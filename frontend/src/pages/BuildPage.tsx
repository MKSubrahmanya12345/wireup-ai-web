// @ts-nocheck
// ??$$$ FORGE: BuildPage.jsx — Stage 3: Sketch editor + simulator + diagram viewer
// Three-panel: CodeMirror sketch | SimCanvas/WokwiSimulator | DiagramViewer
// Compile animation: green pulse on success, shake on error
// Diff view: before/after on regeneration (simple line diff)

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { axiosInstance } from '../lib/axios';
import toast from 'react-hot-toast';
import { useThemeStore } from '../store/useThemeStore';
import { useProjectStore } from '../store/useProjectStore';
import WokwiSimulator from '../components/WokwiSimulator';
import { useCompiler } from '../hooks/useCompiler';
import useIsMobile from '../hooks/useIsMobile';

const Simulator3D = lazy(() => import('../components/Simulator3D'));


// API removed

// ─── Simple diff highlighter (before/after on sketch lines) ──────────────────
function DiffView({ before, after, isDark }) {
  if (!before || !after) return null;

  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const maxLen = Math.max(beforeLines.length, afterLines.length);

  const diffs = [];
  for (let i = 0; i < maxLen; i++) {
    const a = beforeLines[i];
    const b = afterLines[i];
    if (a === b) {
      diffs.push({ type: 'same', line: b ?? '' });
    } else if (a === undefined) {
      diffs.push({ type: 'added', line: b });
    } else if (b === undefined) {
      diffs.push({ type: 'removed', line: a });
    } else {
      diffs.push({ type: 'removed', line: a });
      diffs.push({ type: 'added', line: b });
    }
  }

  return (
    <div style={{
      fontFamily: 'monospace',
      fontSize: '0.7rem',
      lineHeight: 1.5,
      overflowX: 'auto',
      overflowY: 'auto',
      maxHeight: '200px',
      background: isDark ? '#0f172a' : '#f8fafc',
      borderRadius: '8px',
      padding: '0.5rem',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
    }}>
      {diffs.map((d, i) => (
        <div key={i} style={{
          background: d.type === 'added'
            ? (isDark ? 'rgba(34,197,94,0.12)' : '#f0fdf4')
            : d.type === 'removed'
              ? (isDark ? 'rgba(239,68,68,0.12)' : '#fef2f2')
              : 'transparent',
          color: d.type === 'added'
            ? '#22c55e'
            : d.type === 'removed'
              ? '#ef4444'
              : (isDark ? '#a3a3a3' : '#555'),
          paddingLeft: '4px',
          whiteSpace: 'pre',
        }}>
          {d.type === 'added' ? '+ ' : d.type === 'removed' ? '- ' : '  '}{d.line}
        </div>
      ))}
    </div>
  );
}

// ─── Compile error panel ──────────────────────────────────────────────────────
function CompileErrorPanel({ errors, isDark }) {
  if (!errors?.length) return null;
  return (
    <div style={{
      background: isDark ? '#1a0606' : '#fff5f5',
      border: `1px solid ${isDark ? '#7f1d1d' : '#fca5a5'}`,
      borderRadius: '8px',
      padding: '0.75rem',
      marginTop: '0.5rem',
      maxHeight: '120px',
      overflowY: 'auto',
    }}>
      {errors.map((err, i) => (
        <div key={i} style={{ fontSize: '0.7rem', color: isDark ? '#f87171' : '#b91c1c', marginBottom: '4px', fontFamily: 'monospace' }}>
          {err.line ? `Line ${err.line}: ` : ''}{err.message || String(err)}
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function BuildPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const { project, updateSketch, refreshStageStatus } = useProjectStore();

  const [sketch, setSketch] = useState('');
  const [prevSketch, setPrevSketch] = useState('');
  const [diagram, setDiagram] = useState(null);
  const [diagramText, setDiagramText] = useState(''); // ??$$$ editable raw JSON string
  const [diagramJsonError, setDiagramJsonError] = useState(null); // ??$$$ parse error message
  const [loading, setLoading] = useState(true);
  const [compileState, setCompileState] = useState('idle'); // idle | success | error
  const [hexCode, setHexCode] = useState('');
  const [compileErrors, setCompileErrors] = useState([]);
  const [showDiff, setShowDiff] = useState(false);
  const [syncBanner, setSyncBanner] = useState(false);
  const [activeTab, setActiveTab] = useState('sim'); // sim | diagram
  const [simView, setSimView] = useState('2d'); // 2d | 3d
  const [warnings, setWarnings] = useState([]);
  const [generatingSketch, setGeneratingSketch] = useState(false);
  const [generatingDiagram, setGeneratingDiagram] = useState(false);
  const [savingDiagram, setSavingDiagram] = useState(false); // ??$$$

  // ??$$$
  const [bom, setBom] = useState([]);
  const [compilingLocal, setCompilingLocal] = useState(false);

  const isMobile = useIsMobile();
  const [mobileBuildTab, setMobileBuildTab] = useState('editor'); // ??$$$ 'editor' | 'sim' | 'diagram'
  const [registry, setRegistry] = useState({});


  const { compile, compiling, lastResult } = useCompiler();
  const compileButtonRef = useRef(null);
  const saveTimer = useRef(null);
  const diagramSaveTimer = useRef(null); // ??$$$

  // ??$$$ Keep diagramText in sync whenever diagram object changes (AI gen or load)
  useEffect(() => {
    if (diagram) {
      setDiagramText(JSON.stringify(diagram, null, 2));
      setDiagramJsonError(null);
    }
  }, [diagram]);

  // Load build artifacts
  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const res = await axiosInstance.get(`/build/${id}`, { withCredentials: true });
        const { sketch: s = '', diagram: d = {}, bom: b = [], lastCompilation } = res.data;
        setSketch(s);
        setPrevSketch(s);
        setDiagram(d);
        setBom(b);
        if (lastCompilation) {
          if (lastCompilation.hex) {
            setHexCode(lastCompilation.hex);
            setCompileState('success');
          } else if (lastCompilation.compilationErrors?.length > 0) {
            setCompileErrors(lastCompilation.compilationErrors);
            setCompileState('error');
          }
        }
      } catch (err) {
        // Fallback to project store
        setSketch(project?.sketch || '');
        setDiagram(project?.diagram || null);
        setBom(project?.bom || []);
      } finally {
        setLoading(false);
      }
    };
    load();
    axiosInstance.get("/wokwi/registry").then(res => setRegistry(res.data)).catch(console.error);
  }, [id, project]);

  // Auto-save sketch with debounce (one-directional sync)
  const handleSketchChange = useCallback((e) => {
    const val = e.target.value;
    setSketch(val);
    setSyncBanner(val !== prevSketch);

    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await updateSketch(val);
      } catch {
        // silent
      }
    }, 1500);
  }, [prevSketch, updateSketch]);

  // Compile to hex using backend POST /api/build/compile with Hexi compiler fallback
  const handleCompile = async () => {
    if (compilingLocal || compiling) return;
    setCompilingLocal(true);
    setCompileErrors([]);
    setHexCode('');

    try {
      // First save the current sketch
      await axiosInstance.post('/build/sync', {
        projectId: id,
        sketch,
        diagram
      }, { withCredentials: true });

      // Try backend compiler
      console.log("[BuildPage] Initiating backend compilation...");
      const res = await axiosInstance.post('/build/compile', { projectId: id }, { withCredentials: true });
      if (res.data?.success) {
        setCompileState('success');
        setHexCode('hex');
        if (compileButtonRef.current) {
          compileButtonRef.current.style.animation = 'compilePulse 0.5s ease';
          setTimeout(() => {
            if (compileButtonRef.current) compileButtonRef.current.style.animation = '';
          }, 600);
        }
        await refreshStageStatus();
        toast.success('Compiled successfully on server!');
      } else {
        const errors = res.data?.errors || [];
        const isCliError = errors.some(e => 
          String(e).includes('arduino-cli') || 
          String(e).includes('spawn') || 
          String(e).includes('not found') || 
          String(e).includes('ENOENT') ||
          String(e).includes('executable')
        );

        if (isCliError) {
          console.warn("[BuildPage] Backend CLI compiler unavailable. Falling back to Cloud compiler...");
          const result = await compile(sketch, diagram);
          if (result.success) {
            setHexCode(result.hex);
            setCompileState('success');
            if (compileButtonRef.current) {
              compileButtonRef.current.style.animation = 'compilePulse 0.5s ease';
              setTimeout(() => {
                if (compileButtonRef.current) compileButtonRef.current.style.animation = '';
              }, 600);
            }
            await refreshStageStatus();
            toast.success('Compiled successfully via cloud compiler!');
          } else {
            setCompileErrors(result.errors);
            setCompileState('error');
            if (compileButtonRef.current) {
              compileButtonRef.current.style.animation = 'compileShake 0.3s ease';
              setTimeout(() => {
                if (compileButtonRef.current) compileButtonRef.current.style.animation = '';
              }, 400);
            }
            toast.error('Cloud compilation failed');
          }
        } else {
          setCompileErrors(errors);
          setCompileState('error');
          if (compileButtonRef.current) {
            compileButtonRef.current.style.animation = 'compileShake 0.3s ease';
            setTimeout(() => {
              if (compileButtonRef.current) compileButtonRef.current.style.animation = '';
            }, 400);
          }
          toast.error('Compilation failed — check errors below');
        }
      }
    } catch (err) {
      console.warn("[BuildPage] Backend compiler exception. Falling back to Cloud compiler...", err);
      const result = await compile(sketch, diagram);
      if (result.success) {
        setHexCode(result.hex);
        setCompileState('success');
        if (compileButtonRef.current) {
          compileButtonRef.current.style.animation = 'compilePulse 0.5s ease';
          setTimeout(() => {
            if (compileButtonRef.current) compileButtonRef.current.style.animation = '';
          }, 600);
        }
        await refreshStageStatus();
        toast.success('Compiled successfully via cloud compiler!');
      } else {
        setCompileErrors(result.errors);
        setCompileState('error');
        if (compileButtonRef.current) {
          compileButtonRef.current.style.animation = 'compileShake 0.3s ease';
          setTimeout(() => {
            if (compileButtonRef.current) compileButtonRef.current.style.animation = '';
          }, 400);
        }
        toast.error('Cloud compilation failed: ' + err.message);
      }
    } finally {
      setCompilingLocal(false);
    }
  };

  const handleGenSketch = async () => {
    if (generatingSketch) return;
    setGeneratingSketch(true);
    try {
      setPrevSketch(sketch);
      const res = await axiosInstance.post(`/build/generate-sketch`, { projectId: id }, { withCredentials: true });
      setSketch(res.data?.sketch || sketch);
      setWarnings(res.data?.warnings || []);
      setShowDiff(true);
      toast.success('Sketch generated!');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Sketch generation failed');
    } finally {
      setGeneratingSketch(false);
    }
  };

  const handleGenDiagram = async () => {
    if (generatingDiagram) return;
    setGeneratingDiagram(true);
    try {
      const res = await axiosInstance.post(`/build/generate-diagram`, { projectId: id }, { withCredentials: true });
      setDiagram(res.data?.diagram || diagram);
      setWarnings(res.data?.warnings || []);
      toast.success('Diagram generated!');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Diagram generation failed');
    } finally {
      setGeneratingDiagram(false);
    }
  };

  const compileButtonColor = () => {
    if (compileState === 'success') return '#22c55e';
    if (compileState === 'error') return '#ef4444';
    return '#2563eb';
  };

  return (
    <div className="forge-build-container" style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: 'calc(100vh - 52px)',
      position: 'relative',
      background: isDark ? '#141414' : '#f5f5f5',
      color: isDark ? '#f1f3f9' : '#1a1a1a',
      fontFamily: "'Outfit', 'Inter', sans-serif",
      overflow: 'hidden',
    }}>

      <style>{`
        @keyframes compilePulse {
          0%   { box-shadow: 0 0 0 0 rgba(34,197,94,0.7); }
          70%  { box-shadow: 0 0 0 14px rgba(34,197,94,0); }
          100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
        }
        @keyframes compileShake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        .mobile-tab-btn {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          border: none;
          background: none;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border-radius: 12px;
          margin: 4px;
        }
        .mobile-tab-btn.active {
          background: ${isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.08)'};
          color: #3b82f6 !important;
        }
        .glass-nav {
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          background: ${isDark ? 'rgba(20, 20, 20, 0.8)' : 'rgba(255, 255, 255, 0.8)'};
        }
      `}</style>


      {/* Sync / Pin Warnings banner */}
      {(syncBanner || warnings.length > 0) && (
        <div style={{
          padding: '0.4rem 1.25rem',
          background: warnings.length > 0 ? (isDark ? '#451a03' : '#fff7ed') : (isDark ? '#1e3a5f' : '#eff6ff'),
          borderBottom: `1px solid ${warnings.length > 0 ? (isDark ? '#92400e' : '#fed7aa') : (isDark ? '#1d4ed8' : '#bfdbfe')}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.75rem',
        }}>
          <span style={{ color: warnings.length > 0 ? (isDark ? '#fbbf24' : '#9a3412') : (isDark ? '#93c5fd' : '#1d4ed8'), fontWeight: 600 }}>
            {warnings.length > 0 
              ? `⚠ Pin Sync Warning: ${warnings[0]} ${warnings.length > 1 ? `(+${warnings.length - 1} more)` : ''}`
              : '⚡ Sketch edited — diagram may be out of sync. Recompile to verify.'}
          </span>
          <button onClick={() => { setSyncBanner(false); setWarnings([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#fbbf24' : '#1d4ed8' }}>✕</button>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', gap: '0', flexDirection: isMobile ? 'column' : 'row' }}>

        {/* ── Left Pane (40%): Sketch Editor + Terminal ─────────────────────────────────────── */}
        <div style={{
          width: isMobile ? '100%' : '40%',
          minWidth: isMobile ? '100%' : '350px',
          display: (isMobile && mobileBuildTab !== 'editor') ? 'none' : 'flex',
          flexDirection: 'column',
          borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          background: isDark ? '#0f172a' : '#fff',
          height: '100%',
        }}>
          {/* Sketch Header */}
          <div style={{
            padding: '0.625rem 1rem',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: isDark ? '#0a1628' : '#f9fafb',
          }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: isDark ? '#6b7280' : '#9ca3af' }}>
              Firmware (sketch.ino)
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={handleGenSketch} disabled={generatingSketch} style={{
                padding: '0.2rem 0.625rem', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 600,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
                background: 'transparent', color: isDark ? '#a3a3a3' : '#555', cursor: generatingSketch ? 'not-allowed' : 'pointer',
              }}>
                {generatingSketch ? 'Generating…' : '✨ AI Gen Sketch'}
              </button>
              <button
                ref={compileButtonRef}
                onClick={handleCompile}
                disabled={compilingLocal || compiling || !sketch}
                style={{
                  padding: '0.2rem 0.75rem', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 700,
                  background: compileButtonColor(),
                  color: '#fff', border: 'none', cursor: (compilingLocal || compiling || !sketch) ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                {compilingLocal || compiling ? 'Compiling…' : compileState === 'success' ? '✓ Compiled' : compileState === 'error' ? '✕ Error' : '▶ Compile'}
              </button>
            </div>
          </div>

          {/* Editor Container */}
          <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {loading ? (
              <div style={{ flex: 1, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Array.from({ length: 15 }).map((_, i) => (
                  <div key={i} style={{
                    height: '13px', borderRadius: '4px',
                    width: `${40 + Math.random() * 55}%`,
                    background: isDark
                      ? 'linear-gradient(90deg,#1e293b 25%,#253347 50%,#1e293b 75%)'
                      : 'linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 50%,#e5e7eb 75%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.4s infinite',
                  }} />
                ))}
              </div>
            ) : (
              <textarea
                value={sketch}
                onChange={handleSketchChange}
                spellCheck={false}
                style={{
                  flex: 1,
                  padding: '1rem',
                  fontFamily: '"Fira Code", "Cascadia Code", monospace',
                  fontSize: '0.8rem',
                  lineHeight: 1.65,
                  background: isDark ? '#0f172a' : '#fff',
                  color: isDark ? '#e2e8f0' : '#1e293b',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  tabSize: 2,
                  width: '100%',
                }}
              />
            )}
          </div>

          {/* Terminal / Output Panel (Errors / Warnings) */}
          <div style={{
            height: '180px',
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            background: isDark ? '#0b0f19' : '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            minHeight: '120px',
          }}>
            <div style={{
              padding: '0.4rem 1rem',
              background: isDark ? '#070a13' : '#f1f5f9',
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: isDark ? '#64748b' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Compilation Terminal
              </span>
              <span style={{
                fontSize: '0.6rem',
                fontWeight: 600,
                color: compileState === 'success' ? '#22c55e' : compileState === 'error' ? '#ef4444' : '#64748b',
              }}>
                {compileState === 'success' ? 'SUCCESS' : compileState === 'error' ? 'FAILED' : 'IDLE'}
              </span>
            </div>
            <div style={{
              flex: 1,
              padding: '0.75rem 1rem',
              overflowY: 'auto',
              fontFamily: '"Fira Code", "Cascadia Code", monospace',
              fontSize: '0.75rem',
              color: isDark ? '#94a3b8' : '#334155',
              lineHeight: 1.5,
            }}>
              {compileErrors.length > 0 ? (
                compileErrors.map((err, i) => (
                  <div key={i} style={{ color: '#ef4444', marginBottom: '4px' }}>
                    {err.line ? `[Line ${err.line}] ` : ''}{err.message || String(err)}
                  </div>
                ))
              ) : compileState === 'success' ? (
                <div style={{ color: '#22c55e' }}>
                  Firmware compiled successfully! Binary size: {hexCode ? `${(hexCode.length / 1024).toFixed(1)} KB` : 'Unknown'}
                  <br />
                  Ready to deploy onto target hardware simulator.
                </div>
              ) : (
                <div style={{ color: isDark ? '#475569' : '#94a3b8' }}>
                  No output. Click "Compile" to build the sketch.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right Pane (60%): 3D Simulator Interface ───────────────────────────────────────── */}
        <div style={{
          width: isMobile ? '100%' : '60%',
          display: (isMobile && mobileBuildTab === 'editor') ? 'none' : 'flex',
          flexDirection: 'column',
          background: isDark ? '#0a0a0a' : '#f0f0f0',
          height: '100%',
        }}>
          {/* Simulator Header */}
          <div style={{
            padding: '0.625rem 1rem',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: isDark ? '#141414' : '#fff',
          }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: isDark ? '#6b7280' : '#9ca3af' }}>
                3D CAD Environment (Simulate)
              </span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={handleGenDiagram} disabled={generatingDiagram} style={{
                padding: '0.2rem 0.625rem', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 600,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
                background: 'transparent', color: isDark ? '#a3a3a3' : '#555', cursor: generatingDiagram ? 'not-allowed' : 'pointer',
              }}>
                {generatingDiagram ? 'Generating…' : '✨ AI Gen Diagram'}
              </button>
              <button 
                onClick={() => setSimView(simView === '2d' ? '3d' : '2d')}
                style={{
                  padding: '0.2rem 0.625rem', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 700,
                  background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer'
                }}
              >
                {simView === '2d' ? '🚀 Enter 3D' : '📐 Switch to 2D'}
              </button>
            </div>
          </div>

          {/* Canvas area */}
          <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
            {diagram ? (
              simView === '2d' ? (
                <WokwiSimulator
                  hexCode={hexCode || 'hex'} // allow running even with fallback compile string
                  diagramJson={diagram}
                  sketchCode={sketch}
                  projectId={id}
                />
              ) : (
                <Suspense fallback={<div className="h-full w-full bg-black flex items-center justify-center text-white font-black animate-pulse uppercase tracking-[0.2em]">Initializing 3D Engine...</div>}>
                   <Simulator3D 
                     diagram={diagram} 
                     hexCode={hexCode} 
                     registry={registry}
                     bom={bom}
                     projectId={id}
                     onDiagramChange={async (newDiagram) => {
                       setDiagram(newDiagram);
                       try {
                         await axiosInstance.post('/build/sync', {
                           projectId: id,
                           sketch,
                           diagram: newDiagram
                         }, { withCredentials: true });
                       } catch (e) {
                         console.warn('Background diagram sync failed', e);
                       }
                     }}
                   />
                </Suspense>
              )
            ) : (
              <div style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: isDark ? '#3f3f3f' : '#9ca3af',
                gap: '0.75rem',
                padding: '2rem',
                textAlign: 'center',
              }}>
                <span style={{ fontSize: '2.5rem' }}>📐</span>
                <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>No circuit diagram yet</p>
                <p style={{ fontSize: '0.8rem', maxWidth: '260px' }}>
                  Click "✨ AI Gen Diagram" to generate your circuit layout.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Tab Switcher */}
      {isMobile && (
        <div className="glass-nav" style={{
          height: '72px',
          borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          display: 'flex',
          padding: '0 8px',
          zIndex: 100,
          position: 'fixed',
          bottom: '68px',
          left: '12px',
          right: '12px',
          borderRadius: '20px',
          boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 32px rgba(0,0,0,0.1)',
        }}>
          {[
            { key: 'editor', label: 'Sketch', icon: '📝' },
            { key: 'sim', label: 'Simulator', icon: '⚡' },
            { key: 'diagram', label: 'Circuit', icon: '📐' }
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setMobileBuildTab(t.key)}
              className={`mobile-tab-btn ${mobileBuildTab === t.key ? 'active' : ''}`}
              style={{ color: isDark ? '#94a3b8' : '#64748b' }}
            >
              <span style={{ fontSize: '1.2rem' }}>{t.icon}</span>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase' }}>{t.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Bottom: Action bar ─────────────────────────────────────────── */}

      <div className="glass-nav" style={{
        padding: '0.75rem 1.25rem',
        borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 90,
      }}>

        <p style={{ fontSize: '0.75rem', color: isDark ? '#6b7280' : '#9ca3af' }}>
          {hexCode ? `✓ Hex ready (${(hexCode.length / 1024).toFixed(1)} KB)` : 'Not compiled yet'}
        </p>
        <button
          onClick={() => navigate(`/project/${id}/assembly`)}
          disabled={!hexCode}
          style={{
            padding: '0.5rem 1.25rem',
            borderRadius: '10px',
            background: hexCode ? '#22c55e' : (isDark ? '#1f1f1f' : '#e5e7eb'),
            color: hexCode ? '#fff' : (isDark ? '#3f3f3f' : '#9ca3af'),
            fontWeight: 700,
            fontSize: '0.8125rem',
            border: 'none',
            cursor: hexCode ? 'pointer' : 'not-allowed',
          }}
        >
          Continue to Assembly →
        </button>

      </div>
    </div>
  );
}

