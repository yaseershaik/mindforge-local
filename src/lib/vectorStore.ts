/**
 * vectorStore.ts
 *
 * In-browser vector database powered by @orama/orama.
 * Persists vector embeddings and document metadata to IndexedDB for air-gapped offline storage.
 */

import { create, insertMultiple, search, count, save, load, removeMultiple, type AnyOrama } from "@orama/orama";
import type { TextChunk, DocumentMeta, VectorSearchResult } from "@/types";

const DB_NAME = "mindforge_vector_db";
const DB_VERSION = 1;
const STORE_ORAMA = "orama_snapshot";
const STORE_DOCS = "documents_meta";

let dbInstance: AnyOrama | null = null;
let listeners: Array<() => void> = [];

// ── IndexedDB Helpers ──────────────────────────────────────────────────────

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB is not available in this environment"));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_ORAMA)) {
        db.createObjectStore(STORE_ORAMA);
      }
      if (!db.objectStoreNames.contains(STORE_DOCS)) {
        db.createObjectStore(STORE_DOCS, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet<T>(storeName: string, key: string): Promise<T | null> {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function idbSet<T>(storeName: string, key: string, value: T): Promise<void> {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("[VectorStore] Failed to write to IndexedDB:", err);
  }
}

async function idbSaveDocs(docs: DocumentMeta[]): Promise<void> {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_DOCS, "readwrite");
      const store = tx.objectStore(STORE_DOCS);
      store.clear();
      docs.forEach((doc) => store.put(doc));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("[VectorStore] Failed to save documents to IndexedDB:", err);
  }
}

async function idbLoadDocs(): Promise<DocumentMeta[]> {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_DOCS, "readonly");
      const store = tx.objectStore(STORE_DOCS);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as DocumentMeta[]) ?? []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

async function idbClear(): Promise<void> {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_ORAMA, STORE_DOCS], "readwrite");
      tx.objectStore(STORE_ORAMA).clear();
      tx.objectStore(STORE_DOCS).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("[VectorStore] Failed to clear IndexedDB:", err);
  }
}

// ── Vector DB Factory ──────────────────────────────────────────────────────

async function createOramaSchema(): Promise<AnyOrama> {
  return await create({
    schema: {
      id: "string",
      docId: "string",
      docName: "string",
      index: "number",
      text: "string",
      startChar: "number",
      endChar: "number",
      tokenEstimate: "number",
      embedding: "vector[384]",
    },
  });
}

function notifyStoreChanged() {
  listeners.forEach((fn) => fn());
}

// ── Public API ─────────────────────────────────────────────────────────────

export function subscribeVectorStore(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

/**
 * Initialize vector database and restore saved snapshot from IndexedDB.
 */
export async function initVectorStore(): Promise<AnyOrama> {
  if (dbInstance) return dbInstance;

  dbInstance = await createOramaSchema();

  const savedSnapshot = await idbGet<unknown>(STORE_ORAMA, "snapshot");
  if (savedSnapshot) {
    try {
      await load(dbInstance, savedSnapshot as Parameters<typeof load>[1]);
      console.log(`[VectorStore] Restored index from IndexedDB. Vectors: ${await count(dbInstance)}`);
    } catch (err) {
      console.warn("[VectorStore] Could not restore snapshot, starting fresh:", err);
    }
  }

  notifyStoreChanged();
  return dbInstance;
}

/**
 * Insert document text chunks with their 384-dim embeddings into Orama index and persist snapshot.
 */
export async function insertDocChunks(docId: string, chunks: TextChunk[]): Promise<number> {
  const db = await initVectorStore();
  const validChunks = chunks.filter((c) => Array.isArray(c.embedding) && c.embedding.length === 384);

  if (validChunks.length === 0) return 0;

  const docsToInsert = validChunks.map((c) => ({
    id: c.id,
    docId: c.docId,
    docName: c.docName || "",
    index: c.index,
    text: c.text,
    startChar: c.startChar,
    endChar: c.endChar,
    tokenEstimate: c.tokenEstimate,
    embedding: c.embedding!,
  }));

  await insertMultiple(db, docsToInsert);

  // Persist updated snapshot
  const snapshot = await save(db);
  await idbSet(STORE_ORAMA, "snapshot", snapshot);

  notifyStoreChanged();
  return validChunks.length;
}

/**
 * Remove all chunks associated with a document from the vector store.
 */
export async function removeDocChunks(docId: string): Promise<void> {
  const db = await initVectorStore();
  const searchRes = await search(db, {
    where: { docId },
    limit: 10000,
  });

  const idsToRemove = searchRes.hits.map((h) => h.id);
  if (idsToRemove.length > 0) {
    await removeMultiple(db, idsToRemove);
    const snapshot = await save(db);
    await idbSet(STORE_ORAMA, "snapshot", snapshot);
  }

  notifyStoreChanged();
}

/**
 * Clear the entire vector database and IndexedDB store.
 */
export async function clearVectorStore(): Promise<void> {
  await idbClear();
  dbInstance = await createOramaSchema();
  notifyStoreChanged();
}

/**
 * Get total number of vector chunks indexed in Orama.
 */
export async function getVectorCount(): Promise<number> {
  if (!dbInstance) {
    if (typeof window === "undefined") return 0;
    dbInstance = await initVectorStore();
  }
  return await count(dbInstance);
}

/**
 * Search vector database using vector similarity (cosine similarity).
 */
export async function searchVector(
  queryEmbedding: number[],
  topK = 5
): Promise<VectorSearchResult[]> {
  const db = await initVectorStore();

  const results = await search(db, {
    mode: "vector",
    vector: {
      property: "embedding",
      value: queryEmbedding,
    },
    similarity: 0.3,
    limit: topK,
  });

  return results.hits.map((hit) => {
    const document = hit.document as unknown as TextChunk;
    return {
      chunk: {
        id: document.id,
        docId: document.docId,
        docName: document.docName || "",
        index: document.index,
        text: document.text,
        startChar: document.startChar,
        endChar: document.endChar,
        tokenEstimate: document.tokenEstimate,
      },
      score: hit.score,
    };
  });
}

/**
 * Persist document metadata list to IndexedDB.
 */
export async function savePersistedDocuments(docs: DocumentMeta[]): Promise<void> {
  await idbSaveDocs(docs);
}

/**
 * Load persisted document metadata list from IndexedDB.
 */
export async function loadPersistedDocuments(): Promise<DocumentMeta[]> {
  return await idbLoadDocs();
}
