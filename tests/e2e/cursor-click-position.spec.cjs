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
    const scroller = document.querySelector(".cm-scroller");
    if (!(scroller instanceof HTMLElement)) {
      throw new Error("Missing .cm-scroller");
    }
    window.scrollTo(0, 0);
    scroller.scrollTop = 0;

    let lines = [];
    let target = null;
    for (let i = 0; i < 32; i += 1) {
      lines = [...document.querySelectorAll(".cm-line")];
      target = lines.find((line) => {
        const text = line.textContent?.trim() ?? "";
        return text === needle || text.includes(needle);
      });
      if (target) {
        break;
      }
      if (scroller.scrollHeight > scroller.clientHeight + 2) {
        scroller.scrollTop += Math.max(
          1,
          Math.floor(scroller.clientHeight * 0.8),
        );
      } else {
        window.scrollBy(0, Math.max(1, Math.floor(window.innerHeight * 0.8)));
      }
    }
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

async function probeLastLineClickHit(page) {
  const layout = await page.evaluate(() => {
    const lines = [...document.querySelectorAll(".cm-line")];
    const lastLine = lines.at(-1);
    if (!(lastLine instanceof HTMLElement)) {
      throw new Error("No .cm-line found");
    }
    lastLine.scrollIntoView({ block: "end" });
    const lineIndex = lines.length - 1;
    const rect = lastLine.getBoundingClientRect();
    const x = Math.round(rect.left + 24);
    const yPoints = [
      Math.round(rect.top + 2),
      Math.round((rect.top + rect.bottom) / 2),
      Math.round(rect.bottom - 2),
    ];
    return { expectedLineIndex: lineIndex, x, yPoints };
  });

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
    await probeLineClickHit(page, "# webview-demo sample"),
    await probeLineClickHit(page, "## Table of contents"),
    await probeLineClickHit(page, "## Headings"),
  ];

  for (const probe of probes) {
    expect(probe.hits).toEqual([
      probe.expectedLineIndex,
      probe.expectedLineIndex,
      probe.expectedLineIndex,
    ]);
  }
});

test("clicking the bottom-most line keeps caret on that line", async ({ page }) => {
  await page.goto("/");
  await disableLivePreview(page);

  const probe = await probeLastLineClickHit(page);
  expect(probe.hits).toEqual([
    probe.expectedLineIndex,
    probe.expectedLineIndex,
    probe.expectedLineIndex,
  ]);
});
