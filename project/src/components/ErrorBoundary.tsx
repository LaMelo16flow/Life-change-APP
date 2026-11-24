import { Component, ErrorInfo, ReactNode } from 'react';

interface State {
  error: Error | null;
}

// Shows a message with a Reload button instead of a blank white page when a
// screen crashes (or when an old cached page meets a newer deploy).
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-sm w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center">
          <h1 className="text-lg font-bold text-gray-900 mb-2">Une erreur est survenue / Something went wrong</h1>
          <p className="text-sm text-gray-600 mb-5">
            Rechargez la page. Si le probleme continue, contactez l'administrateur.
            <br />
            Please reload the page. If it keeps happening, contact the administrator.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 rounded-xl transition"
          >
            Recharger / Reload
          </button>
        </div>
      </div>
    );
  }
}
