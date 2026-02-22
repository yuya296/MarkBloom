const { expect, test } = require("@playwright/test");

async function disableLivePreview(page) {
  await page.evaluate(() => {
    const checkbox = document.getElementById("toggle-live-preview");
    const apply = document.getElementById("apply");
    if (!(checkbox instanceof HTMLInputElement)) {
      throw new Error("Missing #toggle-live-preview");
    }
    if (!(apply instanceof HTMLButtonElement)) {
      throw new Error("Missing #apply");
    }
    checkbox.checked = false;
    apply.click();
  });
}

async function probeLineClickHit(page, lineText) {
  const layout = await page.evaluate((needle) => {
    const lines = [...document.querySelectorAll(".cm-line")];
    const target = lines.find((line) => line.textContent === needle);
    if (!(target instanceof HTMLElement)) {
      throw new Error(`Line text not found: ${needle}`);
    }
    target.scrollIntoView({ block: "center" });
    const lineIndex = lines.indexOf(target);
    const rect = target.getBoundingClientRect();
    const x = Math.round(rect.left + 24);
    const yPoints = [
      Math.round(rect.top + 2),
      Math.round((rect.top + rect.bottom) / 2),
      Math.round(rect.bottom - 2),
    ];

    return { expectedLineIndex: lineIndex, x, yPoints };
  }, lineText);

  const hits = [];
  for (const y of layout.yPoints) {
    await page.mouse.click(layout.x, y);
    const selectedLineIndex = await page.evaluate(() => {
      const selection = window.getSelection();
      const anchor = selection?.anchorNode;
      const element =
        anchor instanceof Element ? anchor : anchor?.parentElement ?? null;
      const lineElement = element?.closest(".cm-line");
      if (!lineElement) {
        throw new Error("No selected .cm-line");
      }
      const lines = [...document.querySelectorAll(".cm-line")];
      return lines.indexOf(lineElement);
    });
    hits.push(selectedLineIndex);
  }

  return { expectedLineIndex: layout.expectedLineIndex, hits };
}

test("clicking upper/middle/lower area keeps caret on the intended line (live preview off)", async ({
  page,
}) => {
  await page.goto("/");
  await disableLivePreview(page);

  const probes = [
    await probeLineClickHit(page, "Term 1"),
    await probeLineClickHit(page, ": Definition A"),
    await probeLineClickHit(page, "## HTML"),
  ];

  for (const probe of probes) {
    expect(probe.hits).toEqual([
      probe.expectedLineIndex,
      probe.expectedLineIndex,
      probe.expectedLineIndex,
    ]);
  }
});
