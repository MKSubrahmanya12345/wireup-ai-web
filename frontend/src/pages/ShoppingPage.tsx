// ??$$$ group 7 - Shopping & Costing (Phase 6)
// @ts-nocheck
// ??$$$ FORGE: ShoppingPage.jsx — Stage 5: Price table + Jugaad alternatives
// Table: Component | Qty | Unit | Total | Store | Buy | Jugaad Alt
// Live "Total saved with Jugaad" counter — updates as toggles are flipped

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { axiosInstance } from '../lib/axios'; // ??$$$ replaced raw axios + hardcoded API URL
import toast from 'react-hot-toast';
import { useThemeStore } from '../store/useThemeStore';
import { useProjectStore } from '../store/useProjectStore';


// ─── Skeleton row ─────────────────────────────────────────────────────────────
function SkeletonShoppingRow({ isDark }) {
  const shimmer = {
    height: '13px',
    borderRadius: '6px',
    background: isDark
      ? 'linear-gradient(90deg,#2a2a2a 25%,#3a3a3a 50%,#2a2a2a 75%)'
      : 'linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 50%,#e5e7eb 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.4s infinite',
  };
  return (
    <tr>
      {[140, 40, 60, 60, 80, 80, 110].map((w, i) => (
        <td key={i} style={{ padding: '12px 14px' }}>
          <div style={{ ...shimmer, width: `${w}px`, maxWidth: '100%' }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ShoppingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const { project } = useProjectStore();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [jugaadActive, setJugaadActive] = useState({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await axiosInstance.get(`/shopping/${id}`, { withCredentials: true }); // ??$$$ use axiosInstance
        setItems(res.data?.items || []);
      } catch (err) {
        // Fallback: build from BOM in project store
        const bom = project?.bom || [];
        setItems(bom.map(item => ({
          key: item.key,
          displayName: item.displayName || item.key,
          qty: item.qty || 1,
          price: item.price || 0,
          storeUrl: item.storeUrl || '',
          jugaad: null,
        })));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const toggleJugaad = (key) => {
    setJugaadActive(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ??$$$ Live "Total saved with Jugaad" calculation
  const totalOriginal = items.reduce((sum, item) => sum + (item.price || 0) * (item.qty || 1), 0);
  const totalJugaad = items.reduce((sum, item) => {
    const useJugaad = jugaadActive[item.key] && item.jugaad?.price != null;
    const price = useJugaad ? item.jugaad.price : (item.price || 0);
    return sum + price * (item.qty || 1);
  }, 0);
  const totalSaved = totalOriginal - totalJugaad;
  const jugaadCount = Object.values(jugaadActive).filter(Boolean).length;

  const handleCopyList = () => {
    const lines = items.map(item => {
      const useJugaad = jugaadActive[item.key] && item.jugaad;
      const name = useJugaad ? item.jugaad.displayName : item.displayName;
      const price = useJugaad ? item.jugaad.price : item.price;
      return `- ${name} × ${item.qty} — ₹${price || '?'} (${item.storeUrl || 'Robu.in'})`;
    });
    const header = `FORGE Shopping List — ${project?.description || 'Project'}\n${'─'.repeat(40)}\n`;
    const footer = `\nTotal: ₹${totalJugaad.toFixed(0)}${totalSaved > 0 ? ` (saved ₹${totalSaved.toFixed(0)} with Jugaad)` : ''}`;
    navigator.clipboard.writeText(header + lines.join('\n') + footer);
    toast.success('Shopping list copied!');
  };

  const col = (text, isDark) => ({
    fontSize: '0.65rem',
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: isDark ? '#6b7280' : '#9ca3af',
    padding: '10px 14px',
    textAlign: 'left',
    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
    background: isDark ? '#1a1a1a' : '#f9fafb',
    whiteSpace: 'nowrap',
  });

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 52px)',
      background: isDark ? '#141414' : '#f5f5f5',
      overflow: 'hidden',
    }}>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>

      {/* ──  Jugaad savings banner ─────────────────────────────────────── */}
      <div style={{
        padding: '0.75rem 1.5rem',
        background: isDark ? '#1a1a1a' : '#fff',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
      }}>
        <div>
          <p style={{ fontSize: '0.65rem', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, color: isDark ? '#6b7280' : '#9ca3af', margin: 0 }}>
            Stage 5 — Shopping
          </p>
          <h1 style={{ fontSize: '1rem', fontWeight: 700, color: isDark ? '#e5e5e5' : '#1a1a1a', margin: '2px 0 0' }}>
            {project?.description || 'Project'} — Parts List
          </h1>
        </div>

        {/* ??$$$ Live jugaad counter */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
        }}>
          {jugaadCount > 0 && totalSaved > 0 && (
            <div style={{
              padding: '0.5rem 1rem',
              borderRadius: '999px',
              background: isDark ? 'rgba(34,197,94,0.12)' : '#f0fdf4',
              border: `1px solid ${isDark ? 'rgba(34,197,94,0.25)' : '#bbf7d0'}`,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <span style={{ fontSize: '0.875rem' }}>🎉</span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#22c55e' }}>
                You've saved ₹{totalSaved.toFixed(0)} with jugaad substitutes
              </span>
            </div>
          )}
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '0.75rem', color: isDark ? '#6b7280' : '#9ca3af', margin: 0 }}>Total</p>
            <p style={{ fontSize: '1.25rem', fontWeight: 700, color: isDark ? '#e5e5e5' : '#1a1a1a', margin: 0 }}>
              ₹{totalJugaad.toFixed(0)}
              {totalSaved > 0 && (
                <span style={{ fontSize: '0.8rem', color: '#22c55e', marginLeft: '6px', textDecoration: 'line-through' }}>
                  ₹{totalOriginal.toFixed(0)}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Component', 'Qty', 'Unit ₹', 'Total ₹', 'Store', 'Buy', 'Jugaad Alt'].map(h => (
                <th key={h} style={col(h, isDark)}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonShoppingRow key={i} isDark={isDark} />)
              : items.map((item) => {
                const useJugaad = jugaadActive[item.key] && item.jugaad?.price != null;
                const displayPrice = useJugaad ? item.jugaad.price : (item.price || 0);
                const displayName  = useJugaad ? item.jugaad.displayName : item.displayName;
                const displayUrl   = useJugaad ? (item.jugaad.storeUrl || item.storeUrl) : item.storeUrl;
                const lineTotal    = displayPrice * (item.qty || 1);

                return (
                  <tr key={item.key} style={{
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                    background: useJugaad ? (isDark ? 'rgba(34,197,94,0.04)' : '#f0fdf4') : 'transparent',
                    transition: 'background 0.2s ease',
                  }}>
                    <td style={{ padding: '12px 14px', fontSize: '0.875rem', fontWeight: 600, color: isDark ? '#e5e5e5' : '#1a1a1a' }}>
                      {displayName}
                      {useJugaad && (
                        <span style={{ marginLeft: '6px', fontSize: '0.65rem', background: '#22c55e', color: '#fff', borderRadius: '4px', padding: '1px 5px', fontWeight: 700 }}>
                          JUGAAD
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '0.875rem', color: isDark ? '#a3a3a3' : '#555' }}>{item.qty || 1}</td>
                    <td style={{ padding: '12px 14px', fontSize: '0.875rem', color: isDark ? '#e5e5e5' : '#1a1a1a' }}>₹{displayPrice}</td>
                    <td style={{ padding: '12px 14px', fontSize: '0.875rem', fontWeight: 700, color: '#22c55e' }}>₹{lineTotal.toFixed(0)}</td>
                    <td style={{ padding: '12px 14px', fontSize: '0.75rem', color: isDark ? '#a3a3a3' : '#555' }}>Robu.in</td>
                    <td style={{ padding: '12px 14px' }}>
                      {displayUrl ? (
                        <a href={displayUrl} target="_blank" rel="noreferrer" style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          color: '#3b82f6',
                          textDecoration: 'none',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '6px',
                          border: '1px solid rgba(59,130,246,0.3)',
                        }}>
                          Order →
                        </a>
                      ) : (
                        <span style={{ fontSize: '0.7rem', color: isDark ? '#3f3f3f' : '#9ca3af' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {item.jugaad ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <button
                            onClick={() => toggleJugaad(item.key)}
                            style={{
                              padding: '0.2rem 0.625rem',
                              borderRadius: '999px',
                              border: `1px solid ${useJugaad ? '#22c55e' : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)')}`,
                              background: useJugaad ? 'rgba(34,197,94,0.15)' : 'transparent',
                              color: useJugaad ? '#22c55e' : (isDark ? '#a3a3a3' : '#555'),
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {useJugaad ? '✓ ON' : '⇄ Use'}
                          </button>
                          {!useJugaad && (
                            <span style={{ fontSize: '0.6rem', color: isDark ? '#4a4a4a' : '#9ca3af', whiteSpace: 'nowrap' }}>
                              {item.jugaad.displayName} · save ₹{((item.price || 0) - (item.jugaad.price || 0)) * (item.qty || 1)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.7rem', color: isDark ? '#3f3f3f' : '#9ca3af' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            }
          </tbody>
        </table>
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div style={{
        padding: '0.875rem 1.5rem',
        borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        background: isDark ? '#1a1a1a' : '#fff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
      }}>
        <p style={{ fontSize: '0.75rem', color: isDark ? '#6b7280' : '#9ca3af', margin: 0 }}>
          Estimated delivery: 3–5 days via Robu.in • {/* ??$$$ LIVE_FETCH_HOOK: replace with live shipping estimate when Robu.in API available */}
          Prices as of static catalog — verify before ordering
        </p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={handleCopyList} style={{
            padding: '0.5rem 1rem', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 600,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
            background: 'transparent', color: isDark ? '#a3a3a3' : '#555', cursor: 'pointer',
          }}>
            📋 Copy List
          </button>
          <a
            href={`https://robu.in/search?q=${encodeURIComponent(project?.description || 'arduino')}`}
            target="_blank"
            rel="noreferrer"
            style={{
              padding: '0.5rem 1.25rem', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700,
              background: '#f97316', color: '#fff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
            }}
          >
            🛒 Order from Robu.in
          </a>
        </div>
      </div>
    </div>
  );
}

