import test from "node:test";
import assert from "node:assert/strict";
import { computeDiffLineKinds } from "../src/diff";

function mapToObject(map: Map<number, "added" | "modified">) {
  const result: Record<number, "added" | "modified"> = {};
  for (const [line, kind] of map.entries()) {
    result[line] = kind;
  }
  return result;
}

test("returns no markers for identical text", () => {
  const markers = computeDiffLineKinds("a\nb\nc", "a\nb\nc");
  assert.deepEqual(mapToObject(markers), {});
});

test("marks inserted lines as added", () => {
  const markers = computeDiffLineKinds("a\nc", "a\nb\nc");
  assert.deepEqual(mapToObject(markers), { 2: "added" });
});

test("marks replaced lines as modified", () => {
  const markers = computeDiffLineKinds("a\nb\nc", "a\nx\nc");
  assert.deepEqual(mapToObject(markers), { 2: "modified" });
});

test("does not emit marker for pure deletions", () => {
  const markers = computeDiffLineKinds("a\nb\nc", "a\nc");
  assert.deepEqual(mapToObject(markers), {});
});

test("ignores table-like lines when configured", () => {
  const markers = computeDiffLineKinds("| a | b |", "| x | b |", {
    ignoreLine: (line) => line.trim().startsWith("|") && line.trim().endsWith("|"),
  });
  assert.deepEqual(mapToObject(markers), {});
});

test("does not drift markers after ignored table block changes", () => {
  const baseline = [
    "before",
    "| Col A |",
    "| --- |",
    "| left |",
    "after",
  ].join("\n");
  const current = [
    "before",
    "| Col A |",
    "| --- |",
    "| changed |",
    "after",
  ].join("\n");
  const markers = computeDiffLineKinds(baseline, current, {
    ignoreLine: (line) => line.trim().startsWith("|") && line.trim().endsWith("|"),
  });
  assert.deepEqual(mapToObject(markers), {});
});
