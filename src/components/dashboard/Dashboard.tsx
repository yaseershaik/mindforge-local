"use client";

import LeftSidebar from "@/components/sidebar-left/LeftSidebar";
import CenterView, { type Tab } from "@/components/center/CenterView";
import RightSidebar from "@/components/sidebar-right/RightSidebar";
import { useState, useCallback } from "react";
import { useIngestionPipeline } from "@/hooks/useIngestionPipeline";
import { removeDocChunks, savePersistedDocuments } from "@/lib/vectorStore";
import type { DocumentMeta, FileItem } from "@/types";
import { FolderOpen, Network, MessageSquareText, Cpu, Brain } from "lucide-react";

export default function Dashboard() {
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [isMobileLeftOpen, setIsMobileLeftOpen] = useState(false);
  const [isMobileRightOpen, setIsMobileRightOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("mesh");

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
      {/* Mobile Top Header (Premium Glassmorphic Cyber Header) */}
      <div className="md:hidden flex items-center justify-between px-4 py-2.5 bg-slate-950/80 backdrop-blur-md border-b border-indigo-500/20 z-20 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center btn-cyber-primary shadow-[0_0_10px_rgba(99,102,241,0.4)]">
            <Brain className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-[12px] font-extrabold uppercase tracking-wider text-gradient-bold leading-tight">
              MindForge
            </span>
            <span className="text-[9px] font-mono tracking-widest uppercase text-cyan-400 font-semibold leading-tight">
              Local AI Engine
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-[10px] font-mono text-cyan-300">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          {documents.length > 0 ? `${documents.length} DOC${documents.length > 1 ? "S" : ""}` : "AIR-GAPPED"}
        </div>
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
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-20 md:hidden transition-opacity"
        />
      )}

      {/* Center View Window */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        <CenterView documents={documents} activeTab={activeTab} setActiveTab={setActiveTab} />
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
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-20 md:hidden transition-opacity"
        />
      )}

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden flex items-center justify-around bg-slate-900 border-t border-indigo-500/20 pb-2 pt-1.5 px-2 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
        <button
          onClick={() => {
            setIsMobileLeftOpen(true);
            setIsMobileRightOpen(false);
          }}
          className={`flex flex-col items-center gap-0.5 p-1.5 transition-colors ${
            isMobileLeftOpen ? "text-cyan-400" : "text-slate-400 hover:text-slate-300"
          }`}
        >
          <FolderOpen className="w-4 h-4" />
          <span className="text-[9px] font-semibold tracking-wide">Docs</span>
        </button>

        <button
          onClick={() => {
            setActiveTab("mesh");
            setIsMobileLeftOpen(false);
            setIsMobileRightOpen(false);
          }}
          className={`flex flex-col items-center gap-0.5 p-1.5 transition-colors ${
            !isMobileLeftOpen && !isMobileRightOpen && activeTab === "mesh"
              ? "text-cyan-400"
              : "text-slate-400 hover:text-slate-300"
          }`}
        >
          <Network className="w-4 h-4" />
          <span className="text-[9px] font-semibold tracking-wide">Mesh</span>
        </button>

        <button
          onClick={() => {
            setActiveTab("chat");
            setIsMobileLeftOpen(false);
            setIsMobileRightOpen(false);
          }}
          className={`flex flex-col items-center gap-0.5 p-1.5 transition-colors ${
            !isMobileLeftOpen && !isMobileRightOpen && activeTab === "chat"
              ? "text-cyan-400"
              : "text-slate-400 hover:text-slate-300"
          }`}
        >
          <MessageSquareText className="w-4 h-4" />
          <span className="text-[9px] font-semibold tracking-wide">Chat</span>
        </button>

        <button
          onClick={() => {
            setIsMobileRightOpen(true);
            setIsMobileLeftOpen(false);
          }}
          className={`flex flex-col items-center gap-0.5 p-1.5 transition-colors ${
            isMobileRightOpen ? "text-cyan-400" : "text-slate-400 hover:text-slate-300"
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span className="text-[9px] font-semibold tracking-wide">System</span>
        </button>
      </div>
    </div>
  );
}