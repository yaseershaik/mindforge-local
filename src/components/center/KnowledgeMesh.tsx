"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { Network, FileText, X, Sparkles, Search, Loader2 } from "lucide-react";
import type { DocumentMeta, TextChunk } from "@/types";
import { build3DKnowledgeGraph, type Graph3DNode, type Graph3DLink } from "@/lib/graphBuilder";

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
  ssr: false,
  loading: () => null,
});

interface KnowledgeMeshProps {
  documents: DocumentMeta[];
  onSelectConceptPrompt?: (promptText: string) => void;
}

export default function KnowledgeMesh({
  documents,
  onSelectConceptPrompt,
}: KnowledgeMeshProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const [isGraphLoaded, setIsGraphLoaded] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [selectedDocNode, setSelectedDocNode] = useState<Graph3DNode | null>(null);
  const [chunkSearchQuery, setChunkSearchQuery] = useState("");
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    ) || window.innerWidth < 768;

    // Always use lightweight 2D fallback on mobile devices to prevent WebGL canvas crashes
    setIsMobileDevice(isMobile);

    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    handleResize();
    const timer = setTimeout(() => {
      handleResize();
      setIsGraphLoaded(true);
    }, 200);

    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const allChunks = useMemo(() => {
    const list: TextChunk[] = [];
    documents.forEach((d) => {
      if (d.chunks && d.chunks.length > 0) {
        list.push(...d.chunks);
      }
    });
    return list;
  }, [documents]);

  const graphData = useMemo(() => {
    return build3DKnowledgeGraph(documents, allChunks, 0.75);
  }, [documents, allChunks]);

  useEffect(() => {
    if (fgRef.current && graphData.nodes.length > 0) {
      fgRef.current.zoomToFit(400, 50);
    }
  }, [graphData]);

  const handleNodeClick = (node: unknown) => {
    const gNode = node as Graph3DNode;
    if (gNode.type === "document") {
      setSelectedDocNode(gNode);
    } else if (gNode.type === "concept" && gNode.chunkText) {
      const promptText = `Explain the key context of this chunk from ${gNode.docName || "the document"}:\n\n"${gNode.chunkText}"`;
      if (onSelectConceptPrompt) {
        onSelectConceptPrompt(promptText);
      }
    }
  };

  const activeDoc = useMemo(() => {
    if (!selectedDocNode) return null;
    return documents.find((d) => d.id === selectedDocNode.docId) ?? null;
  }, [selectedDocNode, documents]);

  const filteredChunks = useMemo(() => {
    if (!activeDoc || !activeDoc.chunks) return [];
    if (!chunkSearchQuery.trim()) return activeDoc.chunks;
    return activeDoc.chunks.filter((c) =>
      c.text.toLowerCase().includes(chunkSearchQuery.toLowerCase())
    );
  }, [activeDoc, chunkSearchQuery]);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-forge-void flex items-center justify-center">
      {!isGraphLoaded ? (
        <div className="flex flex-col items-center justify-center gap-2 text-indigo-400 font-mono text-xs z-20">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span>Loading Concept Canvas…</span>
        </div>
      ) : isMobileDevice ? (
        /* Lightweight 2D Mobile Concept Fallback (Prevents WebGL infinite stalls) */
        <div className="flex flex-col items-center justify-center gap-3 p-4 z-10 text-center">
          <Network className="w-10 h-10 text-cyan-400" />
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Concept Node Overview (Mobile Mode)
          </h3>
          <p className="text-[10px] text-slate-400 max-w-[260px]">
            WebGL 3D animated canvas paused to conserve mobile hardware resources (Minimum 4GB RAM required).
          </p>
          <div className="flex flex-wrap justify-center gap-2 max-w-[300px] mt-2 max-h-[220px] overflow-y-auto">
            {graphData.nodes.map((n) => (
              <span
                key={n.id}
                onClick={() => handleNodeClick(n)}
                className="px-2 py-1 rounded-lg text-[10px] cursor-pointer border"
                style={{
                  background: `${n.color}15`,
                  borderColor: n.color,
                  color: "#e2e8f0",
                }}
              >
                {n.name}
              </span>
            ))}
          </div>
        </div>
      ) : (
        /* Standard WebGL Desktop Canvas */
        <div className="absolute inset-0 flex items-center justify-center">
          <ForceGraph3D
            ref={fgRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={graphData}
            nodeLabel={(n: unknown) => {
              const node = n as Graph3DNode;
              return `<div style="background:rgba(15,23,42,0.95); border:1px solid #6366f1; border-radius:6px; padding:4px 8px; font-size:11px; color:#e2e8f0; font-family:sans-serif;">
                <strong style="color:${node.color}">${node.type.toUpperCase()}</strong>: ${node.name}
              </div>`;
            }}
            nodeColor={(n: unknown) => (n as Graph3DNode).color}
            nodeVal={(n: unknown) => (n as Graph3DNode).val}
            linkColor={(l: unknown) => (l as Graph3DLink).color}
            linkWidth={(l: unknown) => ((l as Graph3DLink).type === "similarity" ? 2 : 1)}
            linkCurvature={(l: unknown) => (l as Graph3DLink).curvature || 0}
            linkDirectionalParticles={(l: unknown) => ((l as Graph3DLink).type === "similarity" ? 3 : 0)}
            linkDirectionalParticleSpeed={0.006}
            linkDirectionalParticleWidth={2}
            linkDirectionalParticleColor={() => "#22d3ee"}
            onNodeClick={handleNodeClick}
            backgroundColor="#070a12"
          />
        </div>
      )}

      {isGraphLoaded && !isMobileDevice && (
        <div className="absolute top-3 left-3 flex flex-col gap-2 pointer-events-none select-none z-10">
          <div
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[10px]"
            style={{
              background: "rgba(15,23,42,0.85)",
              border: "1px solid rgba(99,102,241,0.2)",
              backdropFilter: "blur(12px)",
            }}
          >
            <div className="flex items-center gap-1 text-cyan-400">
              <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
              Docs ({documents.length})
            </div>
            <div className="flex items-center gap-1 text-purple-400">
              <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
              Concepts ({allChunks.length})
            </div>
          </div>
        </div>
      )}

      {activeDoc && (
        <div
          className="absolute top-0 right-0 bottom-0 w-full sm:w-[320px] flex flex-col shadow-2xl z-20"
          style={{
            background: "rgba(15, 23, 42, 0.95)",
            borderLeft: "1px solid rgba(34,211,238,0.25)",
            backdropFilter: "blur(16px)",
          }}
        >
          <div className="flex items-center justify-between p-3 border-b border-white/10">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <div className="min-w-0">
                <h3 className="text-xs font-semibold text-slate-100 truncate" title={activeDoc.name}>
                  {activeDoc.name}
                </h3>
                <p className="text-[10px] text-slate-400">
                  {activeDoc.chunkCount ?? 0} chunk(s)
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedDocNode(null)}
              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-2 border-b border-white/5">
            <div className="relative flex items-center bg-slate-900/80 rounded-lg px-2.5 py-1 border border-white/10">
              <Search className="w-3.5 h-3.5 text-slate-400 mr-2" />
              <input
                type="text"
                value={chunkSearchQuery}
                onChange={(e) => setChunkSearchQuery(e.target.value)}
                placeholder="Search chunks…"
                className="w-full bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
            {filteredChunks.map((chunk) => (
              <div
                key={chunk.id}
                className="p-2 rounded-xl bg-slate-900/60 border border-white/5 space-y-1 hover:border-cyan-500/30 cursor-pointer"
                onClick={() => {
                  if (onSelectConceptPrompt) {
                    onSelectConceptPrompt(
                      `Explain the context of Chunk #${chunk.index + 1} from ${activeDoc.name}:\n\n"${chunk.text}"`
                    );
                  }
                }}
              >
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-cyan-400 font-semibold">
                    {`Chunk #${chunk.index + 1}`}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-3">
                  {chunk.text}
                </p>
                <div className="flex items-center gap-1 text-[9px] text-indigo-400 pt-0.5">
                  <Sparkles className="w-2.5 h-2.5" />
                  Ask AI about this chunk
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}