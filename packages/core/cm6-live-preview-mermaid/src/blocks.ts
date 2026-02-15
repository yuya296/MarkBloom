import type { EditorState } from "@codemirror/state";
import type { Range } from "@yuya296/cm6-live-preview-core";

export type MermaidBlockInfo = {
  replaceRange: Range;
  rawJudgeRange: Range;
  openingLineFrom: number;
  source: string;
};

function parseFenceStart(lineText: string): { marker: "`" | "~"; length: number; info: string } | null {
  const match = lineText.match(/^\s{0,3}([`~]{3,})\s*([^\s{`~]+)?/u);
  if (!match) {
    return null;
  }
  const token = match[1];
  if (!token) {
    return null;
  }
  const marker = token[0];
  if (marker !== "`" && marker !== "~") {
    return null;
  }
  return {
    marker,
    length: token.length,
    info: (match[2] ?? "").toLowerCase(),
  };
}

function isMermaidFence(lineText: string): boolean {
  const parsed = parseFenceStart(lineText);
  return parsed?.info === "mermaid";
}

function isFenceClose(lineText: string, marker: "`" | "~", minLength: number): boolean {
  const match = lineText.match(/^\s{0,3}([`~]{3,})\s*$/u);
  if (!match?.[1]) {
    return false;
  }
  const token = match[1];
  return token[0] === marker && token.length >= minLength;
}

function extractFenceSource(state: EditorState, fromLineNumber: number, toLineNumber: number): string {
  const lines: string[] = [];
  for (let lineNumber = fromLineNumber + 1; lineNumber < toLineNumber; lineNumber += 1) {
    lines.push(state.doc.line(lineNumber).text);
  }
  return lines.join("\n");
}

export function collectMermaidBlocksFromState(state: EditorState): MermaidBlockInfo[] {
  const blocks: MermaidBlockInfo[] = [];
  let lineNumber = 1;

  while (lineNumber <= state.doc.lines) {
    const startLine = state.doc.line(lineNumber);
    if (!isMermaidFence(startLine.text)) {
      lineNumber += 1;
      continue;
    }

    const startFence = parseFenceStart(startLine.text);
    if (!startFence) {
      lineNumber += 1;
      continue;
    }

    let endLine = startLine;
    let foundClose = false;
    for (let candidate = lineNumber + 1; candidate <= state.doc.lines; candidate += 1) {
      const line = state.doc.line(candidate);
      if (isFenceClose(line.text, startFence.marker, startFence.length)) {
        endLine = line;
        foundClose = true;
        break;
      }
    }
    if (!foundClose) {
      lineNumber += 1;
      continue;
    }

    const replaceRange = { from: startLine.from, to: endLine.to };
    const rawJudgeRange = { from: startLine.from, to: endLine.to };
    const source = extractFenceSource(state, startLine.number, endLine.number);
    blocks.push({
      replaceRange,
      rawJudgeRange,
      openingLineFrom: startLine.from,
      source,
    });

    lineNumber = endLine.number + 1;
  }

  return blocks;
}
