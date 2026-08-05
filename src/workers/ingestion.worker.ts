import * as pdfjsLib from "pdfjs-dist";
import { chunkText } from "@/lib/chunker";
import type {
  WorkerIngestMessage,
  WorkerOutMessage,
  TextChunk,
  IngestionStatus,
} from "@/types";

pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

function post(msg: WorkerOutMessage) {
  (self as unknown as Worker).postMessage(msg);
}

function progress(
  jobId: string,
  status: IngestionStatus,
  pct: number,
  message: string
) {
  post({ type: "progress", jobId, status, progress: pct, message });
}

interface TextItemWithPos {
  str: string;
  x: number;
  y: number;
}

async function extractPdfText(
  jobId: string,
  buffer: ArrayBuffer
): Promise<{ text: string; pageCount: number }> {
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pageCount = doc.numPages;
  const pages: string[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();

    const items: TextItemWithPos[] = content.items.map((item: any) => ({
      str: "str" in item ? item.str : "",
      x: item.transform ? item.transform[4] : 0,
      y: item.transform ? item.transform[5] : 0,
    }));

    items.sort((a, b) => {
      if (Math.abs(a.y - b.y) < 4) {
        return a.x - b.x;
      }
      return b.y - a.y;
    });

    let pageStr = "";
    let lastY: number | null = null;

    for (const item of items) {
      if (!item.str.trim() && item.str !== " ") continue;

      if (lastY !== null && Math.abs(item.y - lastY) >= 4) {
        pageStr += "\n";
      } else if (lastY !== null) {
        pageStr += " ";
      }
      pageStr += item.str;
      lastY = item.y;
    }

    pages.push(`--- PAGE ${i} ---\n` + pageStr);
    const pct = Math.round((i / pageCount) * 60);
    progress(jobId, "extracting", pct, `Extracted Page ${i} / ${pageCount}`);
  }

  return { text: pages.join("\n\n"), pageCount };
}

function extractPlainText(buffer: ArrayBuffer): string {
  return new TextDecoder("utf-8").decode(buffer);
}

async function handleIngest(msg: WorkerIngestMessage) {
  const { jobId, buffer, fileType, fileName } = msg;

  try {
    progress(jobId, "extracting", 0, "Starting extraction…");

    let rawText = "";
    let pageCount: number | undefined;

    if (fileType === "pdf") {
      const result = await extractPdfText(jobId, buffer);
      rawText = result.text;
      pageCount = result.pageCount;
    } else {
      rawText = extractPlainText(buffer);
      progress(jobId, "extracting", 60, "Text decoded");
    }

    progress(jobId, "chunking", 65, "Splitting into chunks…");

    const chunks: TextChunk[] = chunkText(jobId, rawText, fileName);

    post({ type: "done", jobId, chunks, fullText: rawText, pageCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    post({ type: "error", jobId, message });
  }
}

self.addEventListener("message", (event: MessageEvent<WorkerIngestMessage>) => {
  if (event.data?.type === "ingest") {
    handleIngest(event.data);
  }
});