"use client";

import { useEffect, useState, useCallback } from "react";
import { Database, Trash2, Cpu } from "lucide-react";
import { getVectorCount, subscribeVectorStore } from "@/lib/vectorStore";
import type { StorageEstimate } from "@/types";

interface StorageIndicatorProps {
  onClearStorage?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export default function StorageIndicator({ onClearStorage }: StorageIndicatorProps) {
  const [storage, setStorage] = useState<StorageEstimate | null>(null);
  const [vectorCount, setVectorCount] = useState<number>(0);
  const [isClearing, setIsClearing] = useState(false);

  const fetchStorage = useCallback(async () => {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      const usage = est.usage ?? 0;
      const quota = est.quota ?? 1;
      setStorage({
        usageBytes: usage,
        quotaBytes: quota,
        usagePercent: Math.min((usage / quota) * 100, 100),
      });
    }

    const count = await getVectorCount();
    setVectorCount(count);
  }, []);

  useEffect(() => {
    fetchStorage();
    const unsubscribe = subscribeVectorStore(() => {
      fetchStorage();
    });
    const intervalId = setInterval(fetchStorage, 8_000);
    return () => {
      unsubscribe();
      clearInterval(intervalId);
    };
  }, [fetchStorage]);

  const handleClear = async () => {
    if (isClearing) return;
    setIsClearing(true);
    try {
      if (onClearStorage) {
        await onClearStorage();
      }
      await fetchStorage();
    } finally {
      setIsClearing(false);
    }
  };

  const pct = storage?.usagePercent ?? 0;
  const barColor = pct > 80 ? "#f43f5e" : pct > 50 ? "#f59e0b" : "#6366f1";

  return (
    <div className="space-y-2.5">
      {/* Header row */}
      <div className="flex items-center gap-1.5 justify-between">
        <div className="flex items-center gap-1.5">
          <Database className="w-3 h-3" style={{ color: "#6366f1" }} />
          <span
            className="text-[10px] font-semibold tracking-[0.1em] uppercase"
            style={{ color: "#475569" }}
          >
            IndexedDB / Vector DB
          </span>
        </div>
        <span className="text-[10px] font-mono" style={{ color: "#94a3b8" }}>
          {storage ? pct.toFixed(1) : "--"}%
        </span>
      </div>

      {/* Usage Bar */}
      <div
        className="relative w-full h-1.5 rounded-full overflow-hidden"
        style={{ background: "rgba(255,255,255,0.05)" }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
          style={{
            width: storage ? `${pct}%` : "0%",
            background: `linear-gradient(90deg, ${barColor}99, ${barColor})`,
            boxShadow: storage ? `0 0 8px ${barColor}66` : "none",
          }}
        />
      </div>

      {/* Vector count & Clear action row */}
      <div className="flex items-center justify-between pt-0.5">
        <div className="flex items-center gap-1 text-[10px]" style={{ color: "#818cf8" }}>
          <Cpu className="w-2.5 h-2.5" />
          <span className="font-mono font-medium">
            {vectorCount.toLocaleString()} vector{vectorCount !== 1 ? "s" : ""}
          </span>
        </div>

        <button
          onClick={handleClear}
          disabled={isClearing}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium transition-all duration-150 hover:bg-red-500/15 disabled:opacity-40"
          style={{ color: "#f43f5e", border: "1px solid rgba(244,63,94,0.2)" }}
          title="Clear vector database & IndexedDB storage"
        >
          <Trash2 className="w-2.5 h-2.5" />
          Clear
        </button>
      </div>

      {storage && (
        <div className="flex justify-between">
          <span className="text-[9px] font-mono" style={{ color: "#334155" }}>
            {formatBytes(storage.usageBytes)} used
          </span>
          <span className="text-[9px] font-mono" style={{ color: "#334155" }}>
            {formatBytes(storage.quotaBytes)} quota
          </span>
        </div>
      )}
    </div>
  );
}
