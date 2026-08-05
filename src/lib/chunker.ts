/**
 * Recursive character text splitter.
 *
 * Splits text into overlapping chunks of approximately CHUNK_SIZE characters
 * (≈ 500 tokens at the 4 chars/token heuristic), with OVERLAP characters of
 * context carried over between consecutive chunks.
 *
 * Separator priority (highest → lowest semantic value):
 *   \n\n  (paragraph break)
 *   \n    (line break)
 *   .     (sentence end)
 *   " "   (word boundary)
 *   ""    (hard character cut — last resort)
 *
 * This file is intentionally free of any React / Next.js imports so it can be
 * safely imported inside a Web Worker context.
 */

import type { TextChunk } from "@/types";

// ── Configuration ─────────────────────────────────────────────────────────
export const CHUNK_SIZE = 2_000;   // characters ≈ 500 tokens
export const CHUNK_OVERLAP = 200;  // characters ≈ 50 tokens

const SEPARATORS = ["\n\n", "\n", ". ", " ", ""];

// ── Internal helpers ──────────────────────────────────────────────────────

/**
 * Find the best split point at or before `maxEnd` in `text` using the given
 * separator. Returns the split index (inclusive end of the first segment) or
 * -1 if not found.
 */
function findSplitPoint(
  text: string,
  start: number,
  maxEnd: number,
  separator: string
): number {
  if (separator === "") return maxEnd; // hard cut
  const searchEnd = Math.min(maxEnd, text.length);
  const sub = text.slice(start, searchEnd);
  const idx = sub.lastIndexOf(separator);
  if (idx === -1) return -1;
  return start + idx + separator.length; // exclusive end (next chunk starts here)
}

/**
 * Split a continuous text string into overlapping TextChunk records.
 */
export function chunkText(docId: string, text: string, docName?: string): TextChunk[] {
  if (!text || text.trim().length === 0) return [];

  const chunks: TextChunk[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const tentativeEnd = cursor + CHUNK_SIZE;

    // If the remaining text fits within one chunk, grab it all
    if (tentativeEnd >= text.length) {
      const raw = text.slice(cursor);
      if (raw.trim().length > 0) {
        chunks.push(makeChunk(docId, chunks.length, raw, cursor, text.length, docName));
      }
      break;
    }

    // Try each separator in priority order
    let splitAt = -1;
    for (const sep of SEPARATORS) {
      splitAt = findSplitPoint(text, cursor, tentativeEnd, sep);
      if (splitAt !== -1 && splitAt > cursor) break;
    }

    // Fallback to hard cut if nothing worked
    if (splitAt <= cursor) splitAt = tentativeEnd;

    const raw = text.slice(cursor, splitAt);
    if (raw.trim().length > 0) {
      chunks.push(makeChunk(docId, chunks.length, raw, cursor, splitAt, docName));
    }

    // Advance with overlap
    cursor = Math.max(splitAt - CHUNK_OVERLAP, cursor + 1);
  }

  return chunks;
}

function makeChunk(
  docId: string,
  index: number,
  text: string,
  startChar: number,
  endChar: number,
  docName?: string
): TextChunk {
  return {
    id: `${docId}-${index}`,
    docId,
    docName,
    index,
    text: text.trim(),
    startChar,
    endChar,
    tokenEstimate: Math.ceil(text.length / 4),
  };
}
