import { syntaxTree } from "@codemirror/language";
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

  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name !== "FencedCode") {
        return;
      }

      const contentStartLine = state.doc.lineAt(node.from);
      const startLineCandidates =
        contentStartLine.number > 1
          ? [contentStartLine, state.doc.line(contentStartLine.number - 1)]
          : [contentStartLine];
      const startLine = startLineCandidates.find((line) => isMermaidFence(line.text)) ?? null;
      if (!startLine) {
        return;
      }

      const startFence = parseFenceStart(startLine.text);
      if (!startFence) {
        return;
      }

      let endLine = state.doc.lineAt(node.to);
      if (
        !isFenceClose(endLine.text, startFence.marker, startFence.length) &&
        endLine.number > startLine.number
      ) {
        const previousLine = state.doc.line(endLine.number - 1);
        if (isFenceClose(previousLine.text, startFence.marker, startFence.length)) {
          endLine = previousLine;
        }
      }

      const replaceRange = { from: startLine.from, to: endLine.to };
      const rawJudgeRange = { from: node.from, to: node.to };
      const source = extractFenceSource(state, startLine.number, endLine.number);
      blocks.push({
        replaceRange,
        rawJudgeRange,
        openingLineFrom: startLine.from,
        source,
      });
    },
  });

  return blocks;
}
