import assert from "node:assert/strict";
import test from "node:test";
import { mermaidLivePreview } from "../src/index";

test("returns base theme extension and live preview plugin as a bundle", () => {
  const bundle = mermaidLivePreview();
  assert.equal(bundle.extensions.length, 2);
  assert.equal(bundle.plugin.name, "mermaid-live-preview");
});
