// Variant of cursor-jump-after-table.spec.cjs that targets the Vite dev server
// (port 5173) instead of the static-build server (4174). Run with:
//   pnpm -C apps/webview-demo dev   # in another terminal
//   PWTEST_DEV=1 npx playwright test tests/e2e/cursor-jump-dev.spec.cjs --config tests/e2e/dev.config.cjs

const { expect, test } = require("@playwright/test");

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

test("dev server: ArrowDown advances one line at a time after exiting a table", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__MB_EDITOR_VIEW__));
  await page.waitForTimeout(1500);

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

  const trace = [];
  const expectedTotalLines = await page.evaluate(() => window.__MB_EDITOR_VIEW__.state.doc.lines);
  const delays = [80, 80, 80, 200, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80];
  for (const d of delays) {
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(d);
    trace.push(await getCurrentLine(page));
  }
  console.log("dev trace:", trace.join(" -> "), "totalLines:", expectedTotalLines);

  const jumped = trace.some((ln) => ln >= expectedTotalLines - 2);
  expect.soft(jumped, `cursor reached end of doc unexpectedly: ${trace.join(",")}`).toBe(false);
});
