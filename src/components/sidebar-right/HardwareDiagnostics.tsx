"use client";

import { useEffect, useState } from "react";
import {
  Gpu,
  Cpu,
  Activity,
  CheckCircle2,
  XCircle,
  Loader2,
  Zap,
  AlertTriangle,
  Download,
  Box,
  HardDrive,
} from "lucide-react";
import type { HardwareInfo } from "@/types";
import {
  SUPPORTED_MODELS,
  subscribeEngineState,
  loadModelEngine,
  type EngineState,
} from "@/lib/webLlmEngine";

interface PerformanceWithMemory extends Performance {
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

function TelemetryBar({
  used,
  total,
  label,
  accentColor = "#22d3ee",
}: {
  used: number;
  total: number;
  label: string;
  accentColor?: string;
}) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const barColor = pct > 80 ? "#f43f5e" : pct > 60 ? "#f59e0b" : accentColor;

  return (
    <div className="space-y-1.5 p-2.5 rounded-xl bg-slate-900/60 border border-white/5">
      <div className="flex justify-between items-center text-[10px] font-mono">
        <span className="uppercase tracking-wider font-semibold text-slate-400">
          {label}
        </span>
        <span className="font-bold" style={{ color: barColor }}>
          {pct.toFixed(1)}%
        </span>
      </div>
      <div className="w-full h-2 rounded-full overflow-hidden bg-black/40 border border-white/5">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${barColor}aa, ${barColor})`,
            boxShadow: `0 0 10px ${barColor}66`,
          }}
        />
      </div>
      <div className="flex justify-between text-[9px] font-mono text-slate-500">
        <span>{formatMB(used)}</span>
        <span>{formatMB(total)}</span>
      </div>
    </div>
  );
}

export default function HardwareDiagnostics() {
  const [hw, setHw] = useState<HardwareInfo>({ webgpuStatus: "checking" });
  const [engineState, setEngineState] = useState<EngineState>({
    status: "unloaded",
    selectedModelId: SUPPORTED_MODELS[0].id,
    progress: 0,
    progressText: "",
    errorMessage: null,
  });

  useEffect(() => {
    const unsubscribe = subscribeEngineState(setEngineState);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const probe = async () => {
      if (!navigator.gpu) {
        setHw((p) => ({ ...p, webgpuStatus: "unsupported" }));
        return;
      }

      try {
        const adapter = await navigator.gpu.requestAdapter({
          powerPreference: "high-performance",
        });

        if (!adapter) {
          setHw((p) => ({ ...p, webgpuStatus: "unsupported" }));
          return;
        }

        let infoVendor = "Hardware GPU";
        let infoDesc = "WebGPU Execution Context";

        if ("info" in adapter && adapter.info) {
          const info = adapter.info as unknown as Record<string, string>;
          infoVendor = info.vendor || infoVendor;
          infoDesc = info.description || infoDesc;
        }

        const maxBuf = adapter.limits?.maxBufferSize ?? 0;
        const estimatedVRAMMB = Math.round(maxBuf / (1024 * 1024));

        setHw((p) => ({
          ...p,
          webgpuStatus: "supported",
          adapterInfo: {
            vendor: infoVendor,
            architecture: "WebGPU Native",
            device: "GPU Context",
            description: infoDesc,
          },
          estimatedVRAMMB,
          backend: "WebGPU (Direct Compute)",
        }));
      } catch {
        setHw((p) => ({ ...p, webgpuStatus: "error" }));
      }
    };

    probe();

    const refreshHeap = () => {
      const mem = (performance as PerformanceWithMemory).memory;
      if (mem) {
        setHw((p) => ({
          ...p,
          usedJSHeapMB: mem.usedJSHeapSize,
          totalJSHeapMB: mem.totalJSHeapSize,
          jsHeapLimitMB: mem.jsHeapSizeLimit,
        }));
      }
    };
    refreshHeap();
    const id = setInterval(refreshHeap, 2500);
    return () => clearInterval(id);
  }, []);

  const handleStartLoad = () => {
    loadModelEngine(engineState.selectedModelId).catch(() => {});
  };

  const selectedModelSpec = SUPPORTED_MODELS.find(
    (m) => m.id === engineState.selectedModelId
  );

  const statusColor = {
    checking: "#f59e0b",
    supported: "#22d3ee",
    unsupported: "#f43f5e",
    error: "#f43f5e",
  }[hw.webgpuStatus];

  const StatusIcon =
    hw.webgpuStatus === "checking"
      ? Loader2
      : hw.webgpuStatus === "supported"
      ? CheckCircle2
      : XCircle;

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* WebGPU Status Banner */}
      <div
        className="rounded-2xl p-3.5 space-y-2 cyber-panel"
        style={{
          borderColor: `${statusColor}44`,
          boxShadow: `0 0 15px ${statusColor}15`,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusIcon
              className={`w-4 h-4 ${
                hw.webgpuStatus === "checking" ? "animate-spin" : ""
              }`}
              style={{ color: statusColor }}
            />
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: statusColor }}
            >
              {hw.webgpuStatus === "supported" ? "WebGPU Engine Active" : "WebGPU Probe"}
            </span>
          </div>
          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-black/40 border border-white/10 text-slate-400">
            AIR-GAPPED
          </span>
        </div>

        {hw.adapterInfo && (
          <p className="text-[11px] font-medium text-slate-300 truncate">
            {hw.adapterInfo.description !== "WebGPU Execution Context"
              ? hw.adapterInfo.description
              : hw.adapterInfo.vendor}
          </p>
        )}
      </div>

      {/* Model Loader & VRAM Allocation Control */}
      <div className="rounded-2xl p-3.5 space-y-3 cyber-panel border border-indigo-500/20">
        <div className="flex items-center gap-2">
          <Box className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Model Engine Selector
          </span>
        </div>

        <select
          value={engineState.selectedModelId}
          disabled={engineState.status === "loading" || engineState.isGenerating}
          onChange={(e) => {
            loadModelEngine(e.target.value).catch(() => {});
          }}
          className="w-full bg-slate-900 border border-indigo-500/30 text-slate-200 text-xs rounded-xl px-3 py-2 outline-none font-medium cursor-pointer hover:border-indigo-400 transition-colors"
        >
          {SUPPORTED_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.vramMB}MB VRAM)
            </option>
          ))}
        </select>

        {selectedModelSpec && (
          <p className="text-[10px] text-slate-400 leading-normal">
            {selectedModelSpec.description}
          </p>
        )}

        {engineState.status === "unloaded" && (
          <button
            onClick={handleStartLoad}
            disabled={hw.webgpuStatus !== "supported"}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold btn-cyber-primary transition-all disabled:opacity-30"
          >
            <Download className="w-3.5 h-3.5" />
            Initialize WebGPU Memory
          </button>
        )}

        {engineState.status === "loading" && (
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between items-center text-[10px] font-mono">
              <span className="text-purple-300 truncate max-w-[170px]">
                {engineState.progressText}
              </span>
              <span className="text-purple-400 font-bold">
                {engineState.progress}%
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden bg-black/40">
              <div
                className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-indigo-500 to-purple-500"
                style={{
                  width: `${engineState.progress}%`,
                  boxShadow: "0 0 10px rgba(168,85,247,0.5)",
                }}
              />
            </div>
          </div>
        )}

        {engineState.status === "ready" && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            VRAM Compiled & Ready
          </div>
        )}
      </div>

      {/* High-Value Telemetry & Allocation Metrics */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2 px-1">
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Real-Time Allocation
          </span>
        </div>

        {/* VRAM Budget Indicator */}
        <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 font-medium text-slate-300">
              <Gpu className="w-3.5 h-3.5 text-indigo-400" /> VRAM Budget
            </span>
            <span className="font-mono font-bold text-purple-400">
              {hw.estimatedVRAMMB ? `${hw.estimatedVRAMMB} MB` : "Probing..."}
            </span>
          </div>
          <p className="text-[9px] font-mono text-slate-500">
            Hardware GPU maxBufferSize allocation limit
          </p>
        </div>

        {/* Memory Load Gauges */}
        {hw.usedJSHeapMB && hw.totalJSHeapMB ? (
          <TelemetryBar
            used={hw.usedJSHeapMB}
            total={hw.totalJSHeapMB}
            label="JS Heap Memory"
            accentColor="#22d3ee"
          />
        ) : null}

        {hw.totalJSHeapMB && hw.jsHeapLimitMB ? (
          <TelemetryBar
            used={hw.totalJSHeapMB}
            total={hw.jsHeapLimitMB}
            label="Heap Limit Allocation"
            accentColor="#a855f7"
          />
        ) : null}
      </div>

      <p className="text-[9px] text-center text-slate-600 font-mono pt-2">
        100% Client Compute · Zero Cloud Reliance
      </p>
    </div>
  );
}