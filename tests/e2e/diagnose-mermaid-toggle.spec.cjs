const { expect, test } = require("@playwright/test");

// Regression watcher for issue #112 (mermaid raw/rich toggle when caret enters
// the block). The mermaid feature flag is paused (off) by default in
// `apps/webview-demo/src/featureFlags.ts`, so this spec auto-skips when no
// mermaid widget is present in the DOM. Flip the flag to true to exercise it.
//
// Requires `__MB_EDITOR_VIEW__` to be exposed on window (debug helper that
// the webview-demo app already publishes).

async function setCaret(page, lineNum, col = 0) {
  return page.evaluate(({ n, c }) => {
    const view = window.__MB_EDITOR_VIEW__;
    const ln = view.state.doc.line(n);
    view.dispatch({ selection: { anchor: ln.from + c }, scrollIntoView: true });
    view.focus();
  }, { n: lineNum, c: col });
}

async function modeCounts(page) {
  return page.evaluate(() => ({
    replace: document.querySelectorAll(".cm-lp-mermaid-replace").length,
    append: document.querySelectorAll(".cm-lp-mermaid-append").length,
  }));
}

test("mermaid raw/rich toggle around block boundaries (issue #112)", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__MB_EDITOR_VIEW__));
  await page.waitForTimeout(1500);

  const mermaidStartLine = await page.evaluate(() => {
    const view = window.__MB_EDITOR_VIEW__;
    const doc = view.state.doc;
    for (let i = 1; i <= doc.lines; i++) {
      if (doc.line(i).text.startsWith("```mermaid")) return i;
    }
    return -1;
  });
  if (mermaidStartLine < 0) {
    test.skip(true, "no mermaid block in sample doc");
  }

  // Place caret far away first; if the mermaid feature flag is off, no widget
  // will be rendered and we cannot assert anything meaningful.
  await setCaret(page, Math.max(1, mermaidStartLine - 5));
  await page.waitForTimeout(200);
  const baseline = await modeCounts(page);
  if (baseline.replace === 0 && baseline.append === 0) {
    test.skip(true, "mermaid feature flag is disabled (no widget in DOM)");
  }

  // Caret outside the block → rich (replace)
  expect(baseline.replace).toBeGreaterThanOrEqual(1);
  expect(baseline.append).toBe(0);

  // Caret inside the block body → raw (append, no replace)
  await setCaret(page, mermaidStartLine + 1);
  await page.waitForTimeout(200);
  const inside = await modeCounts(page);
  expect.soft(inside.replace, `inside body should not show rich; counts=${JSON.stringify(inside)}`).toBe(0);
  expect.soft(inside.append, `inside body should show append; counts=${JSON.stringify(inside)}`).toBeGreaterThanOrEqual(1);

  // Caret on the opening fence line → raw
  await setCaret(page, mermaidStartLine, 1);
  await page.waitForTimeout(200);
  const onOpen = await modeCounts(page);
  expect.soft(onOpen.replace, `on opening fence should not show rich; counts=${JSON.stringify(onOpen)}`).toBe(0);
  expect.soft(onOpen.append, `on opening fence should show append; counts=${JSON.stringify(onOpen)}`).toBeGreaterThanOrEqual(1);

  // Caret moved far below → rich again
  const closingLine = await page.evaluate((openLine) => {
    const view = window.__MB_EDITOR_VIEW__;
    const doc = view.state.doc;
    for (let i = openLine + 1; i <= doc.lines; i++) {
      if (doc.line(i).text.trim().startsWith("```")) return i;
    }
    return -1;
  }, mermaidStartLine);
  await setCaret(page, closingLine + 5);
  await page.waitForTimeout(200);
  const farBelow = await modeCounts(page);
  // Note: the rendered region may be virtualized off-screen; only assert that
  // the append (raw) widget no longer remains.
  expect.soft(farBelow.append, `far below should not show append; counts=${JSON.stringify(farBelow)}`).toBe(0);
});
