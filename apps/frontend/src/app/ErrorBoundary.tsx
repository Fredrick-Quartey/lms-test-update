import { Component, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <main className="mx-auto max-w-xl p-8">
          <h1 className="page-title">This screen stopped working</h1>
          <p className="muted mt-2">Reload the page to try again. If it happens again, tell your supervisor what you were doing.</p>
          <button className="btn-primary mt-4" onClick={() => window.location.reload()}>Reload the page</button>
        </main>
      );
    }
    return this.props.children;
  }
}
