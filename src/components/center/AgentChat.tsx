"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send,
  Bot,
  User,
  Cpu,
  Paperclip,
  Sparkles,
  FileText,
  CheckCircle2,
  Loader2,
  Download,
  Square,
  Zap,
  Trash2,
} from "lucide-react";
import type { ChatMessage, DocumentMeta, VectorSearchResult } from "@/types";
import {
  subscribeEngineState,
  loadModelEngine,
  streamRAGCompletion,
  stopGeneration,
  SUPPORTED_MODELS,
  type EngineState,
} from "@/lib/webLlmEngine";

interface ExtendedChatMessage extends ChatMessage {
  searchResults?: VectorSearchResult[];
}

interface AgentChatProps {
  documents: DocumentMeta[];
  initialPrompt?: string;
}

function MessageBubble({
  msg,
  onDelete,
}: {
  msg: ExtendedChatMessage;
  onDelete: (id: string) => void;
}) {
  const isUser = msg.role === "user";

  return (
    <div
      className={`group flex items-start gap-3 animate-fade-in-up ${
        isUser ? "flex-row-reverse" : "flex-row"
      }`}
    >
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{
          background: isUser
            ? "linear-gradient(135deg, #6366f1, #a855f7)"
            : "linear-gradient(135deg, #0ea5e9, #22d3ee)",
        }}
      >
        {isUser ? (
          <User className="w-3.5 h-3.5 text-white" />
        ) : (
          <Bot className="w-3.5 h-3.5 text-white" />
        )}
      </div>

      <div className="flex flex-col gap-2 max-w-[85%] relative">
        <div
          className="px-4 py-3 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap font-sans relative"
          style={
            isUser
              ? {
                  background:
                    "linear-gradient(135deg, rgba(99,102,241,0.25), rgba(168,85,247,0.15))",
                  border: "1px solid rgba(99,102,241,0.3)",
                  color: "#e2e8f0",
                  borderTopRightRadius: "4px",
                }
              : {
                  background: "rgba(14, 165, 233, 0.07)",
                  border: "1px solid rgba(14,165,233,0.15)",
                  color: "#cbd5e1",
                  borderTopLeftRadius: "4px",
                }
          }
        >
          {msg.content}
          
          {msg.isStreaming && (
            <span className="inline-flex items-center gap-1.5 text-cyan-400 font-mono text-[11px] ml-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping inline-block" />
              <span className="animate-pulse">Generating response...</span>
            </span>
          )}
        </div>

        {msg.id !== "welcome" && !msg.isStreaming && (
          <button
            onClick={() => onDelete(msg.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 text-[10px] flex items-center gap-1 self-end"
            title="Clear this message"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}

        {msg.searchResults && msg.searchResults.length > 0 && !msg.isStreaming && (
          <div
            className="rounded-xl p-2.5 space-y-1.5"
            style={{
              background: "rgba(99,102,241,0.04)",
              border: "1px solid rgba(99,102,241,0.12)",
            }}
          >
            <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-indigo-400">
              <Sparkles className="w-3 h-3" />
              Retrieved Context ({msg.searchResults.length})
            </div>
            <div className="space-y-1">
              {msg.searchResults.map((res) => (
                <div
                  key={res.chunk.id}
                  className="px-2 py-1 rounded bg-black/20 text-[10px] space-y-0.5 border border-white/5"
                >
                  <div className="flex items-center justify-between text-slate-400">
                    <span
                      className="flex items-center gap-1 font-mono truncate max-w-[200px]"
                      title={res.chunk.docName}
                    >
                      <FileText className="w-2.5 h-2.5 text-indigo-400 flex-shrink-0" />
                      {res.chunk.docName ? res.chunk.docName : "Document"} (Chunk #{res.chunk.index + 1})
                    </span>
                    <span className="font-mono text-cyan-400">
                      Score: {(res.score * 100).toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-slate-300 line-clamp-2 italic">
                    "{res.chunk.text}"
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const WELCOME_MESSAGE: ExtendedChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hello! Upload your documents (PDF, MD, TXT), load a WebGPU model, and ask any specific question about your data.",
  timestamp: Date.now(),
};

export default function AgentChat({ documents, initialPrompt }: AgentChatProps) {
  const [messages, setMessages] = useState<ExtendedChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [engineState, setEngineState] = useState<EngineState & { isGenerating?: boolean }>({
    status: "unloaded",
    selectedModelId: SUPPORTED_MODELS[0].id,
    progress: 0,
    progressText: "",
    errorMessage: null,
    isGenerating: false,
  });

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialPrompt) {
      setInput(initialPrompt);
    }
  }, [initialPrompt]);

  useEffect(() => {
    const unsubscribe = subscribeEngineState(setEngineState);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleLoadModel = (modelId?: string) => {
    loadModelEngine(modelId || engineState.selectedModelId).catch(() => {});
  };

  const handleStop = async () => {
    await stopGeneration();
  };

  const handleClearAllChat = () => {
    setMessages([WELCOME_MESSAGE]);
  };

  const handleDeleteMessage = (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText || input).trim();
    if (!text || engineState.isGenerating) return;

    const userMsg: ExtendedChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    const thinkingId = `${Date.now()}-response`;
    const thinkingMsg: ExtendedChatMessage = {
      id: thinkingId,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, thinkingMsg]);
    if (!overrideText) setInput("");

    if (engineState.status === "ready") {
      try {
        const { sources } = await streamRAGCompletion(
          text,
          documents,
          (_token, accumulated) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === thinkingId
                  ? {
                      ...m,
                      isStreaming: true,
                      content: accumulated,
                    }
                  : m
              )
            );
          }
        );

        setMessages((prev) =>
          prev.map((m) =>
            m.id === thinkingId
              ? {
                  ...m,
                  isStreaming: false,
                  searchResults: sources,
                }
              : m
          )
        );
      } catch (err) {
        const errMessage = err instanceof Error ? err.message : String(err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === thinkingId
              ? {
                  ...m,
                  isStreaming: false,
                  content: `[WebGPU Execution Error]: ${errMessage}`,
                }
              : m
          )
        );
      }
    } else {
      setTimeout(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === thinkingId
              ? {
                  ...m,
                  isStreaming: false,
                  content:
                    documents.length === 0
                      ? "Please upload a document in the left sidebar to start."
                      : "WebGPU LLM is not loaded. Click 'Load Model' in the control bar above.",
                }
              : m
          )
        );
      }, 300);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#030712]">
      <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0 cyber-panel border-b border-indigo-500/20">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-gradient-bold">
            WebGPU Engine
          </span>
        </div>

        <select
          value={engineState.selectedModelId}
          disabled={engineState.status === "loading" || engineState.isGenerating}
          onChange={(e) => {
            const newId = e.target.value;
            handleLoadModel(newId);
          }}
          className="bg-slate-900 border border-indigo-500/30 text-slate-200 text-xs rounded-lg px-2.5 py-1 outline-none cursor-pointer"
        >
          {SUPPORTED_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>

        {engineState.status === "ready" && (
          <span className="flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/30">
            <CheckCircle2 className="w-3 h-3" /> Ready
          </span>
        )}

        {engineState.status === "loading" && (
          <span className="flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full font-mono text-purple-300 bg-purple-500/10 border border-purple-500/30">
            <Loader2 className="w-3 h-3 animate-spin" /> Loading {engineState.progress}%
          </span>
        )}

        {engineState.status === "unloaded" && (
          <button
            onClick={() => handleLoadModel()}
            className="flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-medium text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/20 transition-all"
          >
            <Download className="w-3 h-3" /> Load Model
          </button>
        )}

        <button
          onClick={handleClearAllChat}
          className="ml-auto text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 px-2 py-1 rounded bg-slate-900 border border-white/10 hover:border-rose-500/30 transition-all"
          title="Clear all chat history"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            onDelete={handleDeleteMessage}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <div
        className="flex-shrink-0 px-4 py-3"
        style={{ borderTop: "1px solid rgba(99,102,241,0.08)" }}
      >
        <div
          className="flex items-end gap-2 rounded-xl px-3 py-2"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(99,102,241,0.15)",
          }}
        >
          <button
            className="flex-shrink-0 mb-1 p-1 rounded-lg hover:bg-white/5"
            title="Attach file"
          >
            <Paperclip className="w-4 h-4 text-slate-500" />
          </button>

          <textarea
            id="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask specific questions about your uploaded document..."
            rows={1}
            className="flex-1 bg-transparent resize-none outline-none text-[13px] placeholder:text-slate-600 leading-relaxed text-slate-200"
            style={{ maxHeight: "120px", overflowY: "auto" }}
          />

          {engineState.isGenerating ? (
            <button
              onClick={handleStop}
              className="flex-shrink-0 mb-0.5 px-3 py-1.5 rounded-lg flex items-center gap-1 text-[11px] font-semibold btn-cyber-stop text-white transition-all"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              Stop
            </button>
          ) : (
            <button
              id="chat-send-btn"
              onClick={() => sendMessage()}
              disabled={!input.trim()}
              className="flex-shrink-0 mb-0.5 w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150 disabled:opacity-30 btn-cyber-primary"
            >
              <Send className="w-3.5 h-3.5 text-white" />
            </button>
          )}
        </div>
        <p className="text-[9px] text-center mt-1.5 text-slate-600">
          Fast WebGPU Inference · Context Deduplicated · Anti-Loop Guard Active
        </p>
      </div>
    </div>
  );
}