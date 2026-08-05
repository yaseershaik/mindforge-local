/**
 * embed.worker.ts
 *
 * Off-main-thread Web Worker for generating 384-dimensional vector embeddings
 * using @xenova/transformers with Xenova/all-MiniLM-L6-v2.
 */

import { pipeline, env } from "@xenova/transformers";
import type { TextChunk, EmbedWorkerTask, EmbedWorkerOutMessage } from "@/types";

// Configure Transformers.js environment for browser worker
env.allowLocalModels = false;
env.useBrowserCache = true;

let extractorPipeline: any = null;

async function getExtractor() {
  if (!extractorPipeline) {
    console.log("[EmbedWorker] Loading model Xenova/all-MiniLM-L6-v2...");
    extractorPipeline = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    console.log("[EmbedWorker] Model loaded successfully.");
  }
  return extractorPipeline;
}

function post(msg: EmbedWorkerOutMessage) {
  (self as unknown as Worker).postMessage(msg);
}

async function handleEmbedTask(task: EmbedWorkerTask) {
  const { jobId, docId, chunks } = task;
  console.log(`[EmbedWorker] Starting embedding for ${chunks.length} chunks (docId: ${docId})`);

  try {
    post({
      type: "embed-progress",
      jobId,
      docId,
      progress: 0,
      current: 0,
      total: chunks.length,
      message: "Loading embedding model…",
    });

    const extractor = await getExtractor();
    const chunksWithEmbeddings: TextChunk[] = [];
    const total = chunks.length;

    for (let i = 0; i < total; i++) {
      const chunk = chunks[i];

      // Extract 384-dim normalized vector
      const output = await extractor(chunk.text, {
        pooling: "mean",
        normalize: true,
      });

      const embeddingArray = Array.from(output.data as Float32Array);

      chunksWithEmbeddings.push({
        ...chunk,
        embedding: embeddingArray,
      });

      const pct = Math.round(((i + 1) / total) * 100);
      post({
        type: "embed-progress",
        jobId,
        docId,
        progress: pct,
        current: i + 1,
        total,
        message: `Embedding chunk ${i + 1} / ${total}`,
      });

      // Yield event loop so worker postMessage can flush
      await new Promise<void>((r) => setTimeout(r, 0));
    }

    console.log(`[EmbedWorker] Completed embeddings for docId: ${docId}`);
    post({
      type: "embed-done",
      jobId,
      docId,
      chunks: chunksWithEmbeddings,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[EmbedWorker] Error embedding docId ${docId}:`, message);
    post({
      type: "embed-error",
      jobId,
      docId,
      message,
    });
  }
}

self.addEventListener("message", (event: MessageEvent<EmbedWorkerTask>) => {
  if (event.data?.type === "embed") {
    handleEmbedTask(event.data);
  }
});
