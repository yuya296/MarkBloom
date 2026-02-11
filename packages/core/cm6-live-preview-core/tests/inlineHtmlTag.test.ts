import assert from "node:assert/strict";
import test from "node:test";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { collectInlineMarkerRanges } from "../src/inline/inlineMarkerRanges";

function createState(doc: string, cursor?: number): EditorState {
  return EditorState.create({
    doc,
    selection:
      typeof cursor === "number" ? { anchor: cursor } : undefined,
    extensions: [markdown()],
  });
}

function hiddenLiterals(state: EditorState): string[] {
  const { hidden } = collectInlineMarkerRanges(
    state,
    {},
    { block: [], inline: [] }
  );
  return hidden.map((range) => state.doc.sliceString(range.from, range.to));
}

test("hides inline HTML tags in rich mode", () => {
  const state = createState("text <span>hi</span> end");
  const literals = hiddenLiterals(state);
  assert.deepEqual(literals, ["<span>", "</span>"]);
});

test("keeps nearby HTML tag raw while hiding non-nearby tags", () => {
  const state = createState("text <span>hi</span> end", 6);
  const literals = hiddenLiterals(state);
  assert.deepEqual(literals, []);
});

test("keeps opening and closing tags raw when cursor is inside tag content", () => {
  const state = createState("text <span>hello</span> end", 12);
  const literals = hiddenLiterals(state);
  assert.deepEqual(literals, []);
});

test("does not hide HTML blocks", () => {
  const state = createState(["<div>", "text", "</div>"].join("\n"));
  const literals = hiddenLiterals(state);
  assert.deepEqual(literals, []);
});
