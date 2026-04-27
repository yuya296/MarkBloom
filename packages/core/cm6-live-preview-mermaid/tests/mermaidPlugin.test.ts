import assert from "node:assert/strict";
import test from "node:test";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import type { LivePreviewPluginContext, Range } from "@yuya296/cm6-live-preview-core";
import { mermaidLivePreviewPlugin } from "../src/mermaidPlugin";

function createState(doc: string, cursorPos = 0): EditorState {
  return EditorState.create({
    doc,
    extensions: [markdown()],
    selection: { anchor: cursorPos },
  });
}

function createContext(
  doc: string,
  options: {
    isSelectionOverlap?: (range: Range) => boolean;
    isBlockRevealOverlap?: (range: Range) => boolean;
    cursorPos?: number;
  } = {}
): LivePreviewPluginContext {
  return {
    state: createState(doc, options.cursorPos),
    selectionRanges: [],
    blockRevealRange: null,
    isSelectionOverlap: options.isSelectionOverlap ?? (() => false),
    isBlockRevealOverlap: options.isBlockRevealOverlap ?? (() => false),
  };
}

test("creates replace decoration for mermaid fenced code in rich mode", () => {
  const plugin = mermaidLivePreviewPlugin();
  const ctx = createContext(["```mermaid", "graph TD", "A-->B", "```"].join("\n"));
  const decorations = plugin.decorate(ctx);
  assert.equal(decorations.length, 2);
  assert.ok(decorations.some((decoration) => decoration.from < decoration.to));
  assert.ok(decorations.some((decoration) => decoration.from === decoration.to));
});

test("creates appended widget for raw mode when selection overlaps block", () => {
  const plugin = mermaidLivePreviewPlugin();
  const ctx = createContext(["```mermaid", "graph TD", "A-->B", "```"].join("\n"), {
    isSelectionOverlap: () => true,
  });
  const decorations = plugin.decorate(ctx);
  assert.equal(decorations.length, 1);
  assert.equal(decorations[0].from, decorations[0].to);
});

test("ignores non-mermaid fenced code blocks", () => {
  const plugin = mermaidLivePreviewPlugin();
  const ctx = createContext(["```ts", "const a = 1", "```"].join("\n"));
  const decorations = plugin.decorate(ctx);
  assert.equal(decorations.length, 0);
});

test("creates appended widget when cursor enters block from below", () => {
  const plugin = mermaidLivePreviewPlugin();
  const doc = ["```mermaid", "graph TD", "A-->B", "```", "after"].join("\n");
  const closingFenceEnd = doc.lastIndexOf("```") + 3;
  const ctx = createContext(doc, { cursorPos: closingFenceEnd + 1 });
  const decorations = plugin.decorate(ctx);
  assert.equal(decorations.length, 1);
  assert.equal(decorations[0].from, decorations[0].to);
});

test("does not switch to raw mode when cursor is at closing fence end", () => {
  const plugin = mermaidLivePreviewPlugin();
  const doc = ["```mermaid", "graph TD", "A-->B", "```", "after"].join("\n");
  const closingFenceEnd = doc.lastIndexOf("```") + 3;
  const ctx = createContext(doc, { cursorPos: closingFenceEnd });
  const decorations = plugin.decorate(ctx);
  assert.equal(decorations.length, 2);
  assert.ok(decorations.some((decoration) => decoration.from < decoration.to));
});

test("switches to raw mode when caret sits on the opening fence text", () => {
  const plugin = mermaidLivePreviewPlugin();
  const doc = ["```mermaid", "graph TD", "A-->B", "```", "after"].join("\n");
  // caret 5 chars into "```mermaid" (between "`" and "mermaid")
  const ctx = createContext(doc, { cursorPos: 5 });
  const decorations = plugin.decorate(ctx);
  assert.equal(decorations.length, 1);
  assert.equal(decorations[0].from, decorations[0].to);
});

test("switches to raw mode when caret is on a body line inside the block", () => {
  const plugin = mermaidLivePreviewPlugin();
  const doc = ["```mermaid", "graph TD", "A-->B", "```", "after"].join("\n");
  // caret on "graph TD" line
  const cursorPos = doc.indexOf("graph TD") + 3;
  const ctx = createContext(doc, { cursorPos });
  const decorations = plugin.decorate(ctx);
  assert.equal(decorations.length, 1);
  assert.equal(decorations[0].from, decorations[0].to);
});

test("does not switch to raw mode when caret is exactly at block start (before opening fence)", () => {
  const plugin = mermaidLivePreviewPlugin();
  const doc = ["before", "```mermaid", "graph TD", "A-->B", "```", "after"].join("\n");
  // caret at the position right before the opening fence (block.from)
  const cursorPos = doc.indexOf("```mermaid");
  const ctx = createContext(doc, { cursorPos });
  const decorations = plugin.decorate(ctx);
  // rich (replace + line mask)
  assert.equal(decorations.length, 2);
  assert.ok(decorations.some((decoration) => decoration.from < decoration.to));
});
