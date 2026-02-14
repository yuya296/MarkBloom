import assert from "node:assert/strict";
import test from "node:test";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import type { LivePreviewPluginContext, Range } from "@yuya296/cm6-live-preview-core";
import { mermaidLivePreviewPlugin } from "../src/mermaidPlugin";

function createState(doc: string): EditorState {
  return EditorState.create({
    doc,
    extensions: [markdown()],
  });
}

function createContext(
  doc: string,
  options: {
    isSelectionOverlap?: (range: Range) => boolean;
    isBlockRevealOverlap?: (range: Range) => boolean;
  } = {}
): LivePreviewPluginContext {
  return {
    state: createState(doc),
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
  assert.equal(decorations.length, 1);
  assert.ok(decorations[0].from < decorations[0].to);
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
