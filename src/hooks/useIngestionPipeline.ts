"use client";

import { useEffect, useRef, useCallback } from "react";
import { getWorkerPool, terminateWorkerPool } from "@/lib/workerPool";
import { getEmbedWorkerPool, terminateEmbedWorkerPool } from "@/lib/embedWorkerPool";
import { insertDocChunks, initVectorStore, savePersistedDocuments, loadPersistedDocuments, clearVectorStore } from "@/lib/vectorStore";
import type { DocumentMeta, FileItem, WorkerOutMessage, EmbedWorkerOutMessage } from "@/types";

type UpdateHandler = (id: string, patch: Partial<DocumentMeta>) => void;
type HydrateHandler = (docs: DocumentMeta[]) => void;

export function useIngestionPipeline(
  onUpdate: UpdateHandler,
  onHydrate?: HydrateHandler
) {
  const onUpdateRef = useRef<UpdateHandler>(onUpdate);
  const onHydrateRef = useRef<HydrateHandler | undefined>(onHydrate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
    onHydrateRef.current = onHydrate;
  });

  useEffect(() => {
    getWorkerPool();
    getEmbedWorkerPool();

    let isMounted = true;
    (async () => {
      await initVectorStore();
      const savedDocs = await loadPersistedDocuments();
      if (isMounted && savedDocs.length > 0 && onHydrateRef.current) {
        onHydrateRef.current(savedDocs);
      }
    })();

    return () => {
      isMounted = false;
      terminateWorkerPool();
      terminateEmbedWorkerPool();
    };
  }, []);

  const processFiles = useCallback((items: FileItem[]) => {
    const pool = getWorkerPool();
    const embedPool = getEmbedWorkerPool();
    if (!pool || !embedPool) return;

    items.forEach(({ meta, file }) => {
      file
        .arrayBuffer()
        .then((buffer) => {
          pool.enqueue(
            meta.id,
            buffer,
            meta.name,
            meta.type,
            (msg: WorkerOutMessage) => {
              const update = onUpdateRef.current;

              if (msg.type === "progress") {
                update(meta.id, {
                  status: msg.status,
                  progress: msg.progress,
                });
              } else if (msg.type === "done") {
                update(meta.id, {
                  status: "embedding",
                  progress: 0,
                  chunkCount: msg.chunks.length,
                  fullText: msg.fullText,
                });

                const embedJobId = `embed-${meta.id}`;
                embedPool.enqueue(
                  embedJobId,
                  meta.id,
                  msg.chunks,
                  (embedMsg: EmbedWorkerOutMessage) => {
                    if (embedMsg.type === "embed-progress") {
                      update(meta.id, {
                        status: "embedding",
                        progress: embedMsg.progress,
                      });
                    } else if (embedMsg.type === "embed-done") {
                      update(meta.id, {
                        status: "indexing",
                        progress: 95,
                      });

                      insertDocChunks(meta.id, embedMsg.chunks)
                        .then(() => {
                          update(meta.id, {
                            status: "done",
                            progress: 100,
                            chunks: embedMsg.chunks,
                            chunkCount: embedMsg.chunks.length,
                          });
                        })
                        .catch((err) => {
                          const message = err instanceof Error ? err.message : String(err);
                          update(meta.id, {
                            status: "error",
                            progress: 0,
                            errorMessage: `Vector indexing failed: ${message}`,
                          });
                        });
                    } else if (embedMsg.type === "embed-error") {
                      update(meta.id, {
                        status: "error",
                        progress: 0,
                        errorMessage: `Embedding failed: ${embedMsg.message}`,
                      });
                    }
                  }
                );
              } else if (msg.type === "error") {
                update(meta.id, {
                  status: "error",
                  progress: 0,
                  errorMessage: msg.message,
                });
              }
            }
          );
        })
        .catch((err) => {
          const message = err instanceof Error ? err.message : String(err);
          onUpdateRef.current(meta.id, { status: "error", errorMessage: message });
        });
    });
  }, []);

  const purgeAllStorage = useCallback(async () => {
    await clearVectorStore();
    await savePersistedDocuments([]);
  }, []);

  return { processFiles, purgeAllStorage };
}