// ??$$$ group 8 - Core Platform & Shared Infrastructure
// ??$$$ FORGE: ErrorBoundary.tsx — Structural error boundary for every pipeline page

import React, { Component, type ReactNode, type ErrorInfo } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  stageName?: string;
  prevStage?: string;
  onGoBack?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleRetry = (): void => {
    // ??$$$ FORGE: auto-recover from Vite module load failures
    if (
      this.state.error?.message?.includes(
        'Failed to fetch dynamically imported module'
      )
    ) {
      window.location.reload();
      return;
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    const { error, errorInfo } = this.state;
    const { stageName = 'this stage', prevStage, onGoBack } = this.props;

    const isDark =
      document.documentElement.classList.contains('dark') ||
      window.matchMedia('(prefers-color-scheme: dark)').matches;

    return (
      <div
        style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background: isDark ? '#1a1a1a' : '#fafafa',
        }}
      >
        <div
          style={{
            maxWidth: '520px',
            width: '100%',
            background: isDark ? '#2a0e0e' : '#fff5f5',
            border: `1px solid ${isDark ? '#7f1d1d' : '#fca5a5'}`,
            borderRadius: '16px',
            padding: '2rem',
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️</div>

          <h2
            style={{
              fontSize: '1.125rem',
              fontWeight: 700,
              color: isDark ? '#fca5a5' : '#991b1b',
              marginBottom: '0.5rem',
            }}
          >
            Something went wrong in {stageName}
          </h2>

          <p
            style={{
              fontSize: '0.875rem',
              color: isDark ? '#f87171' : '#b91c1c',
              marginBottom: '1.25rem',
              lineHeight: 1.6,
            }}
          >
            {error?.message ||
              'An unexpected error occurred. The page could not render.'}
          </p>

          {/* Dev stack trace */}
          {import.meta.env.MODE !== 'production' &&
            errorInfo?.componentStack && (
              <pre
                style={{
                  fontSize: '0.7rem',
                  background: isDark ? '#0f0f0f' : '#fff',
                  border: `1px solid ${
                    isDark ? '#3f1515' : '#fecaca'
                  }`,
                  borderRadius: '8px',
                  padding: '0.75rem',
                  overflowX: 'auto',
                  color: isDark ? '#f87171' : '#991b1b',
                  marginBottom: '1.25rem',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '140px',
                }}
              >
                {errorInfo.componentStack.trim().slice(0, 800)}
              </pre>
            )}

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: '8px',
                background: isDark ? '#7f1d1d' : '#dc2626',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.8125rem',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              ↺ Retry
            </button>

            {(prevStage || onGoBack) && (
              <button
                onClick={() => {
                  onGoBack?.();
                }}
                style={{
                  padding: '0.5rem 1.25rem',
                  borderRadius: '8px',
                  background: 'transparent',
                  border: `1px solid ${
                    isDark ? '#7f1d1d' : '#fca5a5'
                  }`,
                  color: isDark ? '#fca5a5' : '#991b1b',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                }}
              >
                ← Go back to {prevStage || 'previous stage'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}