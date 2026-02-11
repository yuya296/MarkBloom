import assert from "node:assert/strict";
import test from "node:test";
import {
  createTableEditorHarness,
  flushEditorUpdates,
} from "./helpers/editorHarness";

function dispatchKey(
  target: Element,
  key: string,
  options: { shiftKey?: boolean; isComposing?: boolean } = {}
) {
  target.dispatchEvent(
    new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
      shiftKey: options.shiftKey ?? false,
      isComposing: options.isComposing ?? false,
    })
  );
}

function dispatchContextMenu(target: Element) {
  target.dispatchEvent(
    new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 12,
      clientY: 12,
    })
  );
}

function selectedCell(wrapper: Element): HTMLTableCellElement | null {
  return wrapper.querySelector<HTMLTableCellElement>(".cm-table-cell-selected");
}

function clickCell(wrapper: Element, row: number, col: number) {
  const cell = wrapper.querySelector<HTMLElement>(
    `.cm-table-cell[data-row='${row}'][data-col='${col}']`
  );
  assert.ok(cell, `cell not found: row=${row}, col=${col}`);
  cell.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

function getMenu(wrapper: Element): HTMLElement {
  const menu = wrapper.querySelector<HTMLElement>(".cm-table-context-menu");
  assert.ok(menu, "context menu must exist");
  return menu;
}

function clickMenuItem(menu: Element, label: string) {
  const button = Array.from(menu.querySelectorAll<HTMLButtonElement>("button")).find(
    (item) => item.textContent === label
  );
  assert.ok(button, `menu item not found: ${label}`);
  button.click();
}

test("does not render widget when table editor is disabled", async () => {
  const harness = await createTableEditorHarness(
    ["| A | B |", "| --- | --- |", "| 1 | 2 |"].join("\n"),
    { enabled: false }
  );
  try {
    assert.equal(harness.parent.querySelector(".cm6-table-editor"), null);
    assert.equal(harness.parent.querySelector(".cm-table-editor-hidden"), null);
  } finally {
    harness.teardown();
  }
});

test("does not render widget when renderMode is none", async () => {
  const harness = await createTableEditorHarness(
    ["| A | B |", "| --- | --- |", "| 1 | 2 |"].join("\n"),
    { renderMode: "none" }
  );
  try {
    assert.equal(harness.parent.querySelector(".cm6-table-editor"), null);
  } finally {
    harness.teardown();
  }
});

test("renders widget and hides source table lines", async () => {
  const harness = await createTableEditorHarness(
    ["| A | B |", "| --- | --- |", "| 1 | 2 |"].join("\n")
  );
  try {
    assert.ok(harness.parent.querySelector(".cm6-table-editor"));
    assert.equal(harness.parent.querySelectorAll(".cm-table-editor-hidden").length, 3);
  } finally {
    harness.teardown();
  }
});

test("initial state has a selected cell", async () => {
  const harness = await createTableEditorHarness(
    ["| A | B |", "| --- | --- |", "| 1 | 2 |", "| 3 | 4 |"].join("\n")
  );
  try {
    const wrapper = harness.parent.querySelector<HTMLElement>(".cm6-table-editor");
    assert.ok(wrapper);
    const cell = selectedCell(wrapper);
    assert.ok(cell);
    assert.ok(Number.isFinite(Number(cell.dataset.row)));
    assert.ok(Number.isFinite(Number(cell.dataset.col)));
  } finally {
    harness.teardown();
  }
});

test("arrow keys clamp the selection at table bounds", async () => {
  const harness = await createTableEditorHarness(
    ["| A | B |", "| --- | --- |", "| 1 | 2 |"].join("\n")
  );
  try {
    const wrapper = harness.parent.querySelector<HTMLElement>(".cm6-table-editor");
    assert.ok(wrapper);

    dispatchKey(wrapper, "ArrowUp");
    dispatchKey(wrapper, "ArrowUp");
    dispatchKey(wrapper, "ArrowLeft");
    const cell = selectedCell(wrapper);
    assert.ok(cell);
    assert.equal(cell.dataset.row, "0");
    assert.equal(cell.dataset.col, "0");
  } finally {
    harness.teardown();
  }
});

test("tab and shift+tab move selection cyclically", async () => {
  const harness = await createTableEditorHarness(
    ["| A | B |", "| --- | --- |", "| 1 | 2 |"].join("\n")
  );
  try {
    const wrapper = harness.parent.querySelector<HTMLElement>(".cm6-table-editor");
    assert.ok(wrapper);

    clickCell(wrapper, 1, 0);
    dispatchKey(wrapper, "Tab");
    let cell = selectedCell(wrapper);
    assert.ok(cell);
    assert.notEqual(`${cell.dataset.row}:${cell.dataset.col}`, "1:0");

    clickCell(wrapper, 0, 1);
    dispatchKey(wrapper, "Tab", { shiftKey: true });
    cell = selectedCell(wrapper);
    assert.ok(cell);
    assert.equal(cell.dataset.row, "0");
    assert.equal(cell.dataset.col, "0");
  } finally {
    harness.teardown();
  }
});

test("enter starts editing mode", async () => {
  const harness = await createTableEditorHarness(
    ["| A | B |", "| --- | --- |", "| 1 | 2 |"].join("\n")
  );
  try {
    const wrapper = harness.parent.querySelector<HTMLElement>(".cm6-table-editor");
    const editor = harness.parent.querySelector<HTMLTextAreaElement>(".cm-table-overlay-input");
    assert.ok(wrapper);
    assert.ok(editor);

    dispatchKey(wrapper, "Enter");
    await flushEditorUpdates();

    assert.equal(wrapper.dataset.mode, "edit");
    assert.equal(editor.dataset.open, "true");
  } finally {
    harness.teardown();
  }
});

test("f2 starts editing mode", async () => {
  const harness = await createTableEditorHarness(
    ["| A | B |", "| --- | --- |", "| 1 | 2 |"].join("\n")
  );
  try {
    const wrapper = harness.parent.querySelector<HTMLElement>(".cm6-table-editor");
    const editor = harness.parent.querySelector<HTMLTextAreaElement>(".cm-table-overlay-input");
    assert.ok(wrapper);
    assert.ok(editor);

    dispatchKey(wrapper, "F2");
    await flushEditorUpdates();

    assert.equal(wrapper.dataset.mode, "edit");
    assert.equal(editor.dataset.open, "true");
  } finally {
    harness.teardown();
  }
});

test("escape cancels editing without document mutation", async () => {
  const harness = await createTableEditorHarness(
    ["| A | B |", "| --- | --- |", "| 1 | 2 |"].join("\n")
  );
  const before = harness.getDoc();
  try {
    const wrapper = harness.parent.querySelector<HTMLElement>(".cm6-table-editor");
    const editor = harness.parent.querySelector<HTMLTextAreaElement>(".cm-table-overlay-input");
    assert.ok(wrapper);
    assert.ok(editor);

    dispatchKey(wrapper, "Enter");
    await flushEditorUpdates();
    editor.value = "updated";
    dispatchKey(editor, "Escape");
    await flushEditorUpdates();

    assert.equal(wrapper.dataset.mode, "nav");
    assert.equal(harness.getDoc(), before);
  } finally {
    harness.teardown();
  }
});

test("enter commits current cell to markdown", async () => {
  const harness = await createTableEditorHarness(
    ["| A | B |", "| --- | --- |", "| 1 | 2 |"].join("\n")
  );
  const before = harness.getDoc();
  try {
    const wrapper = harness.parent.querySelector<HTMLElement>(".cm6-table-editor");
    const editor = harness.parent.querySelector<HTMLTextAreaElement>(".cm-table-overlay-input");
    assert.ok(wrapper);
    assert.ok(editor);

    clickCell(wrapper, 1, 0);
    await flushEditorUpdates();
    dispatchKey(wrapper, "Enter");
    await flushEditorUpdates();
    editor.value = "updated";
    dispatchKey(editor, "Enter");
    await flushEditorUpdates();

    assert.equal(wrapper.dataset.mode, "nav");
    const after = harness.getDoc();
    assert.notEqual(after, before);
    assert.equal(after.includes("updated"), true);
  } finally {
    harness.teardown();
  }
});

test("ime composing enter does not commit", async () => {
  const harness = await createTableEditorHarness(
    ["| A | B |", "| --- | --- |", "| 1 | 2 |"].join("\n")
  );
  try {
    const wrapper = harness.parent.querySelector<HTMLElement>(".cm6-table-editor");
    const editor = harness.parent.querySelector<HTMLTextAreaElement>(".cm-table-overlay-input");
    assert.ok(wrapper);
    assert.ok(editor);

    dispatchKey(wrapper, "Enter");
    await flushEditorUpdates();

    editor.value = "IME";
    editor.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    dispatchKey(editor, "Enter", { isComposing: true });
    await flushEditorUpdates();

    assert.equal(wrapper.dataset.mode, "edit");
    assert.equal(harness.getDoc().includes("IME"), false);

    editor.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
    dispatchKey(editor, "Enter");
    await flushEditorUpdates();
    assert.equal(harness.getDoc().includes("IME"), true);
  } finally {
    harness.teardown();
  }
});

test("blur commits editing to markdown", async () => {
  const harness = await createTableEditorHarness(
    ["| A | B |", "| --- | --- |", "| 1 | 2 |"].join("\n")
  );
  try {
    const wrapper = harness.parent.querySelector<HTMLElement>(".cm6-table-editor");
    const editor = harness.parent.querySelector<HTMLTextAreaElement>(".cm-table-overlay-input");
    assert.ok(wrapper);
    assert.ok(editor);

    dispatchKey(wrapper, "Enter");
    await flushEditorUpdates();
    editor.value = "blur-commit";

    const outside = document.createElement("button");
    document.body.appendChild(outside);
    editor.dispatchEvent(new FocusEvent("blur", { bubbles: true, relatedTarget: outside }));
    await flushEditorUpdates();

    assert.equal(harness.getDoc().includes("blur-commit"), true);
    outside.remove();
  } finally {
    harness.teardown();
  }
});

test("context menu does not open from plain cell selection", async () => {
  const harness = await createTableEditorHarness(
    ["| A | B |", "| --- | --- |", "| 1 | 2 |"].join("\n")
  );
  try {
    const wrapper = harness.parent.querySelector<HTMLElement>(".cm6-table-editor");
    assert.ok(wrapper);
    const menu = getMenu(wrapper);
    const cell = wrapper.querySelector<HTMLElement>(".cm-table-cell[data-row='1'][data-col='0']");
    assert.ok(cell);

    dispatchContextMenu(cell);
    await flushEditorUpdates();

    assert.notEqual(menu.dataset.open, "true");
  } finally {
    harness.teardown();
  }
});

test("row context menu can insert row above", async () => {
  const harness = await createTableEditorHarness(
    ["| A | B |", "| --- | --- |", "| 1 | 2 |"].join("\n")
  );
  try {
    const wrapper = harness.parent.querySelector<HTMLElement>(".cm6-table-editor");
    assert.ok(wrapper);
    const rowHandle = wrapper.querySelector<HTMLElement>(".cm-table-row-handle");
    assert.ok(rowHandle);

    dispatchContextMenu(rowHandle);
    await flushEditorUpdates();

    const menu = getMenu(wrapper);
    clickMenuItem(menu, "Insert row above");
    await flushEditorUpdates();

    const lines = harness.getDoc().split("\n");
    assert.equal(lines.length, 4);
    assert.equal(lines[2], "|  |  |");
    assert.equal(lines[3], "| 1 | 2 |");
  } finally {
    harness.teardown();
  }
});

test("row context menu can delete row", async () => {
  const harness = await createTableEditorHarness(
    ["| A | B |", "| --- | --- |", "| 1 | 2 |", "| 3 | 4 |"].join("\n")
  );
  try {
    const wrapper = harness.parent.querySelector<HTMLElement>(".cm6-table-editor");
    assert.ok(wrapper);
    const rowHandles = wrapper.querySelectorAll<HTMLElement>(".cm-table-row-handle");
    assert.equal(rowHandles.length, 2);

    dispatchContextMenu(rowHandles[0]);
    await flushEditorUpdates();
    const menu = getMenu(wrapper);
    clickMenuItem(menu, "Delete row");
    await flushEditorUpdates();

    const doc = harness.getDoc();
    assert.equal(doc.includes("| 1 | 2 |"), false);
    assert.equal(doc.includes("| 3 | 4 |"), true);
  } finally {
    harness.teardown();
  }
});

test("column context menu can insert column right", async () => {
  const harness = await createTableEditorHarness(
    ["| A | B |", "| --- | --- |", "| 1 | 2 |"].join("\n")
  );
  try {
    const wrapper = harness.parent.querySelector<HTMLElement>(".cm6-table-editor");
    assert.ok(wrapper);
    const colHandle = wrapper.querySelector<HTMLElement>(".cm-table-col-handle");
    assert.ok(colHandle);

    dispatchContextMenu(colHandle);
    await flushEditorUpdates();
    const menu = getMenu(wrapper);
    clickMenuItem(menu, "Insert column right");
    await flushEditorUpdates();

    const lines = harness.getDoc().split("\n");
    assert.equal(lines[0], "| A | Col 2 | B |");
    assert.equal(lines[2], "| 1 |  | 2 |");
  } finally {
    harness.teardown();
  }
});

test("column delete keeps at least one column", async () => {
  const harness = await createTableEditorHarness(["| A |", "| --- |", "| 1 |"].join("\n"));
  const before = harness.getDoc();
  try {
    const wrapper = harness.parent.querySelector<HTMLElement>(".cm6-table-editor");
    assert.ok(wrapper);
    const colHandle = wrapper.querySelector<HTMLElement>(".cm-table-col-handle");
    assert.ok(colHandle);

    dispatchContextMenu(colHandle);
    await flushEditorUpdates();
    const menu = getMenu(wrapper);
    clickMenuItem(menu, "Delete column");
    await flushEditorUpdates();

    assert.equal(harness.getDoc(), before);
  } finally {
    harness.teardown();
  }
});

test("keeps alignment separator after cell edits", async () => {
  const harness = await createTableEditorHarness(
    ["| A | B |", "| :--- | ---: |", "| 1 | 2 |"].join("\n")
  );
  try {
    const wrapper = harness.parent.querySelector<HTMLElement>(".cm6-table-editor");
    const editor = harness.parent.querySelector<HTMLTextAreaElement>(".cm-table-overlay-input");
    assert.ok(wrapper);
    assert.ok(editor);

    dispatchKey(wrapper, "Enter");
    await flushEditorUpdates();
    editor.value = "left";
    dispatchKey(editor, "Enter");
    await flushEditorUpdates();

    const lines = harness.getDoc().split("\n");
    assert.equal(lines[1], "| :--- | ---: |");
  } finally {
    harness.teardown();
  }
});

test("preserves trailing newlines after commit", async () => {
  const harness = await createTableEditorHarness(
    `${["| A | B |", "| --- | --- |", "| 1 | 2 |"].join("\n")}\n\n\n`
  );
  try {
    const wrapper = harness.parent.querySelector<HTMLElement>(".cm6-table-editor");
    const editor = harness.parent.querySelector<HTMLTextAreaElement>(".cm-table-overlay-input");
    assert.ok(wrapper);
    assert.ok(editor);

    dispatchKey(wrapper, "Enter");
    await flushEditorUpdates();
    editor.value = "tail";
    dispatchKey(editor, "Enter");
    await flushEditorUpdates();

    assert.equal(harness.getDoc().endsWith("\n\n\n"), true);
  } finally {
    harness.teardown();
  }
});

test("editing first table does not mutate second table", async () => {
  const source = [
    "| A | B |",
    "| --- | --- |",
    "| 1 | 2 |",
    "",
    "| X | Y |",
    "| --- | --- |",
    "| 9 | 8 |",
  ].join("\n");
  const harness = await createTableEditorHarness(source);
  try {
    const wrappers = harness.parent.querySelectorAll<HTMLElement>(".cm6-table-editor");
    assert.equal(wrappers.length, 2);
    const editor = harness.parent.querySelector<HTMLTextAreaElement>(".cm-table-overlay-input");
    assert.ok(editor);

    dispatchKey(wrappers[0], "Enter");
    await flushEditorUpdates();
    editor.value = "first-only";
    dispatchKey(editor, "Enter");
    await flushEditorUpdates();

    const doc = harness.getDoc();
    assert.equal(doc.includes("| first-only | 2 |"), true);
    assert.equal(doc.includes("| 9 | 8 |"), true);
  } finally {
    harness.teardown();
  }
});
