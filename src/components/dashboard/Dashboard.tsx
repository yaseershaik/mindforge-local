"use client";

import LeftSidebar from "@/components/sidebar-left/LeftSidebar";
import CenterView, { type Tab } from "@/components/center/CenterView";
import RightSidebar from "@/components/sidebar-right/RightSidebar";
import { useState, useCallback, useEffect } from "react";
import { useIngestionPipeline } from "@/hooks/useIngestionPipeline";
import { removeDocChunks, savePersistedDocuments } from "@/lib/vectorStore";
import type { DocumentMeta, FileItem } from "@/types";
import { FolderOpen, Network, MessageSquareText, Cpu, Brain, Monitor } from "lucide-react";

function checkIsMobileHardware(): boolean {
  if (typeof window === "undefined") return false;

  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";

  // 1. Standard Mobile UA match
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(ua)) {
    return true;
  }

  // 2. UserAgentData mobile flag
  const navData = (navigator as any).userAgentData;
  if (navData && navData.mobile) {
    return true;
  }

  // 3. iOS (iPhone/iPad) in Desktop Site mode:
  // Reports platform "MacIntel", but maxTouchPoints > 1 (real Macs have 0 touch points)
  if (platform === "MacIntel" && navigator.maxTouchPoints > 1) {
    return true;
  }

  // 4. Android in Desktop Site mode:
  // Reports X11/Linux, but maxTouchPoints > 0 AND touch events exist
  if (navigator.maxTouchPoints > 0 && ("ontouchstart" in window || "TouchEvent" in window)) {
    const isArm = /arm|aarch64/i.test(platform);
    const minScreenDim = Math.min(window.screen.width, window.screen.height);
    if (isArm || minScreenDim < 1024 || /Android/i.test(ua)) {
      return true;
    }
  }

  // 5. Fallback for narrow viewports
  if (window.innerWidth < 768) {
    return true;
  }

  return false;
}

export default function Dashboard() {
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [isMobileLeftOpen, setIsMobileLeftOpen] = useState(false);
  const [isMobileRightOpen, setIsMobileRightOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("mesh");
  const [isMobileDevice, setIsMobileDevice] = useState<boolean>(() => checkIsMobileHardware());

  useEffect(() => {
    setIsMobileDevice(checkIsMobileHardware());
  }, []);

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

  if (isMobileDevice) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen w-full bg-[#030712] p-6 text-center space-y-6 relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute w-[350px] h-[350px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

        {/* Brand Icon Badge */}
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center btn-cyber-primary shadow-[0_0_30px_rgba(99,102,241,0.3)] z-10">
          <Brain className="w-8 h-8 text-white" />
        </div>

        {/* Brand Title */}
        <div className="space-y-1 z-10">
          <h1 className="text-xl font-extrabold tracking-wider uppercase text-gradient-bold">
            MindForge Local
          </h1>
          <p className="text-[10px] font-mono tracking-widest uppercase text-cyan-400 font-semibold">
            100% Client-Side · Air-Gapped AI Engine
          </p>
        </div>

        {/* Formal Mobile Notice Card */}
        <div className="cyber-panel p-6 rounded-2xl border border-indigo-500/20 max-w-sm space-y-3.5 shadow-2xl z-10 bg-slate-950/80 backdrop-blur-md">
          <div className="flex items-center justify-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
            <Monitor className="w-4 h-4" />
            <span>Desktop Hardware Required</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            MindForge Local is engineered specifically for desktop and laptop hardware, utilizing high-throughput WebGPU compute pipelines, multithreaded vector indexing, and 3D WebGL visualization.
          </p>
          <div className="pt-3 border-t border-indigo-500/15 text-[11px] text-slate-400">
            Please open this application on your **Desktop or Laptop PC** to access full system capabilities.
          </div>
        </div>

        {/* Supported Browsers Specs */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-white/10 text-[10px] font-mono text-slate-400 z-10">
          <span>Supported: Chrome / Edge / Brave (Windows, macOS, Linux)</span>
        </div>
      </div>
    );
  }

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