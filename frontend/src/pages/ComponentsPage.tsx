// @ts-nocheck
// ??$$$ FORGE: ComponentsPage.jsx — Stage 2: BOM table + pin assignment card
// Left: BOMTable with swap modal, skeleton loaders
// Right: PinAssignmentCard (SVG board pin map)
// Bottom: "Generate Circuit & Code" → POST /api/build/generate

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { axiosInstance } from '../lib/axios';
import toast from 'react-hot-toast';
import { useThemeStore } from '../store/useThemeStore';
import { useProjectStore } from '../store/useProjectStore';
import useIsMobile from '../hooks/useIsMobile';


// API removed

// ─── Skeleton BOM row ─────────────────────────────────────────────────────────
function SkeletonBOMRow({ isDark }) {
  const shimmer = {
    height: '14px',
    borderRadius: '6px',
    background: isDark
      ? 'linear-gradient(90deg,#2a2a2a 25%,#333 50%,#2a2a2a 75%)'
      : 'linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 50%,#e5e7eb 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.4s infinite',
  };
  return (
    <tr>
      {[120, 40, 200, 60].map((w, i) => (
        <td key={i} style={{ padding: '12px 16px' }}>
          <div style={{ ...shimmer, width: `${w}px`, maxWidth: '100%' }} />
        </td>
      ))}
      <td style={{ padding: '12px 16px' }}>
        <div style={{ ...shimmer, width: '60px' }} />
      </td>
    </tr>
  );
}

// ─── Pin assignment SVG card ──────────────────────────────────────────────────
function PinAssignmentCard({ board, pinAssignments, isDark }) {
  const usedPins = Object.keys(pinAssignments || {});
  const boardLabel = board
    ? String(board).replace(/_/g, ' ').replace('ESP32', 'ESP32').toUpperCase()
    : 'No board selected';

  return (
    <div style={{
      background: isDark ? '#1a1a1a' : '#fff',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
      borderRadius: '16px',
      padding: '1.25rem',
      height: '100%',
    }}>
      <p style={{ fontSize: '0.65rem', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, color: isDark ? '#6b7280' : '#9ca3af', marginBottom: '0.75rem' }}>
        Pin Assignment — {boardLabel}
      </p>

      {usedPins.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: isDark ? '#3f3f3f' : '#d1d5db', fontSize: '0.8rem' }}>
          Generate BOM first to see pin assignments
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {usedPins.map(pin => (
            <div key={pin} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.375rem 0.625rem',
              borderRadius: '8px',
              background: isDark ? '#22c55e18' : '#f0fdf4',
              border: `1px solid ${isDark ? '#22c55e33' : '#bbf7d0'}`,
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, fontFamily: 'monospace', color: '#22c55e' }}>
                {pin}
              </span>
              <span style={{ fontSize: '0.75rem', color: isDark ? '#a3a3a3' : '#555' }}>
                {pinAssignments[pin]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Swap modal ───────────────────────────────────────────────────────────────
function SwapModal({ item, onClose, onSwap, isDark }) {
  const [selected, setSelected] = useState('');
  const alternatives = [
    { key: 'NODEMCU_ESP8266', label: 'NodeMCU ESP8266 (₹220)' },
    { key: 'ARDUINO_NANO', label: 'Arduino Nano (₹180)' },
    { key: 'RASPBERRY_PI_PICO', label: 'Raspberry Pi Pico (₹250)' },
  ].filter(a => a.key !== item?.key);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: isDark ? '#1a1a1a' : '#fff',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
          borderRadius: '16px', padding: '1.5rem',
          width: '100%', maxWidth: '420px',
        }}
      >
        <h3 style={{ fontWeight: 700, marginBottom: '1rem', color: isDark ? '#e5e5e5' : '#1a1a1a' }}>
          Swap: {item?.displayName}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1.25rem' }}>
          {alternatives.map(alt => (
            <label key={alt.key} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '0.625rem', borderRadius: '10px', cursor: 'pointer',
              background: selected === alt.key ? (isDark ? '#1d4ed820' : '#eff6ff') : 'transparent',
              border: `1px solid ${selected === alt.key ? '#3b82f6' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')}`,
            }}>
              <input type="radio" value={alt.key} checked={selected === alt.key} onChange={() => setSelected(alt.key)} />
              <span style={{ fontSize: '0.875rem', color: isDark ? '#e5e5e5' : '#1a1a1a' }}>{alt.label}</span>
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => selected && onSwap(item.key, selected)}
            disabled={!selected}
            style={{
              flex: 1, padding: '0.625rem', borderRadius: '10px',
              background: selected ? '#2563eb' : (isDark ? '#2a2a2a' : '#e5e7eb'),
              color: selected ? '#fff' : (isDark ? '#4a4a4a' : '#9ca3af'),
              fontWeight: 700, fontSize: '0.875rem', border: 'none',
              cursor: selected ? 'pointer' : 'not-allowed',
            }}
          >
            Confirm Swap
          </button>
          <button onClick={onClose} style={{
            padding: '0.625rem 1rem', borderRadius: '10px',
            background: 'transparent',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
            color: isDark ? '#a3a3a3' : '#555',
            fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
          }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
// ??$$$ newer code
import { InteractiveNodeGraph } from '../components/InteractiveNodeGraph';

export default function ComponentsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const { project, updateBOM, refreshStageStatus, syncWiring, generateMilestones } = useProjectStore();

  const [bom, setBom] = useState([]);
  const [pinAssignments, setPinAssignments] = useState({});
  const [loadingBOM, setLoadingBOM] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [swapItem, setSwapItem] = useState(null);
  const [staleWarning, setStaleWarning] = useState(false);
  const [mobileTab, setMobileTab] = useState('bom'); // ??$$$ 'bom' or 'pins'
  const isMobile = useIsMobile();
  // ??$$$
  const [generatingMilestones, setGeneratingMilestones] = useState(false);

  // ??$$$ newer code
  const [viewMode, setViewMode] = useState<'list' | 'visual'>('visual');
  const [selectedPhase, setSelectedPhase] = useState('PHASE_1');

  const phases = project?.ideation?.phases || { "PHASE_1": "Initial Setup" };
  const phaseKeys = Object.keys(phases).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, "")) || 0;
    const numB = parseInt(b.replace(/\D/g, "")) || 0;
    return numA - numB;
  });

  useEffect(() => {
    if (phaseKeys.length > 0 && !phaseKeys.includes(selectedPhase)) {
      setSelectedPhase(phaseKeys[0]);
    }
  }, [project?.ideation?.phases]);


  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoadingBOM(true);
      try {
        // Try to init components if not already done
        const res = await axiosInstance.post(`/components/init`, { projectId: id }, { withCredentials: true });
        setBom(res.data?.bom || project?.bom || []);
        setPinAssignments(res.data?.pinAssignments || project?.pinAssignments || {});
      } catch (err) {
        // If components exist, just load from project
        setBom(project?.bom || []);
        setPinAssignments(project?.pinAssignments || {});
      } finally {
        setLoadingBOM(false);
      }
    };
    load();
  }, [id]);

  const handleRegenerateBOM = async () => {
    if (loadingBOM) return;
    setLoadingBOM(true);
    try {
      const res = await axiosInstance.post(`/components/init`, { projectId: id, force: true }, { withCredentials: true });
      setBom(res.data?.bom || []);
      setPinAssignments(res.data?.pinAssignments || {});
      toast.success('BOM regenerated!');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Regeneration failed');
    } finally {
      setLoadingBOM(false);
    }
  };

  const handleSwap = async (componentKey, replacementKey) => {
    setSwapItem(null);
    try {
      await updateBOM(componentKey, replacementKey);
      setBom(prev => prev.map(item =>
        item.key === componentKey ? { ...item, key: replacementKey } : item
      ));
      setStaleWarning(true);
      toast.success('Component swapped. Build and Assembly are now stale — regenerate them.');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Swap failed');
    }
  };

  // ??$$$
  const handleContinueToBuild = async () => {
    setGeneratingMilestones(true);
    try {
      await generateMilestones(id);
      toast.success('Milestones generated successfully!');
      navigate(`/project/${id}/build`);
    } catch (err: any) {
      console.error("Failed to generate milestones:", err);
      toast.error(err?.response?.data?.error || "Failed to generate milestones. Navigating to retry.");
      navigate(`/project/${id}/build`);
    } finally {
      setGeneratingMilestones(false);
    }
  };

  const board = project?.generationProfile?.board || project?.ideation?.snapshot?.computeCore || '';
  const hasData = bom.length > 0;

  return (
    <div className="forge-container" style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 52px)',
      background: isDark ? '#141414' : '#f5f5f5',
      overflow: 'hidden',
    }}>
      {/* ??$$$ Milestone Generator Loading Overlay */}
      {generatingMilestones && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          color: '#fff',
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid rgba(255,255,255,0.1)',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '1.25rem',
          }} />
          <p style={{ fontWeight: 600, fontSize: '1.1rem', letterSpacing: '0.02em' }}>Generating your build milestones...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>

      {/* Stale warning banner */}
      {staleWarning && (
        <div style={{
          padding: '0.5rem 1.25rem',
          background: '#f97316',
          color: '#fff',
          fontSize: '0.8rem',
          fontWeight: 600,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 40,
        }}>
          <span>⚠ Component or wiring changed — Build and Assembly are now stale. Regenerate them.</span>
          <button onClick={() => setStaleWarning(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
        </div>
      )}

      {/* ??$$$ newer code: View Mode Toggle */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 1.25rem',
        background: isDark ? '#1a1a1a' : '#fff',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        zIndex: 30,
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setViewMode('visual')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: 'none',
              background: viewMode === 'visual' ? '#2563eb' : 'transparent',
              color: viewMode === 'visual' ? '#fff' : (isDark ? '#a3a3a3' : '#555'),
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            🔌 Visual Wiring Graph
          </button>
          <button
            onClick={() => setViewMode('list')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: 'none',
              background: viewMode === 'list' ? '#2563eb' : 'transparent',
              color: viewMode === 'list' ? '#fff' : (isDark ? '#a3a3a3' : '#555'),
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            📋 Bill of Materials (List)
          </button>
        </div>
      </div>

      {/* ??$$$ newer code: Render Visual Graph or List View */}
      {viewMode === 'visual' ? (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          overflow: 'hidden',
        }}>
          {/* Left Sidebar: Phases list */}
          <div style={{
            width: isMobile ? '100%' : '260px',
            borderRight: isMobile ? 'none' : `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            borderBottom: isMobile ? `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}` : 'none',
            background: isDark ? '#111216' : '#fcfcfc',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            padding: '1.25rem',
            gap: '12px',
          }}>
            <div style={{ marginBottom: '8px' }}>
              <span style={{ fontSize: '0.65rem', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, color: isDark ? '#6b7280' : '#9ca3af' }}>
                Build Sequence
              </span>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: isDark ? '#e5e5e5' : '#1a1a1a', margin: '4px 0 0 0' }}>
                Ideation Phases
              </h2>
            </div>
            {phaseKeys.map((phaseKey) => {
              const isActive = selectedPhase === phaseKey;
              const phaseNum = phaseKey.replace(/\D/g, "");
              return (
                <button
                  key={phaseKey}
                  onClick={() => setSelectedPhase(phaseKey)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.875rem 1rem',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    background: isActive 
                      ? (isDark ? '#2b1c12' : '#fdf6f0') 
                      : (isDark ? '#1a1c23' : '#f4f5f7'),
                    border: `1px solid ${isActive 
                      ? (isDark ? '#f97316' : '#fdba74') 
                      : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)')}`,
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      fontSize: '9px',
                      fontWeight: 800,
                      background: isActive ? '#f97316' : '#4b5563',
                      color: '#fff'
                    }}>
                      {phaseNum}
                    </span>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: isActive ? '#f97316' : (isDark ? '#a3a3a3' : '#4b5563')
                    }}>
                      Phase {phaseNum}
                    </span>
                  </div>
                  <p style={{
                    fontSize: '0.75rem',
                    color: isDark ? '#d1d5db' : '#374151',
                    margin: 0,
                    lineHeight: '1.4',
                    fontWeight: 500
                  }}>
                    {phases[phaseKey]}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Canvas center workspace */}
          <div style={{ flex: 1, padding: '1rem', overflow: 'hidden' }}>
            <InteractiveNodeGraph
              projectId={id || ""}
              bom={bom}
              diagram={project?.diagram || {}}
              selectedPhase={selectedPhase}
              nodeCoordinates={project?.nodeCoordinates || {}}
              phases={phases}
              onSave={async (coords, bomPhases, conns) => {
                try {
                  const data = await syncWiring(coords, bomPhases, conns);
                  if (data?.bom) {
                    setBom(data.bom);
                  } else {
                    setBom(project?.bom || bom);
                  }
                  setStaleWarning(true);
                  toast.success("Wiring layout and phases synchronized!");
                } catch (err) {
                  toast.error("Failed to save visual wiring schema.");
                }
              }}
            />
          </div>
        </div>
      ) : (
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row',
          overflow: 'hidden', 
          gap: '1rem', 
          padding: '1rem' 
        }}>
          {/* Left: BOM table */}
          <div className="forge-main" style={{
            flex: 2,
            display: (isMobile && mobileTab !== 'bom') ? 'none' : 'flex',
            background: isDark ? '#1a1a1a' : '#fff',
            borderRadius: '16px',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            flexDirection: 'column',
            overflow: 'hidden',
          }}>

            <div style={{
              padding: '0.875rem 1.25rem',
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <p style={{ fontSize: '0.65rem', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, color: isDark ? '#6b7280' : '#9ca3af', margin: 0 }}>
                  Stage 2
                </p>
                <h1 style={{ fontSize: '1rem', fontWeight: 700, margin: '2px 0 0', color: isDark ? '#e5e5e5' : '#1a1a1a' }}>
                  Bill of Materials
                </h1>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {hasData && (
                  <span style={{ fontSize: '0.75rem', color: isDark ? '#6b7280' : '#9ca3af' }}>
                    {bom.length} component{bom.length !== 1 ? 's' : ''}
                  </span>
                )}
                <button
                  onClick={handleRegenerateBOM}
                  disabled={loadingBOM}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: '6px',
                    background: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                    color: isDark ? '#e2e8f0' : '#1e293b',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: loadingBOM ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loadingBOM ? 'Generating...' : '🔄 Gen BOM'}
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: isDark ? '#1a1a1a' : '#f9fafb' }}>
                    {['Component', 'Qty', 'Purpose', 'Price', ''].map(h => (
                      <th key={h} style={{
                        padding: '10px 16px',
                        textAlign: 'left',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color: isDark ? '#6b7280' : '#9ca3af',
                        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loadingBOM
                    ? Array.from({ length: 5 }).map((_, i) => <SkeletonBOMRow key={i} isDark={isDark} />)
                    : bom.map((item, i) => (
                      <tr key={i} style={{
                        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                      }}>
                        <td style={{ padding: '12px 16px', fontSize: '0.875rem', fontWeight: 600, color: isDark ? '#e5e5e5' : '#1a1a1a' }}>
                          {item.displayName || item.key || '—'}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: isDark ? '#a3a3a3' : '#555' }}>
                          {item.qty ?? 1}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '0.8125rem', color: isDark ? '#a3a3a3' : '#555', maxWidth: '240px' }}>
                          {item.purpose || '—'}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#22c55e', fontWeight: 600 }}>
                          {item.price ? `₹${item.price}` : '—'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <button
                            onClick={() => setSwapItem(item)}
                            style={{
                              padding: '0.25rem 0.625rem',
                              borderRadius: '8px',
                              border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
                              background: 'transparent',
                              color: isDark ? '#a3a3a3' : '#555',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Swap
                          </button>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>

              {!loadingBOM && bom.length === 0 && (
                <div style={{ textAlign: 'center', padding: '3rem', color: isDark ? '#4a4a4a' : '#9ca3af', fontSize: '0.875rem' }}>
                  <p style={{ marginBottom: '1rem' }}>No components were generated automatically.</p>
                  <button 
                    onClick={handleRegenerateBOM}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '8px',
                      background: '#2563eb',
                      color: '#fff',
                      border: 'none',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Retry BOM Generation
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right: Pin assignment */}
          <div className="forge-sidebar" style={{ 
            width: isMobile ? '100%' : '260px', 
            minWidth: isMobile ? '100%' : '220px',
            display: (isMobile && mobileTab !== 'pins') ? 'none' : 'block'
          }}>
            <PinAssignmentCard board={board} pinAssignments={pinAssignments} isDark={isDark} />
          </div>
        </div>
      )}

      {/* Bottom: Generate CTA */}
      <div style={{
        padding: '0.875rem 1.25rem',
        borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        background: isDark ? '#1a1a1a' : '#fff',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '1rem',
        alignItems: 'center',
        zIndex: 20,
      }}>
        {generating && (
          <p style={{ fontSize: '0.8rem', color: isDark ? '#6b7280' : '#9ca3af' }}>
            AI is generating circuit & code…
          </p>
        )}
        <button
          onClick={handleContinueToBuild}
          style={{
            padding: '0.75rem 1.75rem',
            borderRadius: '12px',
            background: '#2563eb',
            color: '#fff',
            fontWeight: 700,
            fontSize: '0.9375rem',
            border: 'none',
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
        >
          Continue to Build Environment →
        </button>
      </div>

      {/* Mobile Tab Switcher */}
      {isMobile && (
        <div style={{
          height: '56px',
          background: isDark ? '#1a1a1a' : '#fff',
          borderTop: `1px solid ${isDark ? '#2a2a2a' : '#e5e7eb'}`,
          display: 'flex',
          zIndex: 100
        }}>
          <button 
            onClick={() => setMobileTab('bom')}
            style={{
              flex: 1,
              border: 'none',
              background: 'none',
              color: mobileTab === 'bom' ? '#3b82f6' : '#6b7280',
              fontWeight: 700,
              fontSize: '0.8rem'
            }}
          >
            📦 BOM
          </button>
          <button 
            onClick={() => setMobileTab('pins')}
            style={{
              flex: 1,
              border: 'none',
              background: 'none',
              color: mobileTab === 'pins' ? '#3b82f6' : '#6b7280',
              fontWeight: 700,
              fontSize: '0.8rem'
            }}
          >
            🔌 Pins
          </button>
        </div>
      )}

      {swapItem && (
        <SwapModal item={swapItem} onClose={() => setSwapItem(null)} onSwap={handleSwap} isDark={isDark} />
      )}
    </div>
  );
}

