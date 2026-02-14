import assert from "node:assert/strict";
import test from "node:test";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { Decoration } from "@codemirror/view";
import { buildDecorations } from "../src/decorations";
import { resolveLivePreviewOptions } from "../src/options";
import type { LivePreviewPlugin } from "../src/plugins/types";

function createState(doc: string): EditorState {
  return EditorState.create({
    doc,
    extensions: [markdown()],
  });
}

function countDecorations(state: EditorState, plugin?: LivePreviewPlugin): number {
  const decorations = buildDecorations(
    state,
    resolveLivePreviewOptions({
      plugins: plugin ? [plugin] : [],
    })
  );
  let count = 0;
  decorations.between(0, state.doc.length, () => {
    count += 1;
  });
  return count;
}

test("applies decorations returned from plugins", () => {
  const state = createState("hello");
  const plugin: LivePreviewPlugin = {
    name: "test-plugin",
    decorate() {
      return [
        {
          from: 0,
          to: 5,
          decoration: Decoration.mark({ class: "cm-lp-plugin-test" }),
        },
      ];
    },
  };

  const withoutPlugin = countDecorations(state);
  const withPlugin = countDecorations(state, plugin);
  assert.equal(withPlugin, withoutPlugin + 1);
});

test("continues building decorations when plugin throws", () => {
  const state = createState("hello");
  let called = false;
  const plugin: LivePreviewPlugin = {
    name: "broken-plugin",
    decorate() {
      throw new Error("boom");
    },
  };

  const decorations = buildDecorations(
    state,
    resolveLivePreviewOptions({
      plugins: [plugin],
      onPluginError() {
        called = true;
      },
    })
  );

  assert.ok(called);
  let count = 0;
  decorations.between(0, state.doc.length, () => {
    count += 1;
  });
  assert.ok(count >= 0);
});
