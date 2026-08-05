"use client";

import type { DocumentMeta, IngestionStatus } from "@/types";
import {
  FileText,
  FileType2,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface DocumentListProps {
  documents: DocumentMeta[];
  onRemoveDocument: (id: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusIcon({ status }: { status: IngestionStatus }) {
  switch (status) {
    case "done":
      return (
        <CheckCircle2
          className="w-3 h-3 flex-shrink-0"
          style={{ color: "#22d3ee" }}
        />
      );
    case "error":
      return (
        <AlertCircle
          className="w-3 h-3 flex-shrink-0"
          style={{ color: "#f43f5e" }}
        />
      );
    case "idle":
      return (
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: "#475569" }}
        />
      );
    default:
      return (
        <Loader2
          className="w-3 h-3 flex-shrink-0 animate-spin"
          style={{ color: "#6366f1" }}
        />
      );
  }
}

function DocTypeIcon({ type }: { type: DocumentMeta["type"] }) {
  const cls = "w-3.5 h-3.5 flex-shrink-0";
  switch (type) {
    case "pdf":
      return <FileType2 className={cls} style={{ color: "#f59e0b" }} />;
    case "md":
      return <FileText className={cls} style={{ color: "#22d3ee" }} />;
    default:
      return <FileText className={cls} style={{ color: "#94a3b8" }} />;
  }
}

const STATUS_LABELS: Record<IngestionStatus, string> = {
  idle: "Queued",
  extracting: "Extracting…",
  chunking: "Chunking…",
  embedding: "Embedding…",
  indexing: "Indexing…",
  done: "Indexed",
  error: "Error",
};

const ACTIVE_STATUSES: IngestionStatus[] = [
  "extracting",
  "chunking",
  "embedding",
  "indexing",
];

/** Colour of the progress bar based on current pipeline stage */
function progressBarColor(status: IngestionStatus): string {
  switch (status) {
    case "extracting":
      return "#f59e0b"; // amber — reading bytes
    case "chunking":
      return "#6366f1"; // indigo — splitting
    case "embedding":
      return "#a855f7"; // violet — encoding
    case "indexing":
      return "#22d3ee"; // cyan — writing index
    default:
      return "#6366f1";
  }
}

function ProgressBar({
  status,
  progress,
}: {
  status: IngestionStatus;
  progress: number;
}) {
  const isActive = ACTIVE_STATUSES.includes(status);
  const color = progressBarColor(status);
  const pct = Math.max(0, Math.min(100, progress));

  return (
    <div
      style={{
        // Animate the height in/out so it doesn't pop
        maxHeight: isActive ? "20px" : "0px",
        opacity: isActive ? 1 : 0,
        overflow: "hidden",
        transition: "max-height 0.3s ease, opacity 0.25s ease",
        marginTop: isActive ? "5px" : "0",
      }}
    >
      {/* Track */}
      <div
        className="relative w-full rounded-full overflow-hidden"
        style={{
          height: "3px",
          background: "rgba(255,255,255,0.06)",
        }}
      >
        {/* Fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            boxShadow: `0 0 6px ${color}66`,
            transition: "width 0.3s ease",
          }}
        />
      </div>

      {/* Percentage label */}
      <div className="flex justify-between mt-1">
        <span
          className="text-[9px] font-mono"
          style={{ color }}
        >
          {STATUS_LABELS[status]}
        </span>
        <span
          className="text-[9px] font-mono"
          style={{ color: "#334155" }}
        >
          {pct.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

export default function DocumentList({
  documents,
  onRemoveDocument,
}: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 pb-4 opacity-40">
        <FileText className="w-6 h-6 text-forge-text-muted" />
        <p className="text-[10px] text-forge-text-muted text-center">
          No documents yet.
          <br />
          Drop files above to begin.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-1 pr-0.5 pb-1">
      {documents.map((doc, i) => (
        <div
          key={doc.id}
          className="group flex flex-col px-2.5 py-2 rounded-lg transition-all duration-150 animate-fade-in-up"
          style={{
            animationDelay: `${i * 30}ms`,
            background: "rgba(99,102,241,0.04)",
            border:
              doc.status === "error"
                ? "1px solid rgba(244,63,94,0.25)"
                : "1px solid rgba(99,102,241,0.08)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.background =
              "rgba(99,102,241,0.09)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.background =
              "rgba(99,102,241,0.04)";
          }}
        >
          {/* Top row: icon + name + remove btn */}
          <div className="flex items-start gap-2">
            <DocTypeIcon type={doc.type} />

            <div className="flex-1 min-w-0">
              <p
                className="text-[11px] font-medium truncate"
                style={{ color: "#cbd5e1" }}
                title={doc.name}
              >
                {doc.name}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <StatusIcon status={doc.status} />
                <span className="text-[9px]" style={{ color: "#475569" }}>
                  {STATUS_LABELS[doc.status]}
                </span>
                {doc.status === "done" && doc.chunkCount != null && (
                  <span className="text-[9px]" style={{ color: "#334155" }}>
                    · {doc.chunkCount} chunks
                  </span>
                )}
                {doc.status !== "done" && (
                  <span className="text-[9px]" style={{ color: "#334155" }}>
                    · {formatBytes(doc.sizeBytes)}
                  </span>
                )}
              </div>

              {/* Error message */}
              {doc.status === "error" && doc.errorMessage && (
                <p
                  className="text-[9px] mt-1 leading-tight"
                  style={{ color: "#f43f5e" }}
                  title={doc.errorMessage}
                >
                  {doc.errorMessage.length > 60
                    ? doc.errorMessage.slice(0, 60) + "…"
                    : doc.errorMessage}
                </p>
              )}
            </div>

            <button
              onClick={() => onRemoveDocument(doc.id)}
              className="opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5 transition-opacity duration-150 rounded p-0.5 hover:bg-red-500/20"
              title="Remove document"
            >
              <X className="w-3 h-3" style={{ color: "#94a3b8" }} />
            </button>
          </div>

          {/* Progress bar (slides in while active) */}
          <ProgressBar
            status={doc.status}
            progress={doc.progress ?? 0}
          />
        </div>
      ))}
    </div>
  );
}
