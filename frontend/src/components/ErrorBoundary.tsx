import React, { Component, ErrorInfo, ReactNode } from "react";
import { Telemetry } from "../services/telemetry";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * ErrorBoundary component to catch rendering errors in the component tree.
 */
class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  /**
   * Updates state so the next render will show the fallback UI.
   */
  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  /**
   * Logs error details using the telemetry service.
   */
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    Telemetry.error("Crash de Componente", { error, errorInfo });
  }

  public render() {
    // Check state for rendering errors
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-8 bg-[#F8F7F2]">
          <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-red-100 text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="fa-solid fa-triangle-exclamation text-2xl"></i>
            </div>
            <h1 className="text-xl font-bold text-[#0A1628] mb-2">Ops! Algo deu errado</h1>
            <p className="text-slate-500 text-sm mb-6">
              Ocorreu um erro inesperado nesta parte da aplicação. Nossa equipe técnica já foi notificada.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-slate-900 text-[#0A1628] px-6 py-3 rounded-xl font-bold hover:bg-black transition-all"
            >
              Recarregar Aplicação
            </button>
          </div>
        </div>
      );
    }

    // Access inherited props.children safely
    return this.props.children;
  }
}

export default ErrorBoundary;