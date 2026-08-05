/**
 * graphBuilder.ts
 *
 * Constructs 3D Knowledge Graph node & edge data structures from ingested documents
 * and text chunks. Computes cross-document vector similarity edges (>0.75 threshold).
 */

import type { DocumentMeta, TextChunk } from "@/types";

export interface Graph3DNode {
  id: string;
  name: string;
  type: "document" | "concept";
  color: string;
  val: number;
  docId: string;
  docName?: string;
  chunkIndex?: number;
  chunkText?: string;
  tokenEstimate?: number;
  x?: number;
  y?: number;
  z?: number;
}

export interface Graph3DLink {
  source: string;
  target: string;
  type: "parent" | "similarity";
  color: string;
  similarity?: number;
  curvature?: number;
}

export interface Graph3DData {
  nodes: Graph3DNode[];
  links: Graph3DLink[];
}

/**
 * Computes cosine similarity between two normalized 384-dim vectors (dot product)
 */
export function computeCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;
  let dot = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
  }
  return dot;
}

/**
 * Builds 3D Knowledge Graph nodes and cross-document similarity links (>0.75 score threshold).
 */
export function build3DKnowledgeGraph(
  documents: DocumentMeta[],
  allChunks: TextChunk[],
  similarityThreshold = 0.75
): Graph3DData {
  const nodes: Graph3DNode[] = [];
  const links: Graph3DLink[] = [];
  const docMap = new Map<string, DocumentMeta>();

  // 1. Primary Document Nodes (Cyan #22d3ee)
  documents.forEach((doc) => {
    docMap.set(doc.id, doc);
    nodes.push({
      id: `doc-${doc.id}`,
      name: doc.name,
      type: "document",
      color: "#22d3ee",
      val: 14,
      docId: doc.id,
      docName: doc.name,
    });
  });

  // 2. Secondary Concept / Chunk Nodes (Purple #a855f7)
  const embeddedChunks: TextChunk[] = [];

  allChunks.forEach((chunk) => {
    const parentDoc = docMap.get(chunk.docId);
    const shortLabel =
      chunk.text.length > 45 ? `${chunk.text.slice(0, 45)}…` : chunk.text;

    nodes.push({
      id: `chunk-${chunk.id}`,
      name: `Chunk #${chunk.index + 1}: ${shortLabel}`,
      type: "concept",
      color: "#a855f7",
      val: 6,
      docId: chunk.docId,
      docName: chunk.docName || parentDoc?.name || "Document",
      chunkIndex: chunk.index,
      chunkText: chunk.text,
      tokenEstimate: chunk.tokenEstimate,
    });

    // Parent structural edge (Cyan tint)
    links.push({
      source: `doc-${chunk.docId}`,
      target: `chunk-${chunk.id}`,
      type: "parent",
      color: "rgba(34, 211, 238, 0.25)",
    });

    if (Array.isArray(chunk.embedding) && chunk.embedding.length === 384) {
      embeddedChunks.push(chunk);
    }
  });

  // 3. Cross-Document Similarity Edges (Cosine similarity > 0.75)
  for (let i = 0; i < embeddedChunks.length; i++) {
    for (let j = i + 1; j < embeddedChunks.length; j++) {
      const cA = embeddedChunks[i];
      const cB = embeddedChunks[j];

      // Only link concepts belonging to DIFFERENT documents
      if (cA.docId !== cB.docId) {
        const sim = computeCosineSimilarity(cA.embedding!, cB.embedding!);
        if (sim >= similarityThreshold) {
          links.push({
            source: `chunk-${cA.id}`,
            target: `chunk-${cB.id}`,
            type: "similarity",
            color: "#818cf8", // Electric Indigo glow
            similarity: sim,
            curvature: 0.2,
          });
        }
      }
    }
  }

  return { nodes, links };
}
