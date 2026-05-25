// ??$$$ FORGE: ProjectLayout.jsx — Shared layout wrapper for all /project/:id/* routes
// Renders: StageNav (top) + ErrorBoundary + <Outlet> (child page)
// Handles project loading and last-project persistence.

import { useEffect } from 'react';
import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useProjectStore } from '../../store/useProjectStore';
import { useThemeStore } from '../../store/useThemeStore';
import StageNav from './StageNav';
import ErrorBoundary from './ErrorBoundary';

const STAGE_PREV: Record<string, string> = {
  components: 'Ideation',
  build: 'Components',
  assembly: 'Build',
  shopping: 'Assembly',
};

export default function ProjectLayout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const { loadProject, project, isLoading, error } = useProjectStore();

  // Load project on mount / id change, persist to localStorage
  useEffect(() => {
    if (id) {
      loadProject(id);
      localStorage.setItem('forge:lastProjectId', id);
    }
  }, [id]);

  // Determine current stage from URL
  const currentStage = location.pathname.split('/').pop() || '';
  const prevStage = STAGE_PREV[currentStage] || undefined;

  const handleGoBack = () => {
    if (prevStage) {
      const prevPath = prevStage.toLowerCase();
      navigate(`/project/${id}/${prevPath}`);
    } else {
      navigate('/home');
    }
  };

  // Global loading state while project first loads
  if (isLoading && !project) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: isDark ? '#141414' : '#fafafa',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '32px', height: '32px',
            border: '3px solid rgba(255,255,255,0.1)',
            borderTop: '3px solid #60a5fa',
            borderRadius: '50%',
            margin: '0 auto 1rem',
            animation: 'spin 0.8s linear infinite',
          }} />
          <p style={{ fontSize: '0.875rem', color: isDark ? '#a3a3a3' : '#555' }}>
            Loading project...
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Hard error on project load
  if (error && !project) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: isDark ? '#141414' : '#fafafa',
        padding: '2rem',
      }}>
        <div style={{
          maxWidth: '480px',
          width: '100%',
          textAlign: 'center',
          background: isDark ? '#1a0a0a' : '#fff5f5',
          border: '1px solid #ef4444',
          borderRadius: '16px',
          padding: '2rem',
        }}>
          <p style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>⚠️</p>
          <p style={{ color: '#ef4444', fontWeight: 600, marginBottom: '0.5rem' }}>
            Failed to load project
          </p>
          <p style={{ color: isDark ? '#f87171' : '#b91c1c', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            {error}
          </p>
          <button
            onClick={() => navigate('/home')}
            style={{
              padding: '0.5rem 1.5rem',
              borderRadius: '8px',
              background: '#ef4444',
              color: '#fff',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            ← Back to Projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: isDark ? '#141414' : '#f5f5f5',
      color: isDark ? '#e5e5e5' : '#1a1a1a',
    }}>
      {/* Persistent stage navigation */}
      <StageNav />

      {/* Page content — wrapped in error boundary per stage */}
      <ErrorBoundary
        stageName={currentStage}
        prevStage={prevStage}
        onGoBack={handleGoBack}
      >
        <Outlet />
      </ErrorBoundary>
    </div>
  );
}
