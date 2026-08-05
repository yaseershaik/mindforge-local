/**
 * embedWorkerPool.ts
 *
 * Singleton manager for embed.worker.ts.
 */

import type { TextChunk, EmbedWorkerOutMessage, EmbedWorkerTask } from "@/types";

type EmbedJobHandler = (msg: EmbedWorkerOutMessage) => void;

class EmbedWorkerPool {
  private worker: Worker;
  private handlers = new Map<string, EmbedJobHandler>();

  constructor() {
    this.worker = new Worker(
      new URL("../workers/embed.worker.ts", import.meta.url),
      { type: "module" }
    );

    this.worker.addEventListener("message", (event: MessageEvent<EmbedWorkerOutMessage>) => {
      const msg = event.data;
      const handler = this.handlers.get(msg.jobId);
      if (handler) {
        handler(msg);
        if (msg.type === "embed-done" || msg.type === "embed-error") {
          this.handlers.delete(msg.jobId);
        }
      }
    });

    this.worker.addEventListener("error", (event) => {
      console.error("[EmbedWorkerPool] Uncaught worker error:", event.message);
    });
  }

  enqueue(
    jobId: string,
    docId: string,
    chunks: TextChunk[],
    handler: EmbedJobHandler
  ): void {
    this.handlers.set(jobId, handler);
    const task: EmbedWorkerTask = {
      type: "embed",
      jobId,
      docId,
      chunks,
    };
    this.worker.postMessage(task);
  }

  terminate(): void {
    this.worker.terminate();
    this.handlers.clear();
  }
}

let instance: EmbedWorkerPool | null = null;

export function getEmbedWorkerPool(): EmbedWorkerPool | null {
  if (typeof window === "undefined") return null;
  if (!instance) instance = new EmbedWorkerPool();
  return instance;
}

export function terminateEmbedWorkerPool(): void {
  instance?.terminate();
  instance = null;
}
