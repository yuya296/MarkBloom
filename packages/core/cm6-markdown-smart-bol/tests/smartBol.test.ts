import { test } from "node:test";
import assert from "node:assert/strict";
import { getDefaultSmartBolShortcuts, getMarkdownSmartBolOffset } from "../src/index";

test("heading: move after # markers", () => {
  assert.equal(getMarkdownSmartBolOffset("# Heading"), 2);
  assert.equal(getMarkdownSmartBolOffset("### Heading"), 4);
  assert.equal(getMarkdownSmartBolOffset("  ## Heading"), 5);
});

test("unordered list markers", () => {
  assert.equal(getMarkdownSmartBolOffset("- item"), 2);
  assert.equal(getMarkdownSmartBolOffset("* item"), 2);
  assert.equal(getMarkdownSmartBolOffset("+ item"), 2);
  assert.equal(getMarkdownSmartBolOffset("  - item"), 4);
});

test("ordered list markers", () => {
  assert.equal(getMarkdownSmartBolOffset("1. item"), 3);
  assert.equal(getMarkdownSmartBolOffset("1) item"), 3);
  assert.equal(getMarkdownSmartBolOffset("123. item"), 5);
});

test("blockquote markers including nested quote", () => {
  assert.equal(getMarkdownSmartBolOffset("> quote"), 2);
  assert.equal(getMarkdownSmartBolOffset("> > quote"), 4);
  assert.equal(getMarkdownSmartBolOffset("  > > quote"), 6);
});

test("task list markers for unordered and ordered list", () => {
  assert.equal(getMarkdownSmartBolOffset("- [ ] task"), 6);
  assert.equal(getMarkdownSmartBolOffset("* [x] task"), 6);
  assert.equal(getMarkdownSmartBolOffset("1. [ ] task"), 7);
  assert.equal(getMarkdownSmartBolOffset("2) [X] task"), 7);
});

test("blockquote list markers prioritize list side", () => {
  assert.equal(getMarkdownSmartBolOffset("> - item"), 4);
  assert.equal(getMarkdownSmartBolOffset("> 1. item"), 5);
  assert.equal(getMarkdownSmartBolOffset("  > - item"), 6);
});

test("blockquote task list markers prioritize task side", () => {
  assert.equal(getMarkdownSmartBolOffset("> - [ ] task"), 8);
  assert.equal(getMarkdownSmartBolOffset("> 1. [x] task"), 9);
});

test("fallback to indentation for non target lines", () => {
  assert.equal(getMarkdownSmartBolOffset("plain text"), 0);
  assert.equal(getMarkdownSmartBolOffset("    plain text"), 4);
});

test("getDefaultSmartBolShortcuts returns Mac shortcuts when platform reports Mac", () => {
  const shortcuts = getDefaultSmartBolShortcuts({ platform: "MacIntel", userAgent: "" });
  assert.deepEqual(shortcuts, [{ mac: "Ctrl-a" }, { mac: "Cmd-ArrowLeft" }]);
});

test("getDefaultSmartBolShortcuts honors userAgentData over platform", () => {
  const shortcuts = getDefaultSmartBolShortcuts({
    platform: "Win32",
    userAgent: "",
    userAgentData: { platform: "Mac" },
  });
  assert.deepEqual(shortcuts, [{ mac: "Ctrl-a" }, { mac: "Cmd-ArrowLeft" }]);
});

test("getDefaultSmartBolShortcuts detects iOS via userAgent", () => {
  const shortcuts = getDefaultSmartBolShortcuts({
    platform: "",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
  });
  assert.deepEqual(shortcuts, [{ mac: "Ctrl-a" }, { mac: "Cmd-ArrowLeft" }]);
});

test("getDefaultSmartBolShortcuts returns Home for non-Mac platforms", () => {
  assert.deepEqual(getDefaultSmartBolShortcuts({ platform: "Win32", userAgent: "" }), [
    { key: "Home" },
  ]);
  assert.deepEqual(getDefaultSmartBolShortcuts({ platform: "Linux x86_64", userAgent: "" }), [
    { key: "Home" },
  ]);
});

test("getDefaultSmartBolShortcuts returns Home for an empty navigator (no platform info)", () => {
  assert.deepEqual(getDefaultSmartBolShortcuts({}), [{ key: "Home" }]);
});
