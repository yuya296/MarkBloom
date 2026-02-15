import assert from "node:assert/strict";
import test from "node:test";
import {
  createMermaidEditorHarness,
  flushEditorUpdates,
} from "./helpers/editorHarness";

type DeferredRender = {
  resolve: (value: { svg: string }) => void;
  reject: (error: unknown) => void;
};

function createDeferredRenderQueue() {
  const queue: DeferredRender[] = [];
  const api = {
    initialize() {},
    render: async () =>
      new Promise<{ svg: string }>((resolve, reject) => {
        queue.push({ resolve, reject });
      }),
  };
  return { api, queue };
}

function installMockMermaid(api: unknown): () => void {
  const original = (globalThis as typeof globalThis & { mermaid?: unknown }).mermaid;
  (globalThis as typeof globalThis & { mermaid?: unknown }).mermaid = api;
  return () => {
    (globalThis as typeof globalThis & { mermaid?: unknown }).mermaid = original;
  };
}

test("keeps rendered SVG when render resolves while widget DOM is detached", async () => {
  const doc = ["## Mermaid", "", "```mermaid", "graph TD", "A-->B", "```", "", "after"].join("\n");
  const { api, queue } = createDeferredRenderQueue();
  const restoreMermaid = installMockMermaid(api);
  const harness = await createMermaidEditorHarness(doc, doc.length);

  try {
    const wrapper = harness.parent.querySelector<HTMLElement>(".cm-lp-mermaid");
    assert.ok(wrapper, "mermaid widget wrapper must exist");
    const container = wrapper.querySelector<HTMLElement>(".cm-lp-mermaid-content");
    assert.ok(container, "mermaid content container must exist");
    assert.equal(queue.length > 0, true, "render should be requested");

    const parent = wrapper.parentElement;
    assert.ok(parent, "widget wrapper parent must exist");
    parent.removeChild(wrapper);

    queue.shift()?.resolve({ svg: "<svg data-id='detached-ok'></svg>" });
    await flushEditorUpdates();

    parent.appendChild(wrapper);
    await flushEditorUpdates();

    assert.ok(
      container.querySelector("svg[data-id='detached-ok']"),
      "detached resolve should still populate SVG"
    );
  } finally {
    harness.teardown();
    restoreMermaid();
  }
});

test("keeps latest SVG after rapid raw/rich transitions", async () => {
  const doc = [
    "## Mermaid",
    "",
    "```mermaid",
    "graph TD",
    "A-->B",
    "```",
    "",
    "## Tables",
    "| A | B |",
    "| --- | --- |",
    "| 1 | 2 |",
  ].join("\n");
  const { api, queue } = createDeferredRenderQueue();
  const restoreMermaid = installMockMermaid(api);
  const harness = await createMermaidEditorHarness(doc, 0);

  try {
    const graphPos = doc.indexOf("graph TD");
    const tablesPos = doc.indexOf("## Tables");
    assert.ok(graphPos >= 0);
    assert.ok(tablesPos >= 0);

    harness.setCursor(graphPos);
    await flushEditorUpdates();
    harness.setCursor(tablesPos);
    await flushEditorUpdates();

    assert.equal(queue.length >= 1, true, "at least one render should be queued");
    for (let i = 0; i < queue.length; i += 1) {
      const id = i === queue.length - 1 ? "latest" : `stale-${i}`;
      queue[i]?.resolve({ svg: `<svg data-id='${id}'></svg>` });
    }
    await flushEditorUpdates(5);

    const latestSvg = harness.parent.querySelector("svg[data-id='latest']");
    assert.ok(latestSvg, "latest render output should be visible");
    const openButtons = harness.parent.querySelectorAll(".cm-lp-mermaid-open-button");
    assert.equal(openButtons.length <= 1, true, "open button should not duplicate");
  } finally {
    harness.teardown();
    restoreMermaid();
  }
});

test("sanitizes unsafe elements and attributes from rendered SVG", async () => {
  const doc = ["```mermaid", "graph TD", "A-->B", "```"].join("\n");
  const api = {
    initialize() {},
    render: async () => ({
      svg: "<svg onload='alert(1)'><script>alert(1)</script><foreignObject></foreignObject><g onclick='alert(1)'></g></svg>",
    }),
  };
  const restoreMermaid = installMockMermaid(api);
  const harness = await createMermaidEditorHarness(doc, 0);

  try {
    await flushEditorUpdates(5);
    const wrapper = harness.parent.querySelector<HTMLElement>(".cm-lp-mermaid");
    assert.ok(wrapper, "mermaid widget wrapper must exist");
    assert.equal(wrapper.querySelectorAll("script").length, 0);
    assert.equal(wrapper.querySelectorAll("foreignObject").length, 0);
    const svg = wrapper.querySelector("svg");
    assert.ok(svg, "sanitized svg should exist");
    assert.equal(svg.getAttribute("onload"), null);
    const group = wrapper.querySelector("g");
    assert.ok(group, "svg group should remain");
    assert.equal(group.getAttribute("onclick"), null);
  } finally {
    harness.teardown();
    restoreMermaid();
  }
});
