"use client";

import FileDropZone from "./FileDropZone";
import DocumentList from "./DocumentList";
import StorageIndicator from "./StorageIndicator";
import type { DocumentMeta, FileItem } from "@/types";
import { Brain } from "lucide-react";

interface LeftSidebarProps {
  documents: DocumentMeta[];
  onFilesAdded: (items: FileItem[]) => void;
  onRemoveDocument: (id: string) => void;
  onClearStorage?: () => void;
}

export default function LeftSidebar({
  documents,
  onFilesAdded,
  onRemoveDocument,
  onClearStorage,
}: LeftSidebarProps) {
  return (
    <aside className="w-full md:w-[260px] flex-shrink-0 flex flex-col h-full overflow-hidden cyber-panel border-r border-indigo-500/20 bg-[#070a12]">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-4 py-4 flex-shrink-0 border-b border-indigo-500/15">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 btn-cyber-primary">
          <Brain className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-xs font-extrabold tracking-wider uppercase text-gradient-bold">
            MindForge
          </p>
          <p className="text-[9px] font-mono tracking-widest uppercase text-cyan-400">
            Local · Air-Gapped
          </p>
        </div>
      </div>

      {/* Drop Zone */}
      <div className="px-3 pt-3.5 flex-shrink-0">
        <FileDropZone onFilesAdded={onFilesAdded} />
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-hidden flex flex-col px-3 pt-3 min-h-0">
        <p className="text-[10px] font-bold uppercase tracking-wider mb-2 flex-shrink-0 text-slate-400">
          Ingested Documents ({documents.length})
        </p>
        <DocumentList
          documents={documents}
          onRemoveDocument={onRemoveDocument}
        />
      </div>

      {/* Storage Indicator */}
      <div className="flex-shrink-0 px-3 py-3 border-t border-indigo-500/15">
        <StorageIndicator onClearStorage={onClearStorage} />
      </div>
    </aside>
  );
}