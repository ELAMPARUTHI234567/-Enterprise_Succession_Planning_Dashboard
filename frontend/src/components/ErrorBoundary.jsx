import React from 'react';
import { AlertTriangle, RefreshCw, Home, ShieldAlert } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  handleNavigateHome = () => {
    const userJson = localStorage.getItem('succession_user');
    if (userJson) {
      try {
        const user = JSON.parse(userJson);
        const role = (user.role || '').toLowerCase();
        if (role === 'manager') {
          window.location.href = '/manager-dashboard';
          return;
        } else if (role === 'employee') {
          window.location.href = '/employee-dashboard';
          return;
        }
      } catch {
        // ignore
      }
    }
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback({ error: this.state.error, reset: this.handleReset })
          : this.props.fallback;
      }

      const isSubSection = Boolean(this.props.isSubSection);

      if (isSubSection) {
        return (
          <div className="bg-white rounded-2xl p-6 border border-amber-200 card-shadow text-center my-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6 stroke-[2]" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">
              {this.props.sectionTitle || 'Section Display Interrupted'}
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              This analytics widget encountered a temporary display issue. Other dashboard modules remain fully functional.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Widget</span>
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4 shadow-sm border border-rose-100">
            <ShieldAlert className="w-8 h-8 stroke-[2.2]" />
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Dashboard View Recovery
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1.5 max-w-md leading-relaxed">
            A temporary display error occurred while rendering the dashboard. Your session and database data remain secure.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleReload}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md shadow-indigo-600/20 flex items-center space-x-2 transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload Dashboard</span>
            </button>
            <button
              type="button"
              onClick={this.handleNavigateHome}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs sm:text-sm flex items-center space-x-2 transition cursor-pointer"
            >
              <Home className="w-4 h-4 text-slate-500" />
              <span>Return Home</span>
            </button>
          </div>

          {process.env.NODE_ENV !== 'production' && this.state.error && (
            <div className="mt-6 p-4 max-w-lg w-full bg-slate-900 text-left rounded-xl text-rose-300 font-mono text-[11px] overflow-auto max-h-40 border border-slate-800">
              <p className="font-bold text-white mb-1">Diagnostic Error:</p>
              {this.state.error.toString()}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
