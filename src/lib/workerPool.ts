/**
 * workerPool.ts
 *
 * Lazy-initialised singleton that owns the ingestion Web Worker instance and
 * routes incoming messages back to per-job callback handlers.
 *
 * Only ever instantiated in the browser — the `getWorkerPool()` factory
 * guard prevents it running during SSR.
 */

import type {
  DocumentType,
  WorkerIngestMessage,
  WorkerOutMessage,
} from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────

type JobHandler = (msg: WorkerOutMessage) => void;

class WorkerPool {
  private worker: Worker;
  private handlers = new Map<string, JobHandler>();

  constructor() {
    // webpack resolves `new URL(...)` at compile time and emits the worker as
    // a separate chunk. The { type: 'module' } option enables ESM in the worker.
    this.worker = new Worker(
      new URL("../workers/ingestion.worker.ts", import.meta.url),
      { type: "module" }
    );

    this.worker.addEventListener("message", (event: MessageEvent<WorkerOutMessage>) => {
      const msg = event.data;
      const handler = this.handlers.get(msg.jobId);
      if (handler) {
        handler(msg);
        // Clean up completed jobs
        if (msg.type === "done" || msg.type === "error") {
          this.handlers.delete(msg.jobId);
        }
      }
    });

    this.worker.addEventListener("error", (event) => {
      console.error("[WorkerPool] Uncaught worker error:", event.message);
    });
  }

  enqueue(
    jobId: string,
    buffer: ArrayBuffer,
    fileName: string,
    fileType: DocumentType,
    handler: JobHandler
  ): void {
    this.handlers.set(jobId, handler);

    const msg: WorkerIngestMessage = {
      type: "ingest",
      jobId,
      buffer,
      fileName,
      fileType,
    };

    // Transfer ArrayBuffer ownership — zero-copy, buffer is neutered on this side
    this.worker.postMessage(msg, [buffer]);
  }

  terminate(): void {
    this.worker.terminate();
    this.handlers.clear();
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────

let instance: WorkerPool | null = null;

/**
 * Returns the shared WorkerPool instance, creating it on first call.
 * Safe to call multiple times; the worker is only instantiated once.
 * Returns null during SSR (no `window` available).
 */
export function getWorkerPool(): WorkerPool | null {
  if (typeof window === "undefined") return null;
  if (!instance) instance = new WorkerPool();
  return instance;
}

/**
 * Tear down the shared WorkerPool. Call this when the app unmounts
 * (e.g. in a top-level useEffect cleanup).
 */
export function terminateWorkerPool(): void {
  instance?.terminate();
  instance = null;
}
