// ??$$$ newer code
// @ts-nocheck
import { useState } from 'react';

const STAGE_ORDER = [
  { key: 'ideation', label: 'Ideation', icon: '💡', color: '#8b5cf6' },
  { key: 'bom', label: 'BOM', icon: '🧩', color: '#3b82f6' },
  { key: 'wiring', label: 'Wiring', icon: '🔌', color: '#06b6d4' },
  { key: 'diagram', label: 'Diagram', icon: '📐', color: '#14b8a6' },
  { key: 'milestones', label: 'Milestones', icon: '🎯', color: '#f59e0b' },
  { key: 'firmware', label: 'Firmware', icon: '⚡', color: '#f97316' },
  { key: 'compilation', label: 'Compilation', icon: '🔧', color: '#ef4444' },
  { key: 'simulation', label: 'Simulation', icon: '🖥️', color: '#10b981' },
  { key: 'physicalBuild', label: 'Physical Build', icon: '🔩', color: '#6366f1' },
];

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    done: '#22c55e',
    running: '#3b82f6',
    failed: '#ef4444',
    pending: '#6b7280',
  };
  const isPulse = status === 'running';
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: 10, height: 10 }}>
      {isPulse && (
        <span style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: colors[status] || '#6b7280', opacity: 0.5,
          animation: 'ping 1.2s cubic-bezier(0,0,0.2,1) infinite',
        }} />
      )}
      <span style={{
        width: 10, height: 10, borderRadius: '50%',
        background: colors[status] || '#6b7280',
        display: 'inline-block',
      }} />
    </span>
  );
}

function JsonBox({ data, label }: { data: any; label: string }) {
  const [open, setOpen] = useState(false);
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const preview = text?.slice(0, 120);
  return (
    <div style={{ marginTop: 8, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.25)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', textAlign: 'left', padding: '6px 10px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: '#94a3b8', fontSize: '0.7rem', fontWeight: 600,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}
      >
        <span>{label}</span>
        <span style={{ opacity: 0.5 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <pre style={{
          margin: 0, padding: '8px 10px', fontSize: '0.67rem',
          color: '#a3e635', fontFamily: 'monospace',
          overflowX: 'auto', maxHeight: 240, overflowY: 'auto',
          borderTop: '1px solid rgba(255,255,255,0.05)',
        }}>
          {text || '(empty)'}
        </pre>
      )}
      {!open && (
        <div style={{ padding: '0 10px 6px', fontSize: '0.65rem', color: '#4b5563', fontFamily: 'monospace' }}>
          {preview}{text?.length > 120 ? '…' : ''}
        </div>
      )}
    </div>
  );
}

function ProcessList({ steps }: { steps: string[] }) {
  if (!steps || steps.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#3b82f6', fontWeight: 700, flexShrink: 0 }}>
            {i + 1}
          </span>
          <span style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>{s}</span>
        </div>
      ))}
    </div>
  );
}

function ConsumerPills({ consumers }: { consumers: string[] }) {
  if (!consumers || consumers.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
      {consumers.map((c, i) => (
        <span key={i} style={{
          padding: '2px 8px', borderRadius: 100,
          background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)',
          color: '#a5b4fc', fontSize: '0.65rem', fontWeight: 600,
        }}>{c}</span>
      ))}
    </div>
  );
}

function ValidationBadge({ v }: { v: { valid: boolean; errors: string[]; warnings: string[] } }) {
  if (!v) return null;
  const hasErrors = v.errors?.length > 0;
  const hasWarnings = v.warnings?.length > 0;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px',
        borderRadius: 100, fontSize: '0.65rem', fontWeight: 700,
        background: hasErrors ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
        border: `1px solid ${hasErrors ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
        color: hasErrors ? '#f87171' : '#4ade80',
      }}>
        {hasErrors ? '✗ Validation Failed' : '✓ Validation Passed'}
      </div>
      {hasErrors && v.errors.map((e, i) => (
        <div key={i} style={{ fontSize: '0.65rem', color: '#fca5a5', marginTop: 4, paddingLeft: 4, borderLeft: '2px solid #ef4444' }}>⛔ {e}</div>
      ))}
      {hasWarnings && v.warnings.map((w, i) => (
        <div key={i} style={{ fontSize: '0.65rem', color: '#fde68a', marginTop: 4, paddingLeft: 4, borderLeft: '2px solid #f59e0b' }}>⚠ {w}</div>
      ))}
    </div>
  );
}

function StageCard({ stage, data, isDark }: { stage: typeof STAGE_ORDER[0]; data: any; isDark: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const status = data?.status || 'pending';

  const bg = {
    done: 'rgba(34,197,94,0.06)',
    running: 'rgba(59,130,246,0.06)',
    failed: 'rgba(239,68,68,0.06)',
    pending: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
  }[status] || 'transparent';

  const borderColor = {
    done: 'rgba(34,197,94,0.2)',
    running: 'rgba(59,130,246,0.3)',
    failed: 'rgba(239,68,68,0.25)',
    pending: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
  }[status] || 'rgba(255,255,255,0.06)';

  return (
    <div style={{
      borderRadius: 14, border: `1px solid ${borderColor}`,
      background: bg, overflow: 'hidden',
      transition: 'all 0.2s',
    }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', padding: '12px 16px', background: 'transparent', border: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
        }}
      >
        <span style={{ fontSize: '1.2rem' }}>{stage.icon}</span>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
            {stage.label}
          </div>
          <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: 2 }}>
            {data?.updatedAt ? `Updated ${new Date(data.updatedAt).toLocaleTimeString()}` : 'Not yet started'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StatusDot status={status} />
          <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#64748b', textTransform: 'capitalize' }}>{status}</span>
          <span style={{ opacity: 0.4, fontSize: '0.7rem', color: '#94a3b8' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && data && (
        <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${borderColor}` }}>
          {/* Inputs */}
          {data.inputs && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#3b82f6', fontWeight: 700, marginBottom: 4 }}>
                ↓ INPUTS
              </div>
              <JsonBox data={data.inputs} label="View Input Data" />
            </div>
          )}

          {/* Process */}
          {data.process?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#f59e0b', fontWeight: 700, marginBottom: 4 }}>
                ⚙ PROCESS STEPS
              </div>
              <ProcessList steps={data.process} />
            </div>
          )}

          {/* Outputs */}
          {data.outputs && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#10b981', fontWeight: 700, marginBottom: 4 }}>
                ↑ OUTPUTS
              </div>
              <JsonBox data={data.outputs} label="View Output Data" />
            </div>
          )}

          {/* Consumers */}
          {data.consumers?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8b5cf6', fontWeight: 700, marginBottom: 4 }}>
                → CONSUMED BY
              </div>
              <ConsumerPills consumers={data.consumers} />
            </div>
          )}

          {/* Validation */}
          {data.validationStatus && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#ec4899', fontWeight: 700, marginBottom: 4 }}>
                ✓ VALIDATION
              </div>
              <ValidationBadge v={data.validationStatus} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DependenciesPanel({ deps, isDark }: { deps: any; isDark: boolean }) {
  if (!deps) return (
    <div style={{ textAlign: 'center', color: '#4b5563', fontSize: '0.75rem', padding: '2rem 0' }}>
      Dependencies will appear after firmware is generated.
    </div>
  );

  const sections = [
    { label: 'Required Libraries', icon: '📚', key: 'libraries', color: '#3b82f6' },
    { label: 'Board Packages', icon: '🔲', key: 'boardPackages', color: '#8b5cf6' },
    { label: 'Platform Packages', icon: '⚙️', key: 'platformPackages', color: '#6366f1' },
    { label: 'Telemetry Protocols', icon: '📡', key: 'telemetry', color: '#f59e0b' },
    { label: 'Communication', icon: '🛜', key: 'communication', color: '#06b6d4' },
    { label: 'Simulator Deps', icon: '🖥️', key: 'simulator', color: '#10b981' },
    { label: 'Mobile Apps', icon: '📱', key: 'mobileApps', color: '#ec4899' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {sections.map(s => {
        const items: string[] = deps[s.key] || [];
        if (items.length === 0) return null;
        return (
          <div key={s.key} style={{
            borderRadius: 12, border: `1px solid rgba(255,255,255,0.06)`,
            background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
            padding: '10px 14px',
          }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: s.color, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{s.icon}</span>
              <span style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>{s.label}</span>
              <span style={{ marginLeft: 'auto', background: `${s.color}22`, border: `1px solid ${s.color}44`, color: s.color, borderRadius: 100, padding: '1px 7px', fontSize: '0.6rem' }}>{items.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {items.map((item, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '4px 8px', borderRadius: 6,
                  background: `${s.color}0d`, fontSize: '0.72rem', color: isDark ? '#cbd5e1' : '#334155', fontFamily: 'monospace',
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                  {item}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FailurePanel({ failures, isDark }: { failures: any[]; isDark: boolean }) {
  if (!failures || failures.length === 0) return (
    <div style={{ textAlign: 'center', color: '#22c55e', fontSize: '0.8rem', padding: '2rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '2rem' }}>✅</span>
      <span>No pipeline failures recorded.</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {failures.map((f, i) => (
        <div key={i} style={{
          borderRadius: 12, border: '1px solid rgba(239,68,68,0.25)',
          background: 'rgba(239,68,68,0.05)', padding: '12px 14px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: '0.78rem', color: '#f87171' }}>⛔ {f.subsystem}</span>
            <span style={{
              fontSize: '0.6rem', padding: '2px 8px', borderRadius: 100, fontWeight: 600,
              background: f.status === 'retry_successful' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              color: f.status === 'retry_successful' ? '#4ade80' : '#f87171',
              border: `1px solid ${f.status === 'retry_successful' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            }}>{f.status}</span>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#fca5a5', marginBottom: 4 }}>{f.error}</div>
          {f.reason && <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Reason: {f.reason}</div>}
          {f.fixApplied && <div style={{ fontSize: '0.65rem', color: '#4ade80', marginTop: 4 }}>Fix Applied: {f.fixApplied}</div>}
          <div style={{ fontSize: '0.6rem', color: '#4b5563', marginTop: 6 }}>{new Date(f.timestamp).toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}

export default function PipelineAuditTab({ project, isDark }: { project: any; isDark: boolean }) {
  const [section, setSection] = useState<'pipeline' | 'dependencies' | 'failures'>('pipeline');

  const stages = project?.pipelineStages || {};
  const failures = project?.pipelineFailures || [];
  const deps = project?.derivedDependencies;

  const doneCount = STAGE_ORDER.filter(s => stages[s.key]?.status === 'done').length;
  const failCount = STAGE_ORDER.filter(s => stages[s.key]?.status === 'failed').length;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
      <style>{`
        @keyframes ping { 75%, 100% { transform: scale(2); opacity: 0; } }
      `}</style>

      {/* Header */}
      <div style={{
        padding: '16px 20px 0',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem',
          }}>🔍</div>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: isDark ? '#e2e8f0' : '#1e293b' }}>Pipeline Audit</div>
            <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Full execution transparency — inputs, processes, outputs, consumers</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <span style={{ padding: '3px 10px', borderRadius: 100, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ade80', fontSize: '0.65rem', fontWeight: 700 }}>
              {doneCount}/{STAGE_ORDER.length} done
            </span>
            {failCount > 0 && (
              <span style={{ padding: '3px 10px', borderRadius: 100, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: '0.65rem', fontWeight: 700 }}>
                {failCount} failed
              </span>
            )}
          </div>
        </div>

        {/* Section Tabs */}
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { key: 'pipeline', label: '⚡ Stage Flow' },
            { key: 'dependencies', label: '📦 Dependencies' },
            { key: 'failures', label: `🚨 Failures${failures.length > 0 ? ` (${failures.length})` : ''}` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setSection(tab.key as any)}
              style={{
                padding: '6px 14px', border: 'none', background: 'transparent', cursor: 'pointer',
                fontSize: '0.72rem', fontWeight: 600,
                color: section === tab.key ? '#8b5cf6' : (isDark ? '#64748b' : '#94a3b8'),
                borderBottom: `2px solid ${section === tab.key ? '#8b5cf6' : 'transparent'}`,
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Pipeline section: mini flow graph + stage cards */}
        {section === 'pipeline' && (
          <>
            {/* Flow Graph Bar */}
            <div style={{
              display: 'flex', alignItems: 'center', overflowX: 'auto',
              gap: 4, padding: '10px 12px',
              borderRadius: 12, background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
              marginBottom: 6,
            }}>
              {STAGE_ORDER.map((s, i) => {
                const st = stages[s.key]?.status || 'pending';
                return (
                  <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <div style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                      padding: '5px 8px', borderRadius: 8,
                      background: st === 'done' ? 'rgba(34,197,94,0.1)' : st === 'failed' ? 'rgba(239,68,68,0.1)' : st === 'running' ? 'rgba(59,130,246,0.1)' : 'transparent',
                      border: `1px solid ${st === 'done' ? 'rgba(34,197,94,0.3)' : st === 'failed' ? 'rgba(239,68,68,0.3)' : st === 'running' ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.05)'}`,
                      minWidth: 60,
                    }}>
                      <span style={{ fontSize: '1rem' }}>{s.icon}</span>
                      <span style={{ fontSize: '0.58rem', color: isDark ? '#94a3b8' : '#64748b', fontWeight: 600, textAlign: 'center' }}>{s.label}</span>
                      <StatusDot status={st} />
                    </div>
                    {i < STAGE_ORDER.length - 1 && (
                      <span style={{ color: '#374151', fontSize: '0.8rem' }}>→</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Stage Cards */}
            {STAGE_ORDER.map(s => (
              <StageCard key={s.key} stage={s} data={stages[s.key] || null} isDark={isDark} />
            ))}
          </>
        )}

        {section === 'dependencies' && <DependenciesPanel deps={deps} isDark={isDark} />}
        {section === 'failures' && <FailurePanel failures={failures} isDark={isDark} />}
      </div>
    </div>
  );
}
