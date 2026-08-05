"use client";

import { useCallback, useState } from "react";
import { UploadCloud, FileText } from "lucide-react";
import type { DocumentMeta, DocumentType, FileItem } from "@/types";

interface FileDropZoneProps {
  onFilesAdded: (items: FileItem[]) => void;
}

const ACCEPTED_TYPES: Record<string, DocumentType> = {
  "application/pdf": "pdf",
  "text/markdown": "md",
  "text/plain": "txt",
};

const ACCEPTED_EXTENSIONS = [".pdf", ".md", ".txt"];

function fileToItem(file: File): FileItem | null {
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  const mimeType = file.type as keyof typeof ACCEPTED_TYPES;

  let type: DocumentType | null = ACCEPTED_TYPES[mimeType] ?? null;

  if (!type) {
    if (ext === ".md") type = "md";
    else if (ext === ".txt") type = "txt";
  }

  if (!type) return null;

  const meta: DocumentMeta = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: file.name,
    type,
    sizeBytes: file.size,
    addedAt: Date.now(),
    status: "extracting",
    progress: 0,
  };

  return { meta, file };
}

export default function FileDropZone({ onFilesAdded }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const processFiles = useCallback(
    (files: FileList | File[]) => {
      const items = Array.from(files)
        .map(fileToItem)
        .filter(Boolean) as FileItem[];
      if (items.length > 0) onFilesAdded(items);
    },
    [onFilesAdded]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  };
  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
    e.target.value = "";
  };

  return (
    <label
      htmlFor="file-upload-input"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className="relative flex flex-col items-center justify-center gap-2 w-full rounded-xl cursor-pointer transition-all duration-200 select-none"
      style={{
        minHeight: "110px",
        border: isDragging
          ? "1.5px dashed #6366f1"
          : "1.5px dashed rgba(99,102,241,0.25)",
        background: isDragging
          ? "rgba(99,102,241,0.10)"
          : "rgba(99,102,241,0.03)",
        boxShadow: isDragging ? "0 0 24px rgba(99,102,241,0.2) inset" : "none",
      }}
    >
      <input
        id="file-upload-input"
        type="file"
        multiple
        accept={ACCEPTED_EXTENSIONS.join(",")}
        onChange={onInputChange}
        className="sr-only"
      />

      <div
        className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200"
        style={{
          background: isDragging
            ? "rgba(99,102,241,0.25)"
            : "rgba(99,102,241,0.1)",
        }}
      >
        <UploadCloud
          className="w-4 h-4 transition-all duration-200"
          style={{ color: isDragging ? "#818cf8" : "#6366f1" }}
        />
      </div>

      <div className="text-center px-2">
        <p className="text-[11px] font-medium text-slate-300">
          {isDragging ? "Release to upload" : "Drop PDF, MD, TXT here"}
        </p>
        <p className="text-[10px] text-slate-500 mt-0.5">
          or tap to select files
        </p>
      </div>

      <div className="flex gap-1 flex-wrap justify-center px-2">
        {["PDF", "MD", "TXT"].map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-wider"
            style={{
              background: "rgba(99,102,241,0.12)",
              color: "#818cf8",
              border: "1px solid rgba(99,102,241,0.2)",
            }}
          >
            <FileText className="w-2 h-2" />
            {t}
          </span>
        ))}
      </div>
    </label>
  );
}