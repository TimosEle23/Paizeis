import { Component, ErrorInfo, ReactNode } from "react";
import { reportError } from "@/lib/errorReporting";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  componentStack?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, { kind: "react", componentStack: info.componentStack ?? undefined });
    this.setState({ componentStack: info.componentStack ?? undefined });
  }

  render() {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-2xl w-full space-y-4">
          <h1 className="font-mono text-2xl text-primary">Something broke</h1>
          <p className="text-sm text-white/70">
            The page crashed. The details below are also stored in the console error log.
          </p>
          <pre className="text-xs bg-white/5 border border-white/10 rounded p-4 overflow-auto max-h-80 whitespace-pre-wrap">
            {error.message}
            {"\n\n"}
            {error.stack}
            {componentStack ? `\n\nComponent stack:${componentStack}` : ""}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded bg-primary text-primary-foreground font-mono"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
