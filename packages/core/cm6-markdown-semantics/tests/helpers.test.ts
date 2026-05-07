import assert from "node:assert/strict";
import test from "node:test";
import { Text } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";
import {
  extractLinkHrefFromText,
  findHeadingLineForId,
  getBlockquoteLevel,
  getListLevel,
  getTaskStateClassFromText,
  slugifyHeading,
  stripHeadingMarkers,
} from "../src/index";

type MockNode = {
  name: string;
  parent: MockNode | null;
};

function createNode(name: string, parentNames: readonly string[] = []): SyntaxNode {
  let parent: MockNode | null = null;
  for (let index = parentNames.length - 1; index >= 0; index -= 1) {
    parent = {
      name: parentNames[index] ?? "",
      parent,
    };
  }
  return {
    name,
    parent,
  } as unknown as SyntaxNode;
}

test("slugifies headings consistently for punctuation and multilingual text", () => {
  assert.equal(slugifyHeading("  Hello, 世界!  "), "hello-世界");
  assert.equal(slugifyHeading("Repeat  --  Repeat"), "repeat-repeat");
  assert.equal(slugifyHeading(""), "");
});

test("strips ATX markers and trailing hashes from heading text", () => {
  assert.equal(stripHeadingMarkers("### Section Title ###"), "Section Title");
  assert.equal(stripHeadingMarkers("## spaced title   "), "spaced title");
});

test("extracts hrefs from autolinks and markdown links", () => {
  assert.equal(extractLinkHrefFromText("<https://example.com/docs>"), "https://example.com/docs");
  assert.equal(extractLinkHrefFromText("[docs]( /guide/start )"), "/guide/start");
  assert.equal(extractLinkHrefFromText("plain text"), null);
});

test("derives task classes from raw task prefixes", () => {
  assert.equal(getTaskStateClassFromText("[ ] open", "mb-"), "mb-task-unchecked");
  assert.equal(getTaskStateClassFromText("[x] done", "mb-"), "mb-task-checked");
  assert.equal(getTaskStateClassFromText("[X] done", "mb-"), "mb-task-checked");
  assert.equal(getTaskStateClassFromText("not a task", "mb-"), null);
});

test("counts list nesting from ancestor lists", () => {
  assert.equal(getListLevel(createNode("ListItem", ["BulletList"])), 1);
  assert.equal(getListLevel(createNode("ListItem", ["BulletList", "OrderedList"])), 2);
  assert.equal(getListLevel(null), 0);
});

test("counts blockquote nesting from current node and ancestors", () => {
  assert.equal(getBlockquoteLevel(createNode("Blockquote")), 1);
  assert.equal(getBlockquoteLevel(createNode("Blockquote", ["Blockquote", "Blockquote"])), 3);
  assert.equal(getBlockquoteLevel(null), 0);
});

test("findHeadingLineForId locates ATX heading by slug", () => {
  const doc = Text.of([
    "# Hello World",
    "",
    "body",
    "## Hello World",
    "",
    "## 世界",
  ]);
  const first = findHeadingLineForId(doc, "hello-world");
  assert.ok(first);
  assert.equal(first?.number, 1);

  const dup = findHeadingLineForId(doc, "hello-world-1");
  assert.ok(dup);
  assert.equal(dup?.number, 4);

  const multilingual = findHeadingLineForId(doc, "世界");
  assert.ok(multilingual);
  assert.equal(multilingual?.number, 6);

  assert.equal(findHeadingLineForId(doc, "missing"), null);
});

test("findHeadingLineForId ignores non-heading lines and respects trailing hashes", () => {
  const doc = Text.of(["# title ##", "not a heading", "####### too deep"]);
  const titled = findHeadingLineForId(doc, "title");
  assert.ok(titled);
  assert.equal(titled?.number, 1);
  assert.equal(findHeadingLineForId(doc, "too-deep"), null);
});
