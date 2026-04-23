import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Label shown in the fallback UI, e.g. "Live panel" */
  panelName?: string;
  /** Extra className applied to the fallback container */
  className?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches runtime errors inside a panel and shows a recovery message
 * with a "Retry" button that resets the boundary.
 *
 * Use this around each major operator screen so a crash in one panel
 * doesn't take the entire operator UI down during a service.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      `[ErrorBoundary] Uncaught error in ${this.props.panelName ?? "panel"}:`,
      error,
      info.componentStack,
    );
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;

    const label = this.props.panelName ?? "panel";

    return (
      <div
        role="alert"
        className={`flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center ${this.props.className ?? ""}`}
        data-qa={`error-boundary-${label.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <p className="text-[0.85rem] font-semibold tracking-[0.08em] text-ink-3 uppercase">
          {label} crashed
        </p>
        <p className="max-w-xs text-[0.78rem] leading-relaxed text-muted">
          An unexpected error occurred. The rest of the app is still running.
        </p>
        <button
          onClick={this.reset}
          className="cursor-pointer rounded-sm border border-line bg-transparent px-5 py-2 font-sans text-[0.75rem] font-medium tracking-[0.1em] text-ink uppercase transition-all hover:border-line-strong"
        >
          Retry
        </button>
        {this.state.error && (
          <details className="mt-2 max-w-sm text-left">
            <summary className="cursor-pointer text-[0.7rem] text-muted">
              Error details
            </summary>
            <pre className="mt-1 max-h-40 overflow-auto rounded border border-line p-2 text-[0.65rem] text-muted">
              {this.state.error.message}
            </pre>
          </details>
        )}
      </div>
    );
  }
}
