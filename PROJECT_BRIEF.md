# MindForge Local — Project Brief

## High-Level Vision

MindForge Local is a **100% client-side, air-gapped knowledge graph and RAG search engine** running entirely in the user's browser. It ingests large documents (PDF, MD, TXT), processes embeddings locally using Transformers.js, runs an LLM on WebGPU via WebLLM, and displays an interactive 3D force-directed knowledge graph.

**Core Principle:** $0 API footprint — no server calls for embeddings or completion. All compute stays on-device.

---

## Strict Technical Constraints

| # | Constraint | Implementation |
|---|-----------|----------------|
| 1 | **No External Backend / Cloud APIs** | All inference, embedding, and retrieval runs in-browser |
| 2 | **WebGPU & WASM First** | WebLLM for LLM inference, Transformers.js for embeddings |
| 3 | **Thread Isolation** | PDF extraction + Vector DB ops run in Web Workers off main thread |
| 4 | **Storage** | In-browser vector store (Orama), persisted via IndexedDB / OPFS |
| 5 | **Tech Stack** | Next.js App Router, Tailwind CSS, Three.js, WebLLM, Transformers.js, PDF.js, Lucide |

---

## Tech Stack

```
Frontend Framework:  Next.js 14 (App Router, TypeScript)
Styling:             Tailwind CSS v4
3D Visualization:    Three.js + react-force-graph-3d
LLM Inference:       @mlc-ai/web-llm (WebGPU)
Embeddings:          @xenova/transformers (WASM / WebGPU)
Vector Store:        Orama (in-memory + OPFS persistence)
PDF Extraction:      pdfjs-dist (Web Worker)
Icons:               lucide-react
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (Single Tab)                                           │
│                                                                 │
│  ┌──────────────┐  ┌─────────────────────┐  ┌───────────────┐  │
│  │  Left Sidebar │  │    Center View      │  │ Right Sidebar │  │
│  │  250px        │  │    flex-1           │  │  300px        │  │
│  │               │  │                    │  │               │  │
│  │ • Drop Zone   │  │ Tab: 3D Mesh       │  │ • WebGPU info │  │
│  │ • Doc List    │  │   Three.js canvas  │  │ • VRAM meter  │  │
│  │ • Storage bar │  │                    │  │ • Heap usage  │  │
│  │               │  │ Tab: Agent Chat    │  │               │  │
│  └──────────────┘  │   RAG Interface    │  └───────────────┘  │
│                    └─────────────────────┘                      │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Web Workers (off main thread)                          │    │
│  │  • PDF Extraction Worker  (pdfjs-dist)                  │    │
│  │  • Embedding Worker       (@xenova/transformers)        │    │
│  │  • Vector DB Worker       (Orama + OPFS)                │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌────────────────────┐  ┌────────────────────────────────┐     │
│  │  WebLLM (WebGPU)   │  │  IndexedDB / OPFS Storage      │     │
│  │  LLM inference     │  │  Vector embeddings + metadata  │     │
│  └────────────────────┘  └────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phased Roadmap

### Phase 1 — Project Shell & Dashboard Layout ✅
- [x] Next.js 14 + Tailwind v4 project scaffolding
- [x] Dark-mode 3-column dashboard layout
- [x] Left sidebar: file drop zone, document list, storage indicator
- [x] Center view: 3D Knowledge Mesh tab (Three.js) + Agent Chat tab (stub)
- [x] Right sidebar: WebGPU diagnostics, VRAM meter, JS heap bars
- [x] All required packages installed

### Phase 2 — Document Ingestion Pipeline ✅
- [x] PDF.js extraction Web Worker (`src/workers/ingestion.worker.ts`)
- [x] Recursive character text splitter (`src/lib/chunker.ts`) — 500 tok / 50 tok overlap
- [x] WorkerPool singleton with jobId routing (`src/lib/workerPool.ts`)
- [x] `useIngestionPipeline` React hook (`src/hooks/useIngestionPipeline.ts`)
- [x] Animated per-document progress bar in DocumentList
### Phase 3 — Local Vector Store & Embeddings ✅
- [x] Transformers.js embedding Worker (`Xenova/all-MiniLM-L6-v2`) — 384-dim vectors
- [x] Orama vector store with IndexedDB persistence (`mindforge_vector_db`)
- [x] Multi-stage pipeline (extracting → chunking → embedding → indexing → done)
- [x] Live vector count & storage clear control in Left Sidebar

### Phase 4 — WebGPU Local LLM Inference ✅
- [x] WebLLM initialization with model selection UI (`Llama-3.2-1B`, `SmolLM2-360M`, `Qwen2.5-1.5B`)
- [x] Live model download progress bar & VRAM budget meter
- [x] WebGPU availability probe & fallback warning banner

### Phase 5 — Local Hybrid RAG Architecture ✅
- [x] Prompt local embedding computation via `embedWorkerPool`
- [x] IndexedDB vector store query for top-3 relevant context chunks
- [x] Augmented system prompt formatting with retrieved context
- [x] WebLLM real-time token streaming with document name & chunk citations
- [x] 100% offline air-gapped execution support

---

## Key Engineering Decisions

1. **COEP/COOP Headers**: Required for `SharedArrayBuffer` access (WebGPU compute). Set in `next.config.ts`.
2. **`transpilePackages`**: Three.js and react-force-graph-3d are ESM-only; transpiled by Next.js webpack.
3. **Dynamic imports with `ssr: false`**: Browser-only Three.js must not run during SSR.
4. **`--legacy-peer-deps`**: Orama has stale React peer dep; it doesn't actually use React at runtime.
5. **Tailwind v4**: CSS-based `@theme` config, no `tailwind.config.ts`. Dark mode via `@custom-variant dark`.
