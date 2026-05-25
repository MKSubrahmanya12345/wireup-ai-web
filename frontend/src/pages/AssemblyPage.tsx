// @ts-nocheck
// ??$$$ FORGE: AssemblyPage.jsx — Stage 4: Algorithmic enclosure layout
// Left: DimensionForm (pocket/desk/wall/custom)
// Center: LayoutPreview (SVG, zoomable, hover tooltips)
// Right: Legend + warnings + fold instructions
// Bottom-corner of printable SVG: QR code linking back to /project/:id/build

import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { axiosInstance } from '../lib/axios'; // ??$$$ replaced raw axios + hardcoded API URL
import toast from 'react-hot-toast';
import { useThemeStore } from '../store/useThemeStore';
import { useProjectStore } from '../store/useProjectStore';
// ??$$$ - Import Forge3D CAD Layout component
import Forge3D from '../components/Forge3D';

const SIZE_PRESETS = [
  { key: 'pocket', label: 'Pocket',   desc: '10×8×4 cm', icon: '📱', dims: { w: 100, h: 80, d: 40 } },
  { key: 'desk',   label: 'Desk',     desc: '20×15×6 cm', icon: '🖥',  dims: { w: 200, h: 150, d: 60 } },
  { key: 'wall',   label: 'Wall',     desc: '30×20×5 cm', icon: '🗂',  dims: { w: 300, h: 200, d: 50 } },
  { key: 'custom', label: 'Custom',   desc: 'Your size',  icon: '✏️', dims: null },
];

// ─── Dimension form ───────────────────────────────────────────────────────────
function DimensionForm({ selected, setSelected, custom, setCustom, onGenerate, generating, isDark }) {
  return (
    <div style={{
      background: isDark ? '#1a1a1a' : '#fff',
      borderRadius: '16px',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
    }}>
      <p style={{ fontSize: '0.65rem', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, color: isDark ? '#6b7280' : '#9ca3af', margin: 0 }}>
        Enclosure Size
      </p>

      {SIZE_PRESETS.map(preset => (
        <button
          key={preset.key}
          onClick={() => setSelected(preset.key)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.75rem',
            borderRadius: '12px',
            border: selected === preset.key
              ? `1.5px solid #3b82f6`
              : `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            background: selected === preset.key
              ? (isDark ? 'rgba(59,130,246,0.12)' : '#eff6ff')
              : 'transparent',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span style={{ fontSize: '1.25rem' }}>{preset.icon}</span>
          <div>
            <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: selected === preset.key ? '#3b82f6' : (isDark ? '#e5e5e5' : '#1a1a1a'), margin: 0 }}>
              {preset.label}
            </p>
            <p style={{ fontSize: '0.7rem', color: isDark ? '#6b7280' : '#9ca3af', margin: '2px 0 0' }}>
              {preset.desc}
            </p>
          </div>
        </button>
      ))}

      {/* Custom inputs */}
      {selected === 'custom' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
          {['Width (mm)', 'Height (mm)', 'Depth (mm)'].map((label, i) => {
            const keys = ['w', 'h', 'd'];
            return (
              <div key={label}>
                <label style={{ fontSize: '0.7rem', color: isDark ? '#6b7280' : '#9ca3af', fontWeight: 600 }}>{label}</label>
                <input
                  type="number"
                  value={custom[keys[i]] || ''}
                  onChange={e => setCustom(prev => ({ ...prev, [keys[i]]: Number(e.target.value) }))}
                  style={{
                    width: '100%',
                    padding: '0.375rem 0.625rem',
                    borderRadius: '8px',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
                    background: isDark ? '#2a2a2a' : '#f9fafb',
                    color: isDark ? '#e5e5e5' : '#1a1a1a',
                    fontSize: '0.8125rem',
                    outline: 'none',
                    marginTop: '4px',
                  }}
                />
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={onGenerate}
        disabled={generating}
        style={{
          marginTop: '0.25rem',
          padding: '0.75rem',
          borderRadius: '12px',
          background: generating ? (isDark ? '#2a2a2a' : '#e5e7eb') : '#7c3aed',
          color: generating ? (isDark ? '#4a4a4a' : '#9ca3af') : '#fff',
          fontWeight: 700,
          fontSize: '0.875rem',
          border: 'none',
          cursor: generating ? 'not-allowed' : 'pointer',
        }}
      >
        {generating ? 'Generating layout…' : '📐 Generate Layout'}
      </button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AssemblyPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const printRef = useRef(null);

  const { project, regenerateAssembly, refreshStageStatus } = useProjectStore();

  const [sizePreset, setSizePreset] = useState('pocket');
  // ??$$$ - View mode: 2D Blueprint vs 3D CAD Casing Design
  const [activeView, setActiveView] = useState('2d');
  const [customDims, setCustomDims] = useState({ w: 150, h: 120, d: 50 });
  const [generating, setGenerating] = useState(false);
  const [layout, setLayout] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [zoom, setZoom] = useState(1);
  const [tooltip, setTooltip] = useState(null);

  // Load saved layout
  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const res = await axiosInstance.get(`/assembly/${id}`, { withCredentials: true }); // ??$$$ use axiosInstance
        if (res.data?.assemblyLayout?.svgString) {
          setLayout(res.data.assemblyLayout);
          setWarnings(res.data.assemblyLayout.warnings || []);
        }
      } catch {
        // None yet
      }
    };
    load();
  }, [id]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const overrides = sizePreset === 'custom' ? customDims : undefined;
      const result = await regenerateAssembly(sizePreset, overrides);
      if (result?.assemblyLayout) {
        setLayout(result.assemblyLayout);
        setWarnings(result.assemblyLayout.warnings || []);
      }
      await refreshStageStatus();
      toast.success('Enclosure layout generated!');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Layout generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const dims = layout?.dimensions || {};

  // ??$$$ - commented out original return block line-by-line to preserve legacy code structure
  // return (
  //   <div style={{
  //     display: 'flex',
  //     height: 'calc(100vh - 52px)',
  //     background: isDark ? '#141414' : '#f5f5f5',
  //     overflow: 'hidden',
  //     gap: '0',
  //   }}>
  //
  //     {/* ── Left: Dimension form ───────────────────────────────────────── */}
  //     <div style={{
  //       width: '220px',
  //       minWidth: '200px',
  //       overflowY: 'auto',
  //       padding: '1rem',
  //       borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
  //     }}>
  //       <p style={{ fontSize: '0.65rem', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, color: isDark ? '#6b7280' : '#9ca3af', marginBottom: '0.5rem' }}>
  //         Stage 4
  //       </p>
  //       <h1 style={{ fontSize: '0.9375rem', fontWeight: 700, color: isDark ? '#e5e5e5' : '#1a1a1a', marginBottom: '1rem' }}>
  //         Assembly
  //       </h1>
  //
  //       <DimensionForm
  //         selected={sizePreset}
  //         setSelected={setSizePreset}
  //         custom={customDims}
  //         setCustom={setCustomDims}
  //         onGenerate={handleGenerate}
  //         generating={generating}
  //         isDark={isDark}
  //       />
  //     </div>
  //
  //     {/* ── Center: Layout preview ─────────────────────────────────────── */}
  //     <div style={{
  //       flex: 1,
  //       minWidth: 0,
  //       display: 'flex',
  //       flexDirection: 'column',
  //       background: isDark ? '#0f0f0f' : '#f0f0f0',
  //       position: 'relative',
  //     }}>
  //       {/* Zoom controls */}
  //       <div style={{
  //         position: 'absolute', top: '12px', right: '12px', zIndex: 10,
  //         display: 'flex', gap: '4px',
  //       }}>
  //         {[0.6, 0.8, 1, 1.3, 1.6].map(z => (
  //           <button
  //             key={z}
  //             onClick={() => setZoom(z)}
  //             style={{
  //               padding: '0.2rem 0.375rem',
  //               borderRadius: '6px',
  //               border: `1px solid ${zoom === z ? '#3b82f6' : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)')}`,
  //               background: zoom === z ? 'rgba(59,130,246,0.15)' : (isDark ? '#1a1a1a' : '#fff'),
  //               color: zoom === z ? '#3b82f6' : (isDark ? '#a3a3a3' : '#555'),
  //               fontSize: '0.65rem',
  //               fontWeight: 600,
  //               cursor: 'pointer',
  //             }}
  //           >
  //             {z * 100}%
  //           </button>
  //         ))}
  //       </div>
  //
  //       <div ref={printRef} style={{ flex: 1, overflow: 'auto', padding: '2rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
  //         {generating ? (
  //           <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem' }}>
  //             <div style={{
  //               width: '40px', height: '40px',
  //               border: `3px solid ${isDark ? '#2a2a2a' : '#e5e7eb'}`,
  //               borderTop: '3px solid #7c3aed',
  //               borderRadius: '50%',
  //               animation: 'spin 0.8s linear infinite',
  //             }} />
  //             <p style={{ fontSize: '0.875rem', color: isDark ? '#6b7280' : '#9ca3af' }}>Calculating enclosure layout…</p>
  //             <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  //           </div>
  //         ) : layout?.svgString ? (
  //           <div
  //             style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.2s ease' }}
  //             dangerouslySetInnerHTML={{ __html: layout.svgString }}
  //           />
  //         ) : (
  //           <div style={{
  //             display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  //             height: '100%', color: isDark ? '#3f3f3f' : '#9ca3af', gap: '0.75rem', textAlign: 'center',
  //           }}>
  //             <span style={{ fontSize: '3rem' }}>📦</span>
  //             <p style={{ fontSize: '0.9375rem', fontWeight: 600 }}>No layout yet</p>
  //             <p style={{ fontSize: '0.8125rem', maxWidth: '280px' }}>
  //               Select a size and click "Generate Layout" to create your printable enclosure.
  //             </p>
  //           </div>
  //         )}
  //       </div>
  //
  //       {/* Print button */}
  //       {layout?.svgString && (
  //         <div style={{
  //           padding: '0.75rem 1.25rem',
  //           borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
  //           background: isDark ? '#1a1a1a' : '#fff',
  //           display: 'flex',
  //           justifyContent: 'space-between',
  //           alignItems: 'center',
  //         }}>
  //           <span style={{ fontSize: '0.75rem', color: isDark ? '#6b7280' : '#9ca3af' }}>
  //             {dims.width_mm && `${dims.width_mm}×${dims.height_mm}×${dims.depth_mm} mm`}
  //           </span>
  //           <div style={{ display: 'flex', gap: '0.75rem' }}>
  //             <button onClick={handleGenerate} style={{
  //               padding: '0.5rem 1rem', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 600,
  //               border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
  //               background: 'transparent', color: isDark ? '#a3a3a3' : '#555', cursor: 'pointer',
  //             }}>
  //               ↺ Regenerate
  //             </button>
  //             <button onClick={handlePrint} style={{
  //               padding: '0.5rem 1.25rem', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700,
  //               background: '#7c3aed', color: '#fff', border: 'none', cursor: 'pointer',
  //             }}>
  //               🖨 Download PDF
  //             </button>
  //             <button onClick={() => navigate(`/project/${id}/shopping`)} style={{
  //               padding: '0.5rem 1.25rem', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700,
  //               background: '#22c55e', color: '#fff', border: 'none', cursor: 'pointer',
  //             }}>
  //               Continue to Shopping →
  //             </button>
  //           </div>
  //         </div>
  //       )}
  //     </div>
  //
  //     {/* ── Right: Legend + warnings ───────────────────────────────────── */}
  //     <div style={{
  //       width: '220px',
  //       minWidth: '200px',
  //       overflowY: 'auto',
  //       padding: '1rem',
  //       borderLeft: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
  //       background: isDark ? '#1a1a1a' : '#fff',
  //       display: 'flex',
  //       flexDirection: 'column',
  //       gap: '1.25rem',
  //     }}>
  //       {/* Color legend */}
  //       <div>
  //         <p style={{ fontSize: '0.65rem', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, color: isDark ? '#6b7280' : '#9ca3af', marginBottom: '0.75rem' }}>
  //           Key
  //         </p>
  //         {[
  //           { color: '#ef4444', label: 'Cut line' },
  //           { color: '#3b82f6', label: 'Fold valley' },
  //           { color: '#22c55e', label: 'Fold mountain' },
  //         ].map(({ color, label }) => (
  //           <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
  //             <div style={{ width: '24px', height: '3px', background: color, borderRadius: '2px' }} />
  //             <span style={{ fontSize: '0.75rem', color: isDark ? '#a3a3a3' : '#555' }}>{label}</span>
  //           </div>
  //         ))}
  //       </div>
  //
  //       {/* Warnings */}
  //       {warnings.length > 0 && (
  //         <div>
  //           <p style={{ fontSize: '0.65rem', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, color: '#f59e0b', marginBottom: '0.75rem' }}>
  //             Warnings
  //           </p>
  //           {warnings.map((w, i) => (
  //             <div key={i} style={{
  //               fontSize: '0.7rem', color: '#f59e0b', marginBottom: '8px', lineHeight: 1.4,
  //               padding: '0.375rem 0.5rem', borderRadius: '6px', background: 'rgba(245,158,11,0.08)',
  //               border: '1px solid rgba(245,158,11,0.2)',
  //             }}>
  //               ⚠ {w}
  //             </div>
  //           ))}
  //         </div>
  //       )}
  //
  //       {/* Fold instructions */}
  //       <div>
  //         <p style={{ fontSize: '0.65rem', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, color: isDark ? '#6b7280' : '#9ca3af', marginBottom: '0.75rem' }}>
  //           Instructions
  //         </p>
  //         {[
  //           'Print on A4 paper',
  //           'Transfer to 3mm cardboard',
  //           'Score all fold lines first',
  //           'Cut solid (red) lines',
  //           'Fold valley (blue) lines inward',
  //           'Fold mountain (green) lines outward',
  //           'Glue tabs to seal box',
  //           'Scan QR → flash code',
  //         ].map((step, i) => (
  //           <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
  //             <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#7c3aed', minWidth: '16px' }}>{i + 1}.</span>
  //             <span style={{ fontSize: '0.7rem', color: isDark ? '#a3a3a3' : '#555', lineHeight: 1.4 }}>{step}</span>
  //           </div>
  //         ))}
  //       </div>
  //
  //       {/* QR note */}
  //       <div style={{
  //         padding: '0.625rem',
  //         borderRadius: '10px',
  //         background: isDark ? 'rgba(124,58,237,0.1)' : '#f5f3ff',
  //         border: `1px solid ${isDark ? 'rgba(124,58,237,0.3)' : '#ddd6fe'}`,
  //         fontSize: '0.7rem',
  //         color: isDark ? '#a78bfa' : '#6d28d9',
  //         lineHeight: 1.4,
  //       }}>
  //         📱 A QR code linking to your code is embedded in the printable layout. Scan it from inside the assembled box.
  //       </div>
  //     </div>
  //   </div>
  // );

  // ??$$$ - Fresh conditional layout rendering for 2D vs 3D views
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 52px)',
      background: isDark ? '#141414' : '#f5f5f5',
      overflow: 'hidden',
    }}>
      {/* ??$$$ - View Tab Switcher: 2D Printable Blueprint vs 3D Interactive CAD */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        background: isDark ? '#1a1a1a' : '#ffffff',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        padding: '6px 12px',
        gap: '8px',
        zIndex: 10,
        alignItems: 'center',
      }}>
        <button 
          onClick={() => setActiveView('2d')}
          style={{
            padding: '6px 16px',
            borderRadius: '8px',
            border: activeView === '2d' ? '1px solid #3b82f6' : `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            background: activeView === '2d' ? 'rgba(59,130,246,0.12)' : 'transparent',
            color: activeView === '2d' ? '#3b82f6' : (isDark ? '#a3a3a3' : '#555'),
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          📦 2D Printable Blueprint
        </button>
        <button 
          onClick={() => setActiveView('3d')}
          style={{
            padding: '6px 16px',
            borderRadius: '8px',
            border: activeView === '3d' ? '1px solid #3b82f6' : `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            background: activeView === '3d' ? 'rgba(59,130,246,0.12)' : 'transparent',
            color: activeView === '3d' ? '#3b82f6' : (isDark ? '#a3a3a3' : '#555'),
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          🌐 Interactive 3D CAD & Simulation
        </button>
      </div>

      {activeView === '3d' ? (
        <Forge3D bom={project?.bom || []} />
      ) : (
        <div style={{
          display: 'flex',
          flex: 1,
          background: isDark ? '#141414' : '#f5f5f5',
          overflow: 'hidden',
          gap: '0',
        }}>
          {/* ── Left: Dimension form ───────────────────────────────────────── */}
          <div style={{
            width: '220px',
            minWidth: '200px',
            overflowY: 'auto',
            padding: '1rem',
            borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          }}>
            <p style={{ fontSize: '0.65rem', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, color: isDark ? '#6b7280' : '#9ca3af', marginBottom: '0.5rem' }}>
              Stage 4
            </p>
            <h1 style={{ fontSize: '0.9375rem', fontWeight: 700, color: isDark ? '#e5e5e5' : '#1a1a1a', marginBottom: '1rem' }}>
              Assembly
            </h1>

            <DimensionForm
              selected={sizePreset}
              setSelected={setSizePreset}
              custom={customDims}
              setCustom={setCustomDims}
              onGenerate={handleGenerate}
              generating={generating}
              isDark={isDark}
            />
          </div>

          {/* ── Center: Layout preview ─────────────────────────────────────── */}
          <div style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            background: isDark ? '#0f0f0f' : '#f0f0f0',
            position: 'relative',
          }}>
            {/* Zoom controls */}
            <div style={{
              position: 'absolute', top: '12px', right: '12px', zIndex: 10,
              display: 'flex', gap: '4px',
            }}>
              {[0.6, 0.8, 1, 1.3, 1.6].map(z => (
                <button
                  key={z}
                  onClick={() => setZoom(z)}
                  style={{
                    padding: '0.2rem 0.375rem',
                    borderRadius: '6px',
                    border: `1px solid ${zoom === z ? '#3b82f6' : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)')}`,
                    background: zoom === z ? 'rgba(59,130,246,0.15)' : (isDark ? '#1a1a1a' : '#fff'),
                    color: zoom === z ? '#3b82f6' : (isDark ? '#a3a3a3' : '#555'),
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {z * 100}%
                </button>
              ))}
            </div>

            <div ref={printRef} style={{ flex: 1, overflow: 'auto', padding: '2rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
              {generating ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem' }}>
                  <div style={{
                    width: '40px', height: '40px',
                    border: `3px solid ${isDark ? '#2a2a2a' : '#e5e7eb'}`,
                    borderTop: '3px solid #7c3aed',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                  <p style={{ fontSize: '0.875rem', color: isDark ? '#6b7280' : '#9ca3af' }}>Calculating enclosure layout…</p>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              ) : layout?.svgString ? (
                <div
                  style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.2s ease' }}
                  dangerouslySetInnerHTML={{ __html: layout.svgString }}
                />
              ) : (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  height: '100%', color: isDark ? '#3f3f3f' : '#9ca3af', gap: '0.75rem', textAlign: 'center',
                }}>
                  <span style={{ fontSize: '3rem' }}>📦</span>
                  <p style={{ fontSize: '0.9375rem', fontWeight: 600 }}>No layout yet</p>
                  <p style={{ fontSize: '0.8125rem', maxWidth: '280px' }}>
                    Select a size and click "Generate Layout" to create your printable enclosure.
                  </p>
                </div>
              )}
            </div>

            {/* Print button */}
            {layout?.svgString && (
              <div style={{
                padding: '0.75rem 1.25rem',
                borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                background: isDark ? '#1a1a1a' : '#fff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span style={{ fontSize: '0.75rem', color: isDark ? '#6b7280' : '#9ca3af' }}>
                  {dims.width_mm && `${dims.width_mm}×${dims.height_mm}×${dims.depth_mm} mm`}
                </span>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button onClick={handleGenerate} style={{
                    padding: '0.5rem 1rem', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 600,
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
                    background: 'transparent', color: isDark ? '#a3a3a3' : '#555', cursor: 'pointer',
                  }}>
                    ↺ Regenerate
                  </button>
                  <button onClick={handlePrint} style={{
                    padding: '0.5rem 1.25rem', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700,
                    background: '#7c3aed', color: '#fff', border: 'none', cursor: 'pointer',
                  }}>
                    🖨 Download PDF
                  </button>
                  <button onClick={() => navigate(`/project/${id}/shopping`)} style={{
                    padding: '0.5rem 1.25rem', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700,
                    background: '#22c55e', color: '#fff', border: 'none', cursor: 'pointer',
                  }}>
                    Continue to Shopping →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Right: Legend + warnings ───────────────────────────────────── */}
          <div style={{
            width: '220px',
            minWidth: '200px',
            overflowY: 'auto',
            padding: '1rem',
            borderLeft: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            background: isDark ? '#1a1a1a' : '#fff',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}>
            {/* Color legend */}
            <div>
              <p style={{ fontSize: '0.65rem', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, color: isDark ? '#6b7280' : '#9ca3af', marginBottom: '0.75rem' }}>
                Key
              </p>
              {[
                { color: '#ef4444', label: 'Cut line' },
                { color: '#3b82f6', label: 'Fold valley' },
                { color: '#22c55e', label: 'Fold mountain' },
              ].map(({ color, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ width: '24px', height: '3px', background: color, borderRadius: '2px' }} />
                  <span style={{ fontSize: '0.75rem', color: isDark ? '#a3a3a3' : '#555' }}>{label}</span>
                </div>
              ))}
            </div>

            {/* Warnings */}
            {warnings.length > 0 && (
              <div>
                <p style={{ fontSize: '0.65rem', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, color: '#f59e0b', marginBottom: '0.75rem' }}>
                  Warnings
                </p>
                {warnings.map((w, i) => (
                  <div key={i} style={{
                    fontSize: '0.7rem', color: '#f59e0b', marginBottom: '8px', lineHeight: 1.4,
                    padding: '0.375rem 0.5rem', borderRadius: '6px', background: 'rgba(245,158,11,0.08)',
                    border: '1px solid rgba(245,158,11,0.2)',
                  }}>
                    ⚠ {w}
                  </div>
                ))}
              </div>
            )}

            {/* Fold instructions */}
            <div>
              <p style={{ fontSize: '0.65rem', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, color: isDark ? '#6b7280' : '#9ca3af', marginBottom: '0.75rem' }}>
                Instructions
              </p>
              {[
                'Print on A4 paper',
                'Transfer to 3mm cardboard',
                'Score all fold lines first',
                'Cut solid (red) lines',
                'Fold valley (blue) lines inward',
                'Fold mountain (green) lines outward',
                'Glue tabs to seal box',
                'Scan QR → flash code',
              ].map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#7c3aed', minWidth: '16px' }}>{i + 1}.</span>
                  <span style={{ fontSize: '0.7rem', color: isDark ? '#a3a3a3' : '#555', lineHeight: 1.4 }}>{step}</span>
                </div>
              ))}
            </div>

            {/* QR note */}
            <div style={{
              padding: '0.625rem',
              borderRadius: '10px',
              background: isDark ? 'rgba(124,58,237,0.1)' : '#f5f3ff',
              border: `1px solid ${isDark ? 'rgba(124,58,237,0.3)' : '#ddd6fe'}`,
              fontSize: '0.7rem',
              color: isDark ? '#a78bfa' : '#6d28d9',
              lineHeight: 1.4,
            }}>
              📱 A QR code linking to your code is embedded in the printable layout. Scan it from inside the assembled box.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

