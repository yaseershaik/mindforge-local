"use client";

import { useState, useCallback } from "react";
import { Network, MessageSquareText } from "lucide-react";
import KnowledgeMesh from "./KnowledgeMesh";
import AgentChat from "./AgentChat";
import type { DocumentMeta } from "@/types";

type Tab = "mesh" | "chat";

interface CenterViewProps {
  documents: DocumentMeta[];
}

export default function CenterView({ documents }: CenterViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>("mesh");
  const [conceptPrompt, setConceptPrompt] = useState<string>("");

  const handleSelectConceptPrompt = useCallback((promptText: string) => {
    setConceptPrompt(promptText);
    setActiveTab("chat");
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "#070a12" }}>
      {/* Top Bar */}
      <div
        className="flex items-center gap-2 px-6 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(99,102,241,0.08)" }}
      >
        {/* Tab Switcher */}
        <div
          className="flex items-center gap-1 p-1 rounded-xl"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <button
            id="tab-mesh"
            onClick={() => setActiveTab("mesh")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-200 ${
              activeTab === "mesh" ? "forge-tab-active" : "forge-tab-inactive"
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            3D Knowledge Mesh
          </button>
          <button
            id="tab-chat"
            onClick={() => setActiveTab("chat")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-200 ${
              activeTab === "chat" ? "forge-tab-active" : "forge-tab-inactive"
            }`}
          >
            <MessageSquareText className="w-3.5 h-3.5" />
            Agent Chat
          </button>
        </div>

        <div className="flex-1" />

        {documents.length > 0 && (
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium"
            style={{
              background: "rgba(99,102,241,0.12)",
              border: "1px solid rgba(99,102,241,0.25)",
              color: "#818cf8",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "#6366f1" }}
            />
            {documents.length} document{documents.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 relative">
        <div
          className={`absolute inset-0 transition-opacity duration-300 ${
            activeTab === "mesh" ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        >
          <KnowledgeMesh
            documents={documents}
            onSelectConceptPrompt={handleSelectConceptPrompt}
          />
        </div>
        <div
          className={`absolute inset-0 transition-opacity duration-300 ${
            activeTab === "chat" ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        >
          <AgentChat documents={documents} initialPrompt={conceptPrompt} />
        </div>
      </div>
    </div>
  );
}