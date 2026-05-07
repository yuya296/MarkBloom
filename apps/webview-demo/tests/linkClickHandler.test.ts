import test from "node:test";
import assert from "node:assert/strict";
import { resolveLinkClickIntent } from "../src/editor/linkClickHandler.ts";

test("resolveLinkClickIntent returns ignore for nullish or empty href", () => {
  assert.deepEqual(resolveLinkClickIntent(undefined), { kind: "ignore" });
  assert.deepEqual(resolveLinkClickIntent(null), { kind: "ignore" });
  assert.deepEqual(resolveLinkClickIntent(""), { kind: "ignore" });
});

test("resolveLinkClickIntent decodes anchor target id", () => {
  assert.deepEqual(resolveLinkClickIntent("#hello-world"), {
    kind: "anchor",
    targetId: "hello-world",
  });
  assert.deepEqual(resolveLinkClickIntent("#%E3%81%82"), {
    kind: "anchor",
    targetId: "あ",
  });
});

test("resolveLinkClickIntent treats bare # as anchor with empty target", () => {
  // 旧実装は href が `#` だけでも preventDefault していたため、
  // anchor 扱いで返して呼び出し側に preventDefault させる。
  assert.deepEqual(resolveLinkClickIntent("#"), { kind: "anchor", targetId: "" });
});

test("resolveLinkClickIntent classifies any non-anchor href as external", () => {
  assert.deepEqual(resolveLinkClickIntent("https://example.com/foo"), {
    kind: "external",
    url: "https://example.com/foo",
  });
  assert.deepEqual(resolveLinkClickIntent("/relative/path"), {
    kind: "external",
    url: "/relative/path",
  });
  assert.deepEqual(resolveLinkClickIntent("mailto:a@example.com"), {
    kind: "external",
    url: "mailto:a@example.com",
  });
});
