// ??$$$ group 8 - Core Platform & Shared Infrastructure
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useProjectStore } from '../../store/useProjectStore.js';
import { useThemeStore } from '../../store/useThemeStore.js';

type StageKey = 'ideation' | 'components' | 'build' | 'assembly' | 'shopping';

type StageStatus =
  | 'done'
  | 'ready'
  | 'generating'
  | 'stale'
  | 'error'
  | 'locked';

interface Stage {
  key: StageKey;
  label: string;
  path: string;
  time: string;
}

interface StatusConfig {
  icon: string;
  color: string;
  bg: string;
  label: string;
  clickable: boolean;
}

interface Project {
  description?: string;
}

interface ProjectStore {
  stageStatuses: Partial<Record<StageKey, StageStatus>>;
  project?: Project;
}

const STAGES: Stage[] = [
  { key: 'ideation',   label: 'Ideation',   path: 'ideation',   time: '3–5 min' },
  { key: 'components', label: 'Components', path: 'components', time: '1–2 min' },
  { key: 'build',      label: 'Build',      path: 'build',      time: '2–3 min' },
  { key: 'assembly',   label: 'Assembly',   path: 'assembly',   time: '~1 min'  },
  { key: 'shopping',   label: 'Shopping',   path: 'shopping',   time: '~30 sec' },
];

const STATUS_CONFIG: Record<StageStatus, StatusConfig> = {
  done:       { icon: '✓', color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  label: 'Done',       clickable: true  },
  ready:      { icon: '→', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', label: 'Ready',      clickable: true  },
  generating: { icon: '⟳', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'Generating', clickable: false },
  stale:      { icon: '!', color: '#f97316', bg: 'rgba(249,115,22,0.12)', label: 'Stale',      clickable: true  },
  error:      { icon: '✕', color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  label: 'Error',      clickable: true  },
  locked:     { icon: '🔒', color: '#6b7280', bg: 'transparent',           label: 'Locked',     clickable: false },
};

export default function StageNav() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const { theme } = useThemeStore() as { theme: 'dark' | 'light' };
  const isDark = theme === 'dark';

  const stageStatuses = useProjectStore((s) => s.stageStatuses);

  const project = useProjectStore((s) => s.project);

  const currentPath = location.pathname.split('/').pop();

  const handleStageClick = (stage: Stage) => {
    const rawStatus = stageStatuses[stage.key] || 'locked';
    const cfg = STATUS_CONFIG[rawStatus];

    if (!cfg.clickable) return;
    navigate(`/project/${id}/${stage.path}`);
  };

  return (
    <nav
      className="stage-nav"
      style={{
        background: isDark ? '#1a1a1a' : '#ffffff',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        padding: '0 1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: '52px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        gap: '0.5rem',
        flexWrap: 'wrap',
      }}
    >
      {/* Project name */}
      <button
        onClick={() => navigate('/home')}
        style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          color: isDark ? '#a3a3a3' : '#555',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0.25rem 0',
          whiteSpace: 'nowrap',
          maxWidth: '160px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        title="Back to all projects"
      >
        ← {project?.description ? project.description.slice(0, 22) : 'FORGE'}
      </button>

      {/* Stage pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
        {STAGES.map((stage, idx) => {
          const rawStatus = stageStatuses[stage.key] || 'locked';
          const cfg = STATUS_CONFIG[rawStatus];
          const isActive = currentPath === stage.path;

          return (
            <div key={stage.key} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              {idx > 0 && (
                <span style={{ color: isDark ? '#3f3f3f' : '#d1d5db', fontSize: '0.75rem' }}>
                  ›
                </span>
              )}

              <button
                onClick={() => handleStageClick(stage)}
                disabled={!cfg.clickable}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.25rem 0.625rem',
                  borderRadius: '999px',
                  border: isActive
                    ? `1.5px solid ${cfg.color}`
                    : `1px solid ${rawStatus === 'locked' ? (isDark ? '#2a2a2a' : '#e5e7eb') : cfg.color + '55'}`,
                  background: isActive ? cfg.bg : 'transparent',
                  color: rawStatus === 'locked' ? (isDark ? '#4a4a4a' : '#9ca3af') : cfg.color,
                  fontSize: '0.7rem',
                  fontWeight: isActive ? 700 : 500,
                  cursor: cfg.clickable ? 'pointer' : 'not-allowed',
                  transition: 'all 0.15s ease',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                }}
                title={`Go to ${stage.label}`}
              >
                <span style={{ fontSize: rawStatus === 'locked' ? '0.65rem' : '0.7rem' }}>
                  {cfg.icon}
                </span>
                <span>{stage.label}</span>

                {rawStatus === 'locked' && (
                  <span style={{ fontSize: '0.6rem', opacity: 0.7, marginLeft: '0.1rem' }}>
                    {stage.time}
                  </span>
                )}

                {rawStatus === 'stale' && (
                  <span
                    style={{
                      fontSize: '0.6rem',
                      background: '#f97316',
                      color: '#fff',
                      borderRadius: '4px',
                      padding: '0 0.25rem',
                      fontWeight: 700,
                      marginLeft: '0.1rem',
                    }}
                  >
                    REGEN
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </nav>
  );
}