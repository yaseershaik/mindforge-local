# MindForge Local 🧠

> **100% Client-Side, Air-Gapped Knowledge Graph & Agentic RAG Engine**
> Powered by WebGPU, WebAssembly, and Local Vector Storage. Zero Cloud Calls. $0 API Footprint.

---

## 🌟 Key Features
- **Zero-Cloud Air-Gapped Privacy:** Ingest, vectorize, and query sensitive documents (PDF, MD, TXT) entirely within your browser.
- **WebGPU Local Inference:** Runs quantized open-weights LLMs (SmolLM2 360M, Llama 3.2 1B, Qwen 2.5 1.5B, Llama 3.1 8B) directly on client hardware.
- **Off-Main-Thread Processing:** All PDF text parsing and 384-dimension vector embedding generation run inside background Web Workers to maintain a 60 FPS UI.
- **Interactive 3D Knowledge Mesh:** Renders spatial concept nodes and cross-document similarity links using Three.js / WebGL, with a responsive 2D fallback for mobile viewports.
- **Instant Stream Interrupt:** Built-in hardware cancellation handles allow users to terminate model token generation instantly.

---

## 🏗️ System Architecture

[ Local PDF / MD / TXT ] ──> [ WASM / Web Worker Pool ] ──> [ IndexedDB Vector Store ]
│
[ WebGPU Hardware VRAM ] ──> [ Quantized Local Model ] <────────────┴─> [ 3D/2D Canvas Mesh ]

---

## 🛠️ Tech Stack
- **Framework:** Next.js (App Router), TypeScript, Tailwind CSS
- **Local Compute:** WebLLM (`@mlc-ai/web-llm`), WebGPU
- **Embeddings:** Transformers.js (`Xenova/all-MiniLM-L6-v2`)
- **Vector Database:** Orama Indexing, IndexedDB Persistence
- **Parsing:** PDF.js offloaded to Web Workers
- **Graph Visualization:** Three.js / `react-force-graph-3d`

---

## 🚀 Local Development Setup

```bash
# Clone the repository
git clone [https://github.com/yaseershaik/mindforge-local.git](https://github.com/yaseershaik/mindforge-local.git)
cd mindforge-local

# Install dependencies
npm install

# Launch dev server
npm run dev
```
Open http://localhost:3000 in a WebGPU-supported browser (Chrome 113+ / Edge 113+).
