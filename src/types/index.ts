/** Shared TypeScript interfaces for MindForge Local */

export type DocumentType = "pdf" | "md" | "txt";

export type IngestionStatus =
  | "idle"
  | "extracting"
  | "chunking"
  | "embedding"
  | "indexing"
  | "done"
  | "error";

export interface TextChunk {
  id: string;
  docId: string;
  docName?: string;
  index: number;
  text: string;
  startChar: number;
  endChar: number;
  tokenEstimate: number;
  embedding?: number[];
}

export interface DocumentMeta {
  id: string;
  name: string;
  type: DocumentType;
  sizeBytes: number;
  addedAt: number;
  status: IngestionStatus;
  progress?: number;
  chunkCount?: number;
  chunks?: TextChunk[];
  fullText?: string;
  errorMessage?: string;
}

export interface WorkerIngestMessage {
  type: "ingest";
  jobId: string;
  buffer: ArrayBuffer;
  fileName: string;
  fileType: DocumentType;
}

export interface WorkerOutMessage {
  type: "progress" | "done" | "error";
  jobId: string;
  status?: IngestionStatus;
  progress?: number;
  message?: string;
  chunks?: TextChunk[];
  fullText?: string;
  pageCount?: number;
}

export interface EmbedWorkerTask {
  type: "embed";
  jobId: string;
  docId: string;
  chunks: TextChunk[];
}

export interface EmbedWorkerProgress {
  type: "embed-progress";
  jobId: string;
  docId: string;
  progress: number;
  current: number;
  total: number;
  message: string;
}

export interface EmbedWorkerDone {
  type: "embed-done";
  jobId: string;
  docId: string;
  chunks: TextChunk[];
}

export interface EmbedWorkerError {
  type: "embed-error";
  jobId: string;
  docId: string;
  message: string;
}

export type EmbedWorkerOutMessage =
  | EmbedWorkerProgress
  | EmbedWorkerDone
  | EmbedWorkerError;

export interface FileItem {
  meta: DocumentMeta;
  file: File;
}

export interface VectorSearchResult {
  chunk: TextChunk;
  score: number;
}

export type WebGPUStatus = "checking" | "supported" | "unsupported" | "error";

export interface GPUAdapterInfo {
  vendor: string;
  architecture: string;
  device: string;
  description: string;
}

export interface HardwareInfo {
  webgpuStatus: WebGPUStatus;
  adapterInfo?: GPUAdapterInfo;
  estimatedVRAMMB?: number;
  usedJSHeapMB?: number;
  totalJSHeapMB?: number;
  jsHeapLimitMB?: number;
  backend?: string;
}

export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  sources?: VectorSearchResult[];
  isStreaming?: boolean;
}

export interface EngineState {
  status: "unloaded" | "loading" | "ready" | "error";
  selectedModelId: string;
  progress: number;
  progressText: string;
  errorMessage: string | null;
  isGenerating?: boolean;
}