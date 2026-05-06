import test from "node:test";
import assert from "node:assert/strict";
import { isTableLine } from "../src/editor/tableLineMatcher.ts";

test("isTableLine matches GFM separator rows", () => {
  assert.equal(isTableLine("|---|---|"), true);
  assert.equal(isTableLine("| --- | --- |"), true);
  assert.equal(isTableLine("|:--|--:|:--:|"), true);
  assert.equal(isTableLine("---|---"), true);
});

test("isTableLine matches piped data rows", () => {
  assert.equal(isTableLine("| foo | bar |"), true);
  assert.equal(isTableLine("|a|b|"), true);
});

test("isTableLine rejects empty lines and non-pipe content", () => {
  assert.equal(isTableLine(""), false);
  assert.equal(isTableLine("   "), false);
  assert.equal(isTableLine("plain text"), false);
});

test("isTableLine rejects bare pipe text without leading/trailing pipes", () => {
  assert.equal(isTableLine("foo | bar"), false);
});
