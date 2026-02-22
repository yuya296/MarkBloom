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
    const view = document.querySelector(".cm-content")?.cmTile?.view;
    if (!view) {
      throw new Error("CodeMirror view not found");
    }
    const docText = view.state.doc.toString();
    const index = docText.indexOf(needle);
    if (index < 0) {
      throw new Error(`Line text not found: ${needle}`);
    }
    const line = view.state.doc.lineAt(index + 1);
    view.dispatch({ selection: { anchor: line.from }, scrollIntoView: true });
    const coords = view.coordsAtPos(index + 1);
    if (!coords) {
      throw new Error(`coordsAtPos failed for: ${needle}`);
    }
    const x = Math.round(coords.left + 24);
    const yPoints = [
      Math.round(coords.top + 2),
      Math.round((coords.top + coords.bottom) / 2),
      Math.round(coords.bottom - 2),
    ];

    return { expectedLine: line.number, x, yPoints };
  }, lineText);

  const hits = [];
  for (const y of layout.yPoints) {
    await page.mouse.click(layout.x, y);
    const selectedLine = await page.evaluate(() => {
      const view = document.querySelector(".cm-content")?.cmTile?.view;
      if (!view) {
        throw new Error("CodeMirror view not found");
      }
      return view.state.doc.lineAt(view.state.selection.main.head).number;
    });
    hits.push(selectedLine);
  }

  return { expectedLine: layout.expectedLine, hits };
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
      probe.expectedLine,
      probe.expectedLine,
      probe.expectedLine,
    ]);
  }
});
