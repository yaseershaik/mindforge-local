import { CreateMLCEngine, type MLCEngine, type InitProgressReport } from "@mlc-ai/web-llm";
import { searchVector } from "./vectorStore";
import { getEmbedWorkerPool } from "./embedWorkerPool";
import type { TextChunk, VectorSearchResult, DocumentMeta, EngineState } from "@/types";

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
    id: "SmolLM2-360M-Instruct-q4f16_1-MLC",
    name: "SmolLM2 360M (Ultra Fast / Mobile)",
    vramMB: 376,
    description: "Ultra-lightweight model optimized for low VRAM and mobile GPUs",
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
  
  if (engineInstance && state.selectedModelId !== targetModelId) {
    engineInstance = null;
  }
  
  state.selectedModelId = targetModelId;

  if (engineInstance && state.status === "ready") {
    return engineInstance;
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

    engineInstance = await CreateMLCEngine(targetModelId, {
      initProgressCallback,
    });

    state.status = "ready";
    state.progress = 100;
    state.progressText = "Model ready";
    notifyStateChange();

    return engineInstance;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    state.status = "error";
    state.errorMessage = message;
    state.progressText = "Failed to load model";
    notifyStateChange();
    throw err;
  }
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
    embedPool.enqueue(
      `embed-prompt-${Date.now()}`,
      "prompt",
      [tempChunk],
      (msg) => {
        if (msg.type === "embed-done" && msg.chunks[0]?.embedding) {
          resolve(msg.chunks[0].embedding);
        } else {
          resolve(null);
        }
      }
    );
  });
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
  onToken: (token: string, accumulated: string) => void
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

  // Strict anti-loop instruction set
  const systemMessage = `You are a concise document AI assistant.
Total uploaded files: ${documents.length}.

STRICT FORMATTING RULES:
1. Provide a clean summary in 3 to 4 sentences.
2. If asked for topics, list at most 5 main bullet points using hyphen (-) bullets.
3. DO NOT use numbered lists (1, 2, 3...) to prevent infinite counting loops.
4. DO NOT repeat the same topic or phrase twice.
5. Stop generating immediately after providing the bullet points.

DOCUMENT CONTEXT:
${cleanContext.slice(0, 5000)}`;

  const messages = [
    { role: "system" as const, content: systemMessage },
    { role: "user" as const, content: userPrompt },
  ];

  let accumulatedText = "";

  try {
    const completionStream = await engine.chat.completions.create({
      messages,
      stream: true,
      temperature: 0.0,
      presence_penalty: 1.2,  // Strong penalty against generating repeated token loops
      frequency_penalty: 1.2, // Strong penalty against repeating phrasing
      max_tokens: 900,        // Cap length to prevent infinite lists
    });

    for await (const chunk of completionStream) {
      if (currentAbortController?.signal.aborted) {
        break;
      }
      const delta = chunk.choices[0]?.delta?.content || "";
      if (delta) {
        accumulatedText += delta;
        
        // Post-processing guardrail: stop if model starts outputting repetitive list numbers > 6
        if (/([6-9]|10|11|12)\.\s/.test(accumulatedText)) {
          await stopGeneration();
          break;
        }
        
        onToken(delta, accumulatedText);
      }
    }
  } catch (err) {
    if ((err as Error)?.name !== "AbortError") {
      throw err;
    }
  } finally {
    state.isGenerating = false;
    currentAbortController = null;
    notifyStateChange();
  }

  return { text: accumulatedText, sources };
}