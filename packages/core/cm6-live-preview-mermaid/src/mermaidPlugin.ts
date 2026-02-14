import { syntaxTree } from "@codemirror/language";
import { Decoration } from "@codemirror/view";
import type {
  LivePreviewPlugin,
  LivePreviewPluginContext,
  Range,
} from "@yuya296/cm6-live-preview-core";
import { mermaidBlockReplace, mermaidBlockWidget } from "./mermaidWidget";

export type MermaidLivePreviewPluginOptions = {
  className?: string;
  errorClassName?: string;
};

type MermaidBlockInfo = {
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

function extractFenceSource(
  ctx: LivePreviewPluginContext,
  fromLineNumber: number,
  toLineNumber: number
): string {
  const lines: string[] = [];
  for (let lineNumber = fromLineNumber + 1; lineNumber < toLineNumber; lineNumber += 1) {
    lines.push(ctx.state.doc.line(lineNumber).text);
  }
  return lines.join("\n");
}

function collectMermaidBlocks(ctx: LivePreviewPluginContext): MermaidBlockInfo[] {
  const blocks: MermaidBlockInfo[] = [];

  syntaxTree(ctx.state).iterate({
    enter: (node) => {
      if (node.name !== "FencedCode") {
        return;
      }

      const contentStartLine = ctx.state.doc.lineAt(node.from);
      const startLineCandidates =
        contentStartLine.number > 1
          ? [contentStartLine, ctx.state.doc.line(contentStartLine.number - 1)]
          : [contentStartLine];
      const startLine =
        startLineCandidates.find((line) => isMermaidFence(line.text)) ?? null;
      if (!startLine) {
        return;
      }

      const startFence = parseFenceStart(startLine.text);
      if (!startFence) {
        return;
      }

      let endLine = ctx.state.doc.lineAt(node.to);
      if (
        !isFenceClose(endLine.text, startFence.marker, startFence.length) &&
        endLine.number > startLine.number
      ) {
        const previousLine = ctx.state.doc.line(endLine.number - 1);
        if (isFenceClose(previousLine.text, startFence.marker, startFence.length)) {
          endLine = previousLine;
        }
      }

      const replaceRange = { from: startLine.from, to: endLine.to };
      const rawJudgeRange = { from: node.from, to: node.to };
      const source = extractFenceSource(ctx, startLine.number, endLine.number);
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

export function mermaidLivePreviewPlugin(
  options: MermaidLivePreviewPluginOptions = {}
): LivePreviewPlugin {
  const className = options.className ?? "cm-lp-mermaid";
  const errorClassName = options.errorClassName ?? "cm-lp-mermaid-error";

  return {
    name: "mermaid-live-preview",
    decorate(ctx) {
      const blocks = collectMermaidBlocks(ctx);
      const decorations = [];

      for (const block of blocks) {
        const isRaw =
          ctx.isSelectionOverlap(block.rawJudgeRange) ||
          ctx.isBlockRevealOverlap(block.rawJudgeRange);
        if (isRaw) {
          decorations.push({
            from: block.replaceRange.to,
            to: block.replaceRange.to,
            decoration: mermaidBlockWidget(block.source, {
              className,
              errorClassName,
            }),
          });
          continue;
        }

        decorations.push({
          from: block.replaceRange.from,
          to: block.replaceRange.to,
          decoration: mermaidBlockReplace(block.source, {
            className,
            errorClassName,
          }),
        });
        decorations.push({
          from: block.openingLineFrom,
          to: block.openingLineFrom,
          decoration: Decoration.line({ class: "cm-lp-mermaid-fence-line-hidden" }),
        });
      }

      return decorations;
    },
  };
}
