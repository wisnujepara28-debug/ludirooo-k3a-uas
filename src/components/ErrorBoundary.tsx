import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught application error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      let friendlyDetail = 'Terjadi gangguan sinkronisasi data atau hak akses pada sesi Anda.';
      try {
        const parsed = JSON.parse(this.state.errorMessage);
        if (parsed?.error) {
          friendlyDetail = `Akses database ditolak (${parsed.operationType} pada ${parsed.path || 'koleksi'}): ${parsed.error}`;
        }
      } catch {
        if (this.state.errorMessage) {
          friendlyDetail = this.state.errorMessage;
        }
      }

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
            <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Terjadi Kendala Sistem</h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed break-words">{friendlyDetail}</p>
            <button
              type="button"
              onClick={this.handleReset}
              className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Muat Ulang Aplikasi
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
