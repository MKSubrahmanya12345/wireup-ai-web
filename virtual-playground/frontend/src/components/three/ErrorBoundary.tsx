import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { SchematicView } from './SchematicView';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class WebGLErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('[WebGL Context Failed/Lost] Falling back to 2D Schematic View:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return <SchematicView />;
    }

    return this.props.children;
  }
}
