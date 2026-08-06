"use client";

import { useEffect, useState } from "react";
import { Database, Trash2 } from "lucide-react";
import { getVectorCount, subscribeVectorStore } from "@/lib/vectorStore";

interface StorageIndicatorProps {
  onClearStorage?: () => void;
}

export default function StorageIndicator({ onClearStorage }: StorageIndicatorProps) {
  const [vectorCount, setVectorCount] = useState<number>(0);
  const [storageInfo, setStorageInfo] = useState<{ usedMB: number; quotaMB: number } | null>(null);

  useEffect(() => {
    // Subscribe to real-time vector count updates
    const unsubscribe = subscribeVectorStore((count) => setVectorCount(count));
    getVectorCount().then((count) => setVectorCount(count));

    // Check browser IndexedDB / OPFS storage quota using native browser API
    if (typeof window !== "undefined" && navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then((estimate: StorageEstimate) => {
        const usage = estimate.usage || 0;
        const quota = estimate.quota || 1;
        setStorageInfo({
          usedMB: Math.round(usage / (1024 * 1024)),
          quotaMB: Math.round(quota / (1024 * 1024)),
        });
      }).catch(() => {});
    }

    return () => unsubscribe();
  }, []);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between text-[10px] font-mono">
        <span className="flex items-center gap-1.5 text-slate-400 font-bold uppercase tracking-wider">
          <Database className="w-3.5 h-3.5 text-cyan-400" /> Vector Index
        </span>
        <span className="text-cyan-400 font-bold">
          {vectorCount} {vectorCount === 1 ? "Chunk" : "Chunks"}
        </span>
      </div>

      {storageInfo && (
        <div className="space-y-1">
          <div className="flex justify-between text-[9px] font-mono text-slate-500">
            <span>Local DB Usage</span>
            <span>{storageInfo.usedMB} MB / {storageInfo.quotaMB} MB</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-black/40 border border-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-cyan-400 transition-all duration-300"
              style={{
                width: `${Math.min((storageInfo.usedMB / Math.max(storageInfo.quotaMB, 1)) * 100, 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {onClearStorage && (
        <button
          onClick={onClearStorage}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-slate-900 border border-white/10 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 text-[10px] font-medium transition-all"
        >
          <Trash2 className="w-3 h-3" />
          Purge Vector Cache
        </button>
      )}
    </div>
  );
}