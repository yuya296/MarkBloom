import { test } from "node:test";
import assert from "node:assert/strict";
import { getMarkdownSmartBolOffset } from "../src/index";

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
