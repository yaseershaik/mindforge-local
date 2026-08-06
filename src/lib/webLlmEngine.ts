import { CreateMLCEngine, type MLCEngine, type InitProgressReport } from "@mlc-ai/web-llm";
import { searchVector } from "./vectorStore";
import { getEmbedWorkerPool } from "./embedWorkerPool";
import type { TextChunk, VectorSearchResult, DocumentMeta, EngineState, ChatMessage } from "@/types";

export type { EngineState };

export interface ModelSpec {
  id: string;
  name: string;
  vramMB: number;
  description: string;
  isRecommended?: boolean;
}

export const SUPPORTED_MODELS: ModelSpec[] = [
  {
    id: "SmolLM2-360M-Instruct-q4f32_1-MLC",
    name: "SmolLM2 360M (Ultra Fast)",
    vramMB: 580,
    description: "Ultra-lightweight model for rapid response and low VRAM systems",
    isRecommended: true,
  },
  {
    id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    name: "Llama 3.2 1B (Fast / Balanced)",
    vramMB: 879,
    description: "Fast Meta model balancing speed and response precision",
  },
  {
    id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    name: "Qwen 2.5 1.5B (High Quality)",
    vramMB: 1630,
    description: "High capability small model for precise reasoning",
  },
  {
    id: "Llama-3.1-8B-Instruct-q4f16_1-MLC-1k",
    name: "Llama 3.1 8B (Deep Analysis)",
    vramMB: 4598,
    description: "Full precision 8B parameter model for heavy desktop compute",
  },
];

let engineInstance: MLCEngine | null = null;
let currentAbortController: AbortController | null = null;
let activeLoadPromise: Promise<MLCEngine> | null = null;
let activeLoadingModelId: string | null = null;

let state: EngineState = {
  status: "unloaded",
  selectedModelId: SUPPORTED_MODELS[0].id,
  progress: 0,
  progressText: "",
  errorMessage: null,
  isGenerating: false,
};

let listeners: Array<(s: EngineState) => void> = [];

function notifyStateChange() {
  listeners.forEach((l) => l({ ...state }));
}

export function subscribeEngineState(listener: (s: EngineState) => void): () => void {
  listeners.push(listener);
  listener({ ...state });
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function getEngineState(): EngineState {
  return { ...state };
}

export async function checkWebGPUSupport(): Promise<{ supported: boolean; message: string }> {
  if (typeof window === "undefined" || !navigator.gpu) {
    return {
      supported: false,
      message: "WebGPU is not supported in this browser environment. (Chrome 113+ / Edge 113+ required)",
    };
  }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return { supported: false, message: "No WebGPU hardware adapter found." };
    }
    return { supported: true, message: "WebGPU Active" };
  } catch (err) {
    return {
      supported: false,
      message: err instanceof Error ? err.message : "Failed to initialize WebGPU adapter.",
    };
  }
}

export async function loadModelEngine(modelId?: string): Promise<MLCEngine> {
  const targetModelId = modelId || state.selectedModelId;

  // 1. If engine is already ready with the requested model, return instance
  if (engineInstance && state.selectedModelId === targetModelId && state.status === "ready") {
    return engineInstance;
  }

  // 2. If a load for this exact model is currently in flight, return the active load promise
  if (activeLoadPromise && activeLoadingModelId === targetModelId) {
    return activeLoadPromise;
  }

  activeLoadingModelId = targetModelId;
  state.selectedModelId = targetModelId;

  activeLoadPromise = (async () => {
    // Unload stale engine if switching models or recovering
    if (engineInstance) {
      try {
        await engineInstance.unload();
      } catch {
        // Best-effort unload
      }
      engineInstance = null;
    }

    state.status = "loading";
    state.progress = 0;
    state.progressText = "Initializing WebGPU engine…";
    state.errorMessage = null;
    notifyStateChange();

    try {
      const initProgressCallback = (report: InitProgressReport) => {
        state.progress = Math.round(report.progress * 100);
        state.progressText = report.text || "Loading model weights…";
        notifyStateChange();
      };

      const newEngine = await CreateMLCEngine(targetModelId, {
        initProgressCallback,
      });

      engineInstance = newEngine;
      state.status = "ready";
      state.progress = 100;
      state.progressText = "Model ready";
      state.errorMessage = null;
      notifyStateChange();

      return newEngine;
    } catch (err) {
      engineInstance = null;
      const message = err instanceof Error ? err.message : String(err);
      state.status = "error";
      state.errorMessage = message;
      state.progressText = "Failed to load model";
      notifyStateChange();
      throw err;
    } finally {
      activeLoadPromise = null;
      activeLoadingModelId = null;
    }
  })();

  return activeLoadPromise;
}

export async function stopGeneration(): Promise<void> {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
  if (engineInstance) {
    await engineInstance.interruptGenerate();
  }
  state.isGenerating = false;
  notifyStateChange();
}

/** Self-harm Firewall */
function checkSafetyFirewall(promptText: string): string | null {
  const selfHarmPattern = /suicide|die|kill myself|end my life|want to die|harm myself|cutting myself/i;
  if (selfHarmPattern.test(promptText)) {
    return "🛡️ **Safety Firewall Notice**: If you are experiencing thoughts of self-harm or suicide, please know that support is available. You can reach out to compassionate professionals confidentially:\n\n- **India**: Call Tele-MANAS at **14416** or KIRAN at **1800-599-0019**\n- **US/International**: Call or text **988** (Suicide & Crisis Lifeline)\n\nPlease reach out to a trusted person or local helpline immediately.";
  }
  return null;
}

async function generatePromptEmbedding(promptText: string): Promise<number[] | null> {
  const embedPool = getEmbedWorkerPool();
  if (!embedPool) return null;

  const tempChunk: TextChunk = {
    id: "temp-prompt",
    docId: "prompt",
    index: 0,
    text: promptText,
    startChar: 0,
    endChar: promptText.length,
    tokenEstimate: Math.ceil(promptText.length / 4),
  };

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 1500); // 1.5s fast fallback timeout
    embedPool.enqueue(
      `embed-prompt-${Date.now()}`,
      "prompt",
      [tempChunk],
      (msg) => {
        clearTimeout(timer);
        if (msg.type === "embed-done" && msg.chunks[0]?.embedding) {
          resolve(msg.chunks[0].embedding);
        } else {
          resolve(null);
        }
      }
    );
  });
}

/** Anti-repetition loop detector for small LLMs */
function checkRepetitiveLoop(text: string): boolean {
  if (text.length < 30) return false;
  const lastChunk = text.slice(-150);
  const words = lastChunk.split(/\s+/).filter(Boolean);
  if (words.length >= 6) {
    const last3 = words.slice(-3).join(" ");
    const prev3 = words.slice(-6, -3).join(" ");
    const prevPrev3 = words.slice(-9, -6).join(" ");
    if (
      last3.length > 4 &&
      last3.toLowerCase() === prev3.toLowerCase() &&
      prev3.toLowerCase() === prevPrev3.toLowerCase()
    ) {
      return true;
    }
  }
  return false;
}

/** Clean up trailing orphan list numbers and ensure clean sentence endings */
export function sanitizeCleanEnding(rawText: string): string {
  let text = rawText.trimEnd();

  // 1. Remove hanging orphan list numbers at the very end like "6.", "6. ", "7.", "\n6.", "\n6. "
  text = text.replace(/(?:\r?\n|^)\s*\d+\.\s*$/, "");

  // 2. If the text ends mid-sentence without terminal punctuation (. ! ?), trim back to last completed sentence
  const trimmed = text.trim();
  if (trimmed.length > 50 && !/[.!?]$/.test(trimmed)) {
    const lastPeriodIndex = Math.max(
      trimmed.lastIndexOf("."),
      trimmed.lastIndexOf("!"),
      trimmed.lastIndexOf("?")
    );
    if (lastPeriodIndex > trimmed.length - 180) {
      text = trimmed.substring(0, lastPeriodIndex + 1);
    }
  }

  // Remove any trailing orphan list numbers again after trimming
  return text.trim().replace(/(?:\r?\n|^)\s*\d+\.\s*$/, "");
}

/** Clean context by removing duplicate sentences and repetitive header noise */
function deduplicateContextText(rawText: string): string {
  const lines = rawText.split("\n");
  const uniqueLines: string[] = [];
  const lineSet = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      uniqueLines.push("");
      continue;
    }
    // Prevent line repetitions
    if (!lineSet.has(trimmed)) {
      lineSet.add(trimmed);
      uniqueLines.push(trimmed);
    }
  }

  return uniqueLines.join("\n");
}

export async function streamRAGCompletion(
  userPrompt: string,
  documents: DocumentMeta[],
  onToken: (token: string, accumulated: string) => void,
  chatHistory?: ChatMessage[]
): Promise<{ text: string; sources: VectorSearchResult[] }> {
  const safetyRefusal = checkSafetyFirewall(userPrompt);
  if (safetyRefusal) {
    onToken(safetyRefusal, safetyRefusal);
    return { text: safetyRefusal, sources: [] };
  }

  if (!documents || documents.length === 0) {
    const refusalText = "⛔ Please upload a document (PDF, MD, TXT) to begin local analysis.";
    onToken(refusalText, refusalText);
    return { text: refusalText, sources: [] };
  }

  const engine = await loadModelEngine();
  state.isGenerating = true;
  notifyStateChange();

  await engine.resetChat();
  currentAbortController = new AbortController();

  let sources: VectorSearchResult[] = [];
  let contextText = "";

  const isFullDocQuery = /summary|summarize|overview|all topics|topics|list|what are this documents|uploaded/i.test(userPrompt);

  if (isFullDocQuery) {
    contextText = documents
      .map((d, idx) => {
        const docContent = d.fullText || d.chunks?.map((c) => c.text).join("\n") || "";
        return `[DOCUMENT #${idx + 1} - "${d.name}"]:\n${docContent.slice(0, 4000)}`;
      })
      .join("\n\n");
  } else {
    try {
      const queryVector = await generatePromptEmbedding(userPrompt);
      if (queryVector) {
        sources = await searchVector(queryVector, 3);
      }
    } catch (err) {
      console.warn("[WebLLMEngine] Vector search fallback triggered:", err);
    }

    if (sources.length > 0) {
      const groupedByDoc = new Map<string, string[]>();
      sources.forEach((s) => {
        const name = s.chunk.docName || "Uploaded Document";
        if (!groupedByDoc.has(name)) groupedByDoc.set(name, []);
        groupedByDoc.get(name)!.push(s.chunk.text);
      });

      contextText = Array.from(groupedByDoc.entries())
        .map(([name, chunks], idx) => `[DOCUMENT #${idx + 1} - "${name}"]:\n${chunks.join("\n---\n")}`)
        .join("\n\n");
    }
  }

  if (!contextText.trim()) {
    contextText = documents
      .map((d, idx) => `[DOCUMENT #${idx + 1} - "${d.name}"]:\n${(d.fullText || "").slice(0, 3000)}`)
      .join("\n\n");
  }

  const cleanContext = deduplicateContextText(contextText);

  // Clean & elegant instruction set
  const systemMessage = `You are MindForge AI, a clean, professional, and precise document analysis assistant.
Total uploaded files: ${documents.length}.

RULES FOR CLEAN & ELEGANT RESPONSES:
1. Provide a direct, well-formatted answer based strictly on the DOCUMENT CONTEXT.
2. Use clean bullet points and clear paragraphs.
3. NEVER repeat the same phrase, heading, or line multiple times.
4. Stop generating cleanly once the answer is complete.

DOCUMENT CONTEXT:
${cleanContext.slice(0, 3500)}`;

  const historyMessages = (chatHistory || [])
    .filter(
      (m) =>
        m.id !== "welcome" &&
        m.content &&
        m.content.trim().length > 0 &&
        !m.isStreaming
    )
    .slice(-4)
    .map((m) => ({
      role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
      content: m.content.slice(0, 450),
    }));

  const messages = [
    { role: "system" as const, content: systemMessage },
    ...historyMessages,
    { role: "user" as const, content: userPrompt },
  ];

  let accumulatedText = "";
  const localAbortController = currentAbortController;

  if (localAbortController?.signal.aborted) {
    return { text: "🛑 Generation stopped.", sources };
  }

  try {
    const completionStream = await engine.chat.completions.create({
      messages,
      stream: true,
      temperature: 0.3,
      presence_penalty: 0.5,
      frequency_penalty: 0.8,
      max_tokens: 600,
    });

    for await (const chunk of completionStream) {
      if (localAbortController.signal.aborted) {
        break;
      }
      const delta = chunk.choices[0]?.delta?.content || "";
      if (delta) {
        accumulatedText += delta;
        
        // Anti-repetition guardrail: stop immediately if phrase loop is detected
        if (checkRepetitiveLoop(accumulatedText)) {
          await stopGeneration();
          break;
        }
        
        onToken(delta, accumulatedText);
      }
    }
  } catch (err) {
    const errStr = String(err);
    if (errStr.includes("disposed") || errStr.includes("Model not loaded")) {
      console.warn("[WebLLM] Detected disposed engine instance. Auto-recovering...", err);
      engineInstance = null;
      state.status = "unloaded";
      notifyStateChange();

      // Auto-recover: reload fresh engine and retry chat completion once
      const freshEngine = await loadModelEngine(state.selectedModelId);
      await freshEngine.resetChat();

      const retryStream = await freshEngine.chat.completions.create({
        messages,
        stream: true,
        temperature: 0.3,
        presence_penalty: 0.5,
        frequency_penalty: 0.8,
        max_tokens: 600,
      });

      for await (const chunk of retryStream) {
        if (localAbortController.signal.aborted) break;
        const delta = chunk.choices[0]?.delta?.content || "";
        if (delta) {
          accumulatedText += delta;
          onToken(delta, accumulatedText);
        }
      }
    } else if ((err as Error)?.name !== "AbortError") {
      throw err;
    }
  } finally {
    state.isGenerating = false;
    currentAbortController = null;
    notifyStateChange();
  }

  const cleanedText = sanitizeCleanEnding(accumulatedText);
  return { text: cleanedText, sources };
}