"use client";

import HardwareDiagnostics from "./HardwareDiagnostics";
import { Activity } from "lucide-react";

export default function RightSidebar() {
  return (
    <aside className="w-[300px] flex-shrink-0 flex flex-col h-full overflow-hidden cyber-panel border-l border-indigo-500/20 bg-[#070a12]">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-4 flex-shrink-0 border-b border-indigo-500/15">
        <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
        <span className="text-xs font-bold tracking-wider uppercase text-gradient-bold">
          System Telemetry
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3.5 min-h-0 space-y-4">
        <HardwareDiagnostics />
      </div>
    </aside>
  );
}