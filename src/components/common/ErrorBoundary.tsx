"use client";

import React, { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackText?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary caught an error]:", error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[250px] h-full w-full bg-[#030712] p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-rose-400" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-200">
              {this.props.fallbackText || "Component Error Recovered"}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
              {this.state.error?.message || "An unexpected rendering issue occurred on this device."}
            </p>
          </div>
          <button
            onClick={this.handleReload}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold btn-cyber-primary transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reload Component
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
