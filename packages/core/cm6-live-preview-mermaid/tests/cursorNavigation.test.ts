import assert from "node:assert/strict";
import test from "node:test";
import type { MermaidBlockInfo } from "../src/blocks";
import {
  isDirectionalBoundaryRaw,
  shouldMoveCursorPastMermaidBottom,
  shouldMoveCursorToMermaidTop,
} from "../src/navigationLogic";

function createBlock(from: number, to: number): MermaidBlockInfo {
  return {
    replaceRange: { from, to },
    rawJudgeRange: { from: from + 1, to: to - 1 },
    openingLineFrom: from,
    source: "graph TD\nA-->B",
  };
}

test("treats bottom boundary as raw only when entering from below", () => {
  const block = createBlock(100, 140);
  const prevHead = 200;
  const currentHead = 141;
  assert.equal(isDirectionalBoundaryRaw(prevHead, currentHead, block), true);
});

test("moves cursor to top when entering from above and landing at closing boundary", () => {
  const block = createBlock(100, 140);
  const prevHead = 80;
  const currentHead = 140;
  assert.equal(shouldMoveCursorToMermaidTop(prevHead, currentHead, block), true);
});

test("does not move cursor for normal in-block navigation", () => {
  const block = createBlock(100, 140);
  const prevHead = 120;
  const currentHead = 121;
  assert.equal(shouldMoveCursorToMermaidTop(prevHead, currentHead, block), false);
});

test("moves cursor past block bottom when navigating down to closing boundary", () => {
  const block = createBlock(100, 140);
  const prevHead = 130;
  const currentHead = 140;
  assert.equal(shouldMoveCursorPastMermaidBottom(prevHead, currentHead, block), true);
});
