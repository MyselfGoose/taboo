import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0f1a] p-4 text-white">
          <div className="w-full max-w-md rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center shadow-lg">
            <h2 className="mb-2 text-xl font-bold text-red-400">Something went wrong</h2>
            <p className="mb-4 text-sm text-neutral-400">
              An unexpected error occurred and was caught by the Error Boundary.
            </p>
            <p className="mb-6 text-xs font-mono text-red-300 text-left bg-black/20 p-3 rounded-lg overflow-auto max-h-32 border border-red-500/10">
              {this.state.error?.message || "Unknown error"}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl border border-white/10 bg-white/[0.06] px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-white/[0.1] hover:border-white/20"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
