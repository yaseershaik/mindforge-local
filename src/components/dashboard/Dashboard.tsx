"use client";

import LeftSidebar from "@/components/sidebar-left/LeftSidebar";
import CenterView from "@/components/center/CenterView";
import RightSidebar from "@/components/sidebar-right/RightSidebar";
import { useState, useCallback } from "react";
import { useIngestionPipeline } from "@/hooks/useIngestionPipeline";
import { removeDocChunks, savePersistedDocuments } from "@/lib/vectorStore";
import type { DocumentMeta, FileItem } from "@/types";
import { Menu, X, Cpu } from "lucide-react";

export default function Dashboard() {
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [isMobileLeftOpen, setIsMobileLeftOpen] = useState(false);
  const [isMobileRightOpen, setIsMobileRightOpen] = useState(false);

  const updateDocument = useCallback(
    (id: string, patch: Partial<DocumentMeta>) => {
      setDocuments((prev) => {
        const next = prev.map((doc) => (doc.id === id ? { ...doc, ...patch } : doc));
        savePersistedDocuments(next);
        return next;
      });
    },
    []
  );

  const handleHydrateDocuments = useCallback((savedDocs: DocumentMeta[]) => {
    setDocuments(savedDocs);
  }, []);

  const { processFiles, purgeAllStorage } = useIngestionPipeline(
    updateDocument,
    handleHydrateDocuments
  );

  const handleFilesAdded = useCallback(
    (items: FileItem[]) => {
      setDocuments((prev) => {
        const next = [...prev, ...items.map((item) => item.meta)];
        savePersistedDocuments(next);
        return next;
      });
      processFiles(items);
    },
    [processFiles]
  );

  const handleRemoveDocument = useCallback(async (id: string) => {
    setDocuments((prev) => {
      const next = prev.filter((d) => d.id !== id);
      savePersistedDocuments(next);
      return next;
    });
    await removeDocChunks(id);
  }, []);

  const handleClearStorage = useCallback(async () => {
    await purgeAllStorage();
    setDocuments([]);
  }, [purgeAllStorage]);

  return (
    <div className="flex flex-col md:flex-row h-screen w-full overflow-hidden bg-forge-void relative">
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-indigo-500/20 z-20">
        <button
          onClick={() => setIsMobileLeftOpen(!isMobileLeftOpen)}
          className="p-1.5 rounded-lg bg-slate-800 text-slate-300"
        >
          {isMobileLeftOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
          MindForge Local
        </span>

        <button
          onClick={() => setIsMobileRightOpen(!isMobileRightOpen)}
          className="p-1.5 rounded-lg bg-slate-800 text-indigo-400"
        >
          <Cpu className="w-5 h-5" />
        </button>
      </div>

      {/* Left Sidebar Drawer */}
      <div
        className={`fixed md:relative inset-y-0 left-0 z-30 transform transition-transform duration-300 ${
          isMobileLeftOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <LeftSidebar
          documents={documents}
          onFilesAdded={handleFilesAdded}
          onRemoveDocument={handleRemoveDocument}
          onClearStorage={handleClearStorage}
        />
      </div>

      {/* Left Drawer Mobile Backdrop */}
      {isMobileLeftOpen && (
        <div
          onClick={() => setIsMobileLeftOpen(false)}
          className="fixed inset-0 bg-black/60 z-20 md:hidden"
        />
      )}

      {/* Center View Window */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        <CenterView documents={documents} />
      </main>

      {/* Right Sidebar Hardware Diagnostics Drawer */}
      <div
        className={`fixed md:relative inset-y-0 right-0 z-30 transform transition-transform duration-300 ${
          isMobileRightOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
        }`}
      >
        <RightSidebar />
      </div>

      {/* Right Drawer Mobile Backdrop */}
      {isMobileRightOpen && (
        <div
          onClick={() => setIsMobileRightOpen(false)}
          className="fixed inset-0 bg-black/60 z-20 md:hidden"
        />
      )}
    </div>
  );
}