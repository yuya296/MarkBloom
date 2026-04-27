const { expect, test } = require("@playwright/test");

// Diagnostic spec for issue #110: ArrowDown after exiting a table sometimes
// jumps to end-of-doc and oscillates between line 130 and 132.
//
// This was reproducible by hand but could not be reproduced under automation
// at the time of writing (see issue thread for details). The spec is kept as
// a soft-asserting watcher so that, if the regression resurfaces under the
// timing patterns used here, CI logs will surface the trace.
//
// Requires `__MB_EDITOR_VIEW__` to be exposed on window — the webview-demo
// app.ts publishes it as a debug helper.

async function setCaretToLine(page, lineNumber) {
  await page.evaluate((n) => {
    const view = window.__MB_EDITOR_VIEW__;
    if (!view) throw new Error("__MB_EDITOR_VIEW__ not available");
    const ln = view.state.doc.line(n);
    view.dispatch({ selection: { anchor: ln.from }, scrollIntoView: true });
    view.focus();
  }, lineNumber);
}

async function getCurrentLine(page) {
  return page.evaluate(() => {
    const view = window.__MB_EDITOR_VIEW__;
    const head = view.state.selection.main.head;
    return view.state.doc.lineAt(head).number;
  });
}

test("ArrowDown should not jump to end-of-doc after exiting a table (issue #110)", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__MB_EDITOR_VIEW__));
  await page.waitForTimeout(800);

  const startLine = await page.evaluate(() => {
    const view = window.__MB_EDITOR_VIEW__;
    const doc = view.state.doc;
    for (let i = 1; i <= doc.lines; i++) {
      if (doc.line(i).text.startsWith("## Tables")) return i;
    }
    throw new Error("'## Tables' not found");
  });

  await setCaretToLine(page, startLine);
  await page.waitForTimeout(200);
  expect(await getCurrentLine(page)).toBe(startLine);

  // Press ArrowDown enough times to traverse the table and the next 2 lines.
  // Use varied delays to surface timing-dependent regressions.
  const trace = [];
  const expectedTotalLines = await page.evaluate(() => window.__MB_EDITOR_VIEW__.state.doc.lines);
  const delays = [80, 80, 80, 200, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80];
  for (const d of delays) {
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(d);
    trace.push(await getCurrentLine(page));
  }
  console.log("trace:", trace.join(" -> "), "totalLines:", expectedTotalLines);

  // Soft assert: cursor must NOT have jumped to end-of-doc (last line) early.
  const jumped = trace.some((ln) => ln >= expectedTotalLines - 2);
  expect.soft(jumped, `cursor reached end of doc unexpectedly: ${trace.join(",")}`).toBe(false);
});
