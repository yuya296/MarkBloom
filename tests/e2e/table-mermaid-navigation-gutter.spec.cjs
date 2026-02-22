const { expect, test } = require("@playwright/test");

async function setCursorByNeedle(page, needle, toLineEnd = false) {
  await page.evaluate(
    ({ text, toEnd }) => {
      const view = window.__MB_EDITOR_VIEW__;
      if (!view?.state) {
        throw new Error("Missing __MB_EDITOR_VIEW__");
      }
      for (let n = 1; n <= view.state.doc.lines; n += 1) {
        const line = view.state.doc.line(n);
        if (!line.text.includes(text)) {
          continue;
        }
        view.dispatch({
          selection: { anchor: toEnd ? line.to : line.from },
          scrollIntoView: true,
        });
        view.focus();
        return;
      }
      throw new Error(`Needle not found: ${text}`);
    },
    { text: needle, toEnd: toLineEnd }
  );
}

async function appendTokenAtLine(page, needle, token) {
  await setCursorByNeedle(page, needle, true);
  await page.keyboard.type(token);
}

async function measureMarkerDeltaByNeedle(page, needle) {
  await setCursorByNeedle(page, needle, false);
  return page.evaluate(() => {
    const view = window.__MB_EDITOR_VIEW__;
    if (!view?.state) {
      throw new Error("Missing __MB_EDITOR_VIEW__");
    }
    const head = view.state.selection.main.head;
    const line = view.state.doc.lineAt(head);
    const coords = view.coordsAtPos(line.from);
    if (!coords) {
      throw new Error("Cannot resolve line coordinates");
    }
    const lineCenter = (coords.top + coords.bottom) / 2;
    const markers = Array.from(
      document.querySelectorAll(".cm-diff-gutter .cm-gutterElement")
    ).filter((el) => el.querySelector(".cm-diff-marker"));
    if (markers.length === 0) {
      throw new Error("No diff markers found");
    }

    const nearest = markers
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const center = (rect.top + rect.bottom) / 2;
        return { center, distance: Math.abs(center - lineCenter) };
      })
      .sort((a, b) => a.distance - b.distance)[0];

    const delta = nearest.center - lineCenter;
    return {
      delta,
      absDelta: Math.abs(delta),
    };
  });
}

test("diff gutter marker stays aligned after passing mermaid block", async ({ page }) => {
  await page.goto("/");

  const beforeToken = " [DRIFT-BEFORE]";
  const afterToken = " [DRIFT-AFTER]";
  await appendTokenAtLine(page, "A rich Markdown sample covering common patterns.", beforeToken);
  await appendTokenAtLine(page, "End of sample.", afterToken);

  const before = await measureMarkerDeltaByNeedle(page, "[DRIFT-BEFORE]");
  const after = await measureMarkerDeltaByNeedle(page, "[DRIFT-AFTER]");

  expect(before.absDelta).toBeLessThanOrEqual(3);
  expect(after.absDelta).toBeLessThanOrEqual(3);
  expect(Math.abs(after.delta - before.delta)).toBeLessThanOrEqual(2);
});
