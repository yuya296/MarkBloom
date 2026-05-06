import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLineNumbersExtension,
  buildTabSizeExtension,
  buildWrapExtension,
} from "../src/editor/extensionBuilders.ts";

test("buildLineNumbersExtension is empty when disabled", () => {
  assert.deepEqual(buildLineNumbersExtension({ showLineNumbers: false }), []);
});

test("buildLineNumbersExtension returns one extension when enabled", () => {
  const ext = buildLineNumbersExtension({ showLineNumbers: true });
  assert.equal(ext.length, 1);
});

test("buildWrapExtension toggles by option", () => {
  assert.deepEqual(buildWrapExtension({ wrapLines: false }), []);
  assert.equal(buildWrapExtension({ wrapLines: true }).length, 1);
});

test("buildTabSizeExtension is empty when value is not finite", () => {
  assert.deepEqual(buildTabSizeExtension({ tabSize: Number.NaN }), []);
});

test("buildTabSizeExtension returns one extension for finite size", () => {
  assert.equal(buildTabSizeExtension({ tabSize: 4 }).length, 1);
});

