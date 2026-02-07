import { syntaxTree } from "@codemirror/language";
import {
  Annotation,
  RangeSetBuilder,
  StateField,
  type EditorState,
  type Extension,
} from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  WidgetType,
} from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import type { TableAlignment, TableData } from "./types";
import {
  cloneTableData,
  deleteColumnAt,
  deleteRowAt,
  ensureHeader,
  getColumnCount,
  insertColumnAt,
  insertRowAt,
  normalizeTableData,
} from "./tableModel";
import {
  buildTableMarkdown,
  parseAlignmentsFromLines,
  toDisplayText,
  toMarkdownText,
} from "./tableMarkdown";

export type { TableAlignment, TableData };

export type TableEditorOptions = {
  enabled?: boolean;
  renderMode?: "widget" | "none";
};

type TableInfo = {
  id: number;
  from: number;
  to: number;
  startLineFrom: number;
  endLineTo: number;
  startLineNumber: number;
  endLineNumber: number;
};

type CellSelection = {
  kind: "cell";
  row: number;
  col: number;
};

type RowSelection = {
  kind: "row";
  row: number;
};

type ColumnSelection = {
  kind: "column";
  col: number;
};

type SelectionState = CellSelection | RowSelection | ColumnSelection;

type MenuState =
  | {
      kind: "row" | "column";
      index: number;
    }
  | null;

const tableEditAnnotation = Annotation.define<boolean>();
const defaultOptions: Required<TableEditorOptions> = {
  enabled: true,
  renderMode: "widget",
};

const toCssTextAlign = (alignment: TableAlignment | null) => {
  switch (alignment) {
    case "center":
      return "center";
    case "right":
      return "right";
    default:
      return "left";
  }
};

class TableWidget extends WidgetType {
  private readonly abortController = new AbortController();
  private static readonly selectionByTableId = new Map<number, SelectionState>();

  constructor(private readonly data: TableData, private readonly tableInfo: TableInfo) {
    super();
  }

  eq(other: TableWidget): boolean {
    return (
      this.tableInfo.id === other.tableInfo.id &&
      JSON.stringify(this.data) === JSON.stringify(other.data)
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "cm-table-editor cm-table-editor-notion";
    wrapper.dataset.tableId = String(this.tableInfo.id);
    wrapper.dataset.mode = "nav";
    wrapper.tabIndex = 0;

    const scrollArea = document.createElement("div");
    scrollArea.className = "cm-table-scroll";

    const table = document.createElement("table");
    table.className = "cm-table";
    scrollArea.appendChild(table);

    const menu = document.createElement("div");
    menu.className = "cm-table-context-menu";

    const editor = document.createElement("textarea");
    editor.className = "cm-table-overlay-input";
    editor.dataset.open = "false";
    editor.rows = 1;

    wrapper.appendChild(scrollArea);
    wrapper.appendChild(menu);
    wrapper.appendChild(editor);

    const data = cloneTableData(this.data);
    normalizeTableData(data);
    const columnCount = Math.max(1, getColumnCount(data));
    ensureHeader(data, columnCount);

    const signal = this.abortController.signal;
    const cellElements: HTMLTableCellElement[][] = [];
    const contentElements: HTMLDivElement[][] = [];
    const rowHandleButtons: HTMLButtonElement[] = [];
    const columnHandleButtons: HTMLButtonElement[] = [];

    let selection: SelectionState | null = null;
    let menuState: MenuState = null;
    let isEditing = false;
    let isComposing = false;

    const getTotalRows = () => data.rows.length + 1;

    const clampCell = (nextRow: number, nextCol: number): CellSelection => {
      const row = Math.min(Math.max(nextRow, 0), getTotalRows() - 1);
      const col = Math.min(Math.max(nextCol, 0), columnCount - 1);
      return { kind: "cell", row, col };
    };

    const getCellText = (cell: CellSelection): string => {
      if (cell.row === 0) {
        return data.header?.cells[cell.col]?.text ?? "";
      }
      return data.rows[cell.row - 1]?.cells[cell.col]?.text ?? "";
    };

    const setCellText = (cell: CellSelection, value: string) => {
      if (cell.row === 0) {
        if (data.header) {
          data.header.cells[cell.col] = {
            ...(data.header.cells[cell.col] ?? { from: -1, to: -1 }),
            text: value,
          };
        }
        return;
      }
      const targetRow = data.rows[cell.row - 1];
      if (!targetRow) {
        return;
      }
      targetRow.cells[cell.col] = {
        ...(targetRow.cells[cell.col] ?? { from: -1, to: -1 }),
        text: value,
      };
    };

    const updateCellDisplay = (cell: CellSelection) => {
      const content = contentElements[cell.row]?.[cell.col];
      const cellElement = cellElements[cell.row]?.[cell.col];
      if (!content || !cellElement) {
        return;
      }
      const raw = getCellText(cell);
      content.textContent = toDisplayText(raw);
      const alignment = data.alignments[cell.col] ?? null;
      cellElement.style.textAlign = toCssTextAlign(alignment);
    };

    const dispatchCommit = () => {
      normalizeTableData(data);
      const doc = view.state.doc;
      const startLine = doc.line(this.tableInfo.startLineNumber);
      const endLine = doc.line(this.tableInfo.endLineNumber);
      const startLineFrom = startLine.from;
      const endLineTo = endLine.to;
      let suffix = "";
      for (let pos = endLineTo; pos < doc.length; pos += 1) {
        const char = doc.sliceString(pos, pos + 1);
        if (char !== "\n") {
          break;
        }
        suffix += "\n";
      }
      const markdown = `${buildTableMarkdown(data)}${suffix}`;
      dispatchOutsideUpdate(view, {
        changes: {
          from: startLineFrom,
          to: endLineTo + suffix.length,
          insert: markdown,
        },
        annotations: tableEditAnnotation.of(true),
      });
    };

    const closeMenu = () => {
      menu.innerHTML = "";
      menu.dataset.open = "false";
      menuState = null;
    };

    const applySelectionClasses = () => {
      cellElements.forEach((rowCells) => {
        rowCells.forEach((cell) => {
          cell.classList.remove(
            "cm-table-cell-selected",
            "cm-table-row-selected",
            "cm-table-column-selected"
          );
        });
      });
      rowHandleButtons.forEach((button) => button.removeAttribute("data-selected"));
      columnHandleButtons.forEach((button) => button.removeAttribute("data-selected"));

      if (!selection) {
        wrapper.removeAttribute("data-selection");
        return;
      }

      wrapper.dataset.selection = selection.kind;
      if (selection.kind === "cell") {
        cellElements[selection.row]?.[selection.col]?.classList.add("cm-table-cell-selected");
        return;
      }
      if (selection.kind === "row") {
        const tableRowIndex = selection.row + 1;
        cellElements[tableRowIndex]?.forEach((cell) =>
          cell.classList.add("cm-table-row-selected")
        );
        rowHandleButtons[selection.row]?.setAttribute("data-selected", "true");
        return;
      }
      for (let row = 0; row < getTotalRows(); row += 1) {
        cellElements[row]?.[selection.col]?.classList.add("cm-table-column-selected");
      }
      columnHandleButtons[selection.col]?.setAttribute("data-selected", "true");
    };

    const setSelection = (next: SelectionState, focusWrapper = true) => {
      selection = next;
      TableWidget.selectionByTableId.set(this.tableInfo.id, next);
      applySelectionClasses();
      if (focusWrapper && !isEditing) {
        wrapper.focus({ preventScroll: true });
      }
    };

    const ensureCellSelection = (): CellSelection => {
      if (!selection) {
        const fallbackRow = data.rows.length > 0 ? 1 : 0;
        const next = clampCell(fallbackRow, 0);
        setSelection(next, false);
        return next;
      }
      if (selection.kind === "cell") {
        return clampCell(selection.row, selection.col);
      }
      if (selection.kind === "row") {
        return clampCell(selection.row + 1, 0);
      }
      return clampCell(data.rows.length > 0 ? 1 : 0, selection.col);
    };

    const positionEditor = (cell: CellSelection) => {
      const anchor = cellElements[cell.row]?.[cell.col];
      if (!anchor) {
        return;
      }
      const anchorRect = anchor.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();
      const padding = 1;
      editor.style.left = `${anchorRect.left - wrapperRect.left + padding}px`;
      editor.style.top = `${anchorRect.top - wrapperRect.top + padding}px`;
      editor.style.width = `${Math.max(48, anchorRect.width - padding * 2)}px`;
      editor.style.height = `${Math.max(26, anchorRect.height - padding * 2)}px`;
      editor.style.textAlign = toCssTextAlign(data.alignments[cell.col] ?? null);
    };

    const stopEditing = (commit: boolean, nextSelection: CellSelection | null = null) => {
      if (!isEditing) {
        return;
      }
      const current = selection && selection.kind === "cell" ? selection : null;
      if (commit && current) {
        setCellText(current, toMarkdownText(editor.value));
        updateCellDisplay(current);
        dispatchCommit();
      }
      isEditing = false;
      wrapper.dataset.mode = "nav";
      editor.dataset.open = "false";
      editor.style.left = "-9999px";
      editor.style.top = "-9999px";
      if (nextSelection) {
        setSelection(nextSelection, false);
      }
      wrapper.focus({ preventScroll: true });
    };

    const startEditing = (cell: CellSelection) => {
      closeMenu();
      setSelection(cell, false);
      isEditing = true;
      wrapper.dataset.mode = "edit";
      editor.dataset.open = "true";
      const modelValue = toDisplayText(getCellText(cell));
      const displayedValue = contentElements[cell.row]?.[cell.col]?.textContent ?? "";
      editor.value = modelValue.length > 0 ? modelValue : displayedValue;
      positionEditor(cell);
      requestAnimationFrame(() => {
        editor.focus({ preventScroll: true });
        const len = editor.value.length;
        editor.setSelectionRange(len, len);
      });
    };

    const openContextMenu = (
      kind: "row" | "column",
      index: number,
      clientX: number,
      clientY: number
    ) => {
      closeMenu();
      const items =
        kind === "row"
          ? [
              { label: "Insert row above", action: () => insertRowAt(data, index) },
              { label: "Insert row below", action: () => insertRowAt(data, index + 1) },
              { label: "Delete row", action: () => deleteRowAt(data, index) },
            ]
          : [
              { label: "Insert column left", action: () => insertColumnAt(data, index) },
              { label: "Insert column right", action: () => insertColumnAt(data, index + 1) },
              { label: "Delete column", action: () => deleteColumnAt(data, index) },
            ];

      items.forEach((item) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "cm-table-context-menu-item";
        button.textContent = item.label;
        button.addEventListener(
          "click",
          (event) => {
            event.preventDefault();
            event.stopPropagation();
            item.action();
            closeMenu();
            dispatchCommit();
          },
          { signal }
        );
        menu.appendChild(button);
      });

      const rect = wrapper.getBoundingClientRect();
      menu.style.left = `${clientX - rect.left}px`;
      menu.style.top = `${clientY - rect.top}px`;
      menu.dataset.open = "true";
      menuState = { kind, index };
    };

    const isSelectedContextTarget = (cell: CellSelection) => {
      if (!selection) {
        return null;
      }
      if (selection.kind === "row" && cell.row > 0 && cell.row - 1 === selection.row) {
        return { kind: "row" as const, index: selection.row };
      }
      if (selection.kind === "column" && cell.col === selection.col) {
        return { kind: "column" as const, index: selection.col };
      }
      return null;
    };

    const thead = document.createElement("thead");
    const headerTr = document.createElement("tr");
    headerTr.className = "cm-table-row cm-table-row-header";
    const headerRowCells: HTMLTableCellElement[] = [];
    const headerRowContents: HTMLDivElement[] = [];

    for (let col = 0; col < columnCount; col += 1) {
      const th = document.createElement("th");
      th.className = "cm-table-cell cm-table-header-cell";
      th.dataset.row = "0";
      th.dataset.col = String(col);
      th.style.textAlign = toCssTextAlign(data.alignments[col] ?? null);

      const content = document.createElement("div");
      content.className = "cm-table-cell-content";
      content.textContent = toDisplayText(data.header?.cells[col]?.text ?? `Col ${col + 1}`);

      const handle = document.createElement("button");
      handle.type = "button";
      handle.className = "cm-table-col-handle";
      handle.tabIndex = -1;
      handle.setAttribute("aria-label", `Select column ${col + 1}`);
      handle.addEventListener(
        "mousedown",
        (event) => {
          event.preventDefault();
        },
        { signal }
      );
      handle.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          event.stopPropagation();
          stopEditing(true);
          setSelection({ kind: "column", col });
        },
        { signal }
      );
      handle.addEventListener(
        "contextmenu",
        (event) => {
          event.preventDefault();
          event.stopPropagation();
          stopEditing(true);
          setSelection({ kind: "column", col });
          openContextMenu("column", col, event.clientX, event.clientY);
        },
        { signal }
      );

      th.appendChild(handle);
      th.appendChild(content);
      headerTr.appendChild(th);

      headerRowCells.push(th);
      headerRowContents.push(content);
      columnHandleButtons.push(handle);
    }

    cellElements.push(headerRowCells);
    contentElements.push(headerRowContents);
    thead.appendChild(headerTr);

    const tbody = document.createElement("tbody");
    data.rows.forEach((row, rowIndex) => {
      const tr = document.createElement("tr");
      tr.className = "cm-table-row";
      const rowCells: HTMLTableCellElement[] = [];
      const rowContents: HTMLDivElement[] = [];

      for (let col = 0; col < columnCount; col += 1) {
        const td = document.createElement("td");
        td.className = `cm-table-cell${col === 0 ? " cm-table-cell--first" : ""}`;
        td.dataset.row = String(rowIndex + 1);
        td.dataset.col = String(col);
        td.style.textAlign = toCssTextAlign(data.alignments[col] ?? null);

        const content = document.createElement("div");
        content.className = "cm-table-cell-content";
        content.textContent = toDisplayText(row.cells[col]?.text ?? "");
        td.appendChild(content);

        if (col === 0) {
          const handle = document.createElement("button");
          handle.type = "button";
          handle.className = "cm-table-row-handle";
          handle.tabIndex = -1;
          handle.setAttribute("aria-label", `Select row ${rowIndex + 1}`);
          handle.addEventListener(
            "mousedown",
            (event) => {
              event.preventDefault();
            },
            { signal }
          );
          handle.addEventListener(
            "click",
            (event) => {
              event.preventDefault();
              event.stopPropagation();
              stopEditing(true);
              setSelection({ kind: "row", row: rowIndex });
            },
            { signal }
          );
          handle.addEventListener(
            "contextmenu",
            (event) => {
              event.preventDefault();
              event.stopPropagation();
              stopEditing(true);
              setSelection({ kind: "row", row: rowIndex });
              openContextMenu("row", rowIndex, event.clientX, event.clientY);
            },
            { signal }
          );
          td.appendChild(handle);
          rowHandleButtons[rowIndex] = handle;
        }

        tr.appendChild(td);
        rowCells.push(td);
        rowContents.push(content);
      }

      tbody.appendChild(tr);
      cellElements.push(rowCells);
      contentElements.push(rowContents);
    });

    table.appendChild(thead);
    table.appendChild(tbody);

    const moveCellByOffset = (current: CellSelection, delta: number): CellSelection => {
      const totalCells = getTotalRows() * columnCount;
      const flat = current.row * columnCount + current.col;
      const nextFlat = (flat + delta + totalCells) % totalCells;
      const nextRow = Math.floor(nextFlat / columnCount);
      const nextCol = nextFlat % columnCount;
      return { kind: "cell", row: nextRow, col: nextCol };
    };

    wrapper.addEventListener(
      "pointerdown",
      (event) => {
        const target = event.target;
        if (!(target instanceof Element)) {
          return;
        }
        if (target.closest(".cm-table-context-menu")) {
          return;
        }
        if (isEditing) {
          stopEditing(true);
        }
        const cell = target.closest<HTMLTableCellElement>(".cm-table-cell");
        if (!cell) {
          closeMenu();
          return;
        }
        const row = Number(cell.dataset.row);
        const col = Number(cell.dataset.col);
        if (!Number.isFinite(row) || !Number.isFinite(col)) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        closeMenu();
        setSelection({ kind: "cell", row, col });
      },
      { signal }
    );

    wrapper.addEventListener(
      "dblclick",
      (event) => {
        const target = event.target;
        if (!(target instanceof Element)) {
          return;
        }
        const cell = target.closest<HTMLTableCellElement>(".cm-table-cell");
        if (!cell) {
          return;
        }
        const row = Number(cell.dataset.row);
        const col = Number(cell.dataset.col);
        if (!Number.isFinite(row) || !Number.isFinite(col)) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        startEditing({ kind: "cell", row, col });
      },
      { signal }
    );

    wrapper.addEventListener(
      "contextmenu",
      (event) => {
        const target = event.target;
        if (!(target instanceof Element)) {
          return;
        }
        if (target.closest(".cm-table-context-menu")) {
          return;
        }
        const cellEl = target.closest<HTMLTableCellElement>(".cm-table-cell");
        if (!cellEl) {
          closeMenu();
          return;
        }
        const row = Number(cellEl.dataset.row);
        const col = Number(cellEl.dataset.col);
        if (!Number.isFinite(row) || !Number.isFinite(col)) {
          return;
        }
        const hit = isSelectedContextTarget({ kind: "cell", row, col });
        if (!hit) {
          closeMenu();
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        stopEditing(true);
        openContextMenu(hit.kind, hit.index, event.clientX, event.clientY);
      },
      { signal }
    );

    wrapper.addEventListener(
      "keydown",
      (event) => {
        if (isEditing) {
          return;
        }
        if (event.isComposing) {
          return;
        }
        let active = ensureCellSelection();
        let next: CellSelection | null = null;

        switch (event.key) {
          case "ArrowUp":
            next = clampCell(active.row - 1, active.col);
            break;
          case "ArrowDown":
            next = clampCell(active.row + 1, active.col);
            break;
          case "ArrowLeft":
            next = clampCell(active.row, active.col - 1);
            break;
          case "ArrowRight":
            next = clampCell(active.row, active.col + 1);
            break;
          case "Tab":
            next = moveCellByOffset(active, event.shiftKey ? -1 : 1);
            break;
          case "Enter":
          case "F2":
            event.preventDefault();
            event.stopPropagation();
            startEditing(active);
            return;
          default:
            return;
        }

        if (next) {
          event.preventDefault();
          event.stopPropagation();
          closeMenu();
          setSelection(next, false);
        }
      },
      { signal }
    );

    editor.addEventListener(
      "compositionstart",
      () => {
        isComposing = true;
      },
      { signal }
    );
    editor.addEventListener(
      "compositionend",
      () => {
        isComposing = false;
      },
      { signal }
    );

    editor.addEventListener(
      "keydown",
      (event) => {
        if (!isEditing || !selection || selection.kind !== "cell") {
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          stopEditing(false);
          return;
        }
        if (event.key === "Tab") {
          event.preventDefault();
          event.stopPropagation();
          const next = moveCellByOffset(selection, event.shiftKey ? -1 : 1);
          stopEditing(true, next);
          return;
        }
        if (event.key === "Enter" && !event.shiftKey) {
          if (isComposing || event.isComposing) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          stopEditing(true);
        }
      },
      { signal }
    );

    editor.addEventListener(
      "blur",
      (event) => {
        if (!isEditing) {
          return;
        }
        const related = event.relatedTarget;
        if (related instanceof Node && wrapper.contains(related)) {
          return;
        }
        stopEditing(true);
      },
      { signal }
    );

    scrollArea.addEventListener(
      "scroll",
      () => {
        if (isEditing && selection && selection.kind === "cell") {
          positionEditor(selection);
        }
        if (menuState) {
          closeMenu();
        }
      },
      { signal, passive: true }
    );

    window.addEventListener(
      "resize",
      () => {
        if (isEditing && selection && selection.kind === "cell") {
          positionEditor(selection);
        }
      },
      { signal }
    );

    document.addEventListener(
      "pointerdown",
      (event) => {
        const target = event.target;
        if (!(target instanceof Node) || !wrapper.contains(target)) {
          closeMenu();
        }
      },
      { signal, capture: true }
    );

    wrapper.addEventListener(
      "focusout",
      (event) => {
        const related = event.relatedTarget;
        if (related instanceof Node && wrapper.contains(related)) {
          return;
        }
        if (!isEditing) {
          selection = null;
          applySelectionClasses();
        }
      },
      { signal }
    );

    const cached = TableWidget.selectionByTableId.get(this.tableInfo.id);
    if (cached) {
      setSelection(cached, false);
    } else {
      setSelection({ kind: "cell", row: data.rows.length > 0 ? 1 : 0, col: 0 }, false);
    }

    return wrapper;
  }

  ignoreEvent(): boolean {
    return true;
  }

  destroy(): void {
    this.abortController.abort();
  }
}

function dispatchOutsideUpdate(
  view: EditorView,
  transaction: {
    changes: { from: number; to: number; insert: string };
    annotations: Annotation<unknown>;
  }
) {
  const dispatch = () => {
    const scrollTop = view.scrollDOM.scrollTop;
    const scrollLeft = view.scrollDOM.scrollLeft;
    view.dispatch({ ...transaction, scrollIntoView: false });
    requestAnimationFrame(() => {
      view.scrollDOM.scrollTop = scrollTop;
      view.scrollDOM.scrollLeft = scrollLeft;
    });
  };

  if (typeof view.requestMeasure === "function") {
    view.requestMeasure({ read() {}, write: dispatch });
    return;
  }

  setTimeout(dispatch, 0);
}

function collectTableData(
  state: EditorState,
  node: SyntaxNode,
  lines: ReturnType<typeof collectTableLines>
): TableData {
  const headerNode = node.getChild("TableHeader");
  const rowNodes = node.getChildren("TableRow");
  const header = headerNode ? { cells: collectCells(state, headerNode) } : null;
  const rows = rowNodes.map((row) => ({ cells: collectCells(state, row) }));
  const columnCount = Math.max(
    header?.cells.length ?? 0,
    ...rows.map((row) => row.cells.length),
    0
  );
  const alignments = parseAlignmentsFromLines(lines.map((line) => line.text), columnCount);
  return { header, rows, alignments };
}

function collectTableLines(state: EditorState, from: number, to: number) {
  const lines = [];
  const startLine = state.doc.lineAt(from);
  const endLine = state.doc.lineAt(Math.max(from, to - 1));
  for (let lineNumber = startLine.number; lineNumber <= endLine.number; lineNumber += 1) {
    lines.push(state.doc.line(lineNumber));
  }
  while (lines.length > 0 && lines[lines.length - 1].text.trim() === "") {
    lines.pop();
  }
  return lines;
}

function collectCells(
  state: EditorState,
  rowNode: SyntaxNode
): Array<{ text: string; from: number; to: number }> {
  const cells: Array<{ text: string; from: number; to: number }> = [];
  for (let child = rowNode.firstChild; child; child = child.nextSibling) {
    if (child.name === "TableCell") {
      cells.push({
        text: state.doc.sliceString(child.from, child.to).trim(),
        from: child.from,
        to: child.to,
      });
    }
  }
  return cells;
}

function buildDecorations(
  state: EditorState,
  options: Required<TableEditorOptions>
): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  if (!options.enabled || options.renderMode !== "widget") {
    return builder.finish();
  }

  let tableId = 0;

  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name !== "Table") {
        return;
      }

      const lines = collectTableLines(state, node.from, node.to);
      if (lines.length === 0) {
        return;
      }

      const data = collectTableData(state, node.node, lines);
      const firstLine = lines[0];
      const lastLine = lines[lines.length - 1];

      const info: TableInfo = {
        id: tableId,
        from: node.from,
        to: node.to,
        startLineFrom: firstLine.from,
        endLineTo: lastLine.to,
        startLineNumber: firstLine.number,
        endLineNumber: lastLine.number,
      };

      builder.add(
        firstLine.from,
        firstLine.from,
        Decoration.widget({
          widget: new TableWidget(data, info),
          block: true,
        })
      );

      const hiddenLineDecoration = Decoration.line({ class: "cm-table-editor-hidden" });
      for (const line of lines) {
        builder.add(line.from, line.from, hiddenLineDecoration);
      }

      tableId += 1;
    },
  });

  return builder.finish();
}

export function tableEditor(options: TableEditorOptions = {}): Extension {
  const resolved = { ...defaultOptions, ...options };

  const theme = EditorView.baseTheme({
    ".cm-content .cm-line.cm-table-editor-hidden": {
      display: "none",
    },
    ".cm-content .cm-table-editor-notion": {
      margin: "0.5rem 0",
      position: "relative",
    },
    ".cm-content .cm-table-editor-notion:focus, .cm-content .cm-table-editor-notion:focus-visible":
      {
        outline: "none",
      },
    ".cm-content .cm-table-editor-notion .cm-table-scroll": {
      overflowX: "auto",
      border: "1px solid color-mix(in srgb, var(--editor-border, #dadce0) 80%, transparent)",
      borderRadius: "0",
      background: "var(--editor-bg, #fff)",
    },
    ".cm-content .cm-table-editor-notion table.cm-table": {
      width: "100%",
      minWidth: "360px",
      borderCollapse: "collapse",
      tableLayout: "fixed",
      background: "var(--editor-bg, #fff)",
    },
    ".cm-content .cm-table-editor-notion .cm-table-row": {
      background: "var(--editor-bg, #fff)",
    },
    ".cm-content .cm-table-editor-notion .cm-table-header-cell": {
      background: "color-mix(in srgb, var(--editor-bg, #fff) 92%, var(--editor-border, #dadce0))",
      color: "var(--editor-secondary-color, #5f6368)",
      fontWeight: "600",
      position: "relative",
    },
    ".cm-content .cm-table-editor-notion .cm-table-cell": {
      borderBottom: "1px solid color-mix(in srgb, var(--editor-border, #dadce0) 70%, transparent)",
      borderRight: "1px solid color-mix(in srgb, var(--editor-border, #dadce0) 70%, transparent)",
      padding: "9px 10px",
      minHeight: "36px",
      verticalAlign: "middle",
      position: "relative",
      color: "var(--editor-foreground, #202124)",
      overflow: "visible",
    },
    ".cm-content .cm-table-editor-notion .cm-table-cell-content": {
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      lineHeight: "1.35",
    },
    ".cm-content .cm-table-editor-notion .cm-table-cell--first": {
      paddingLeft: "10px",
    },
    ".cm-content .cm-table-editor-notion .cm-table-cell-selected": {
      boxShadow: "inset 0 0 0 2px var(--editor-primary-color, #1a73e8)",
      background: "color-mix(in srgb, var(--editor-primary-color, #1a73e8) 12%, var(--editor-bg, #fff))",
    },
    ".cm-content .cm-table-editor-notion .cm-table-row-selected": {
      boxShadow: "inset 0 0 0 2px var(--editor-primary-color, #1a73e8)",
      background: "color-mix(in srgb, var(--editor-primary-color, #1a73e8) 9%, var(--editor-bg, #fff))",
    },
    ".cm-content .cm-table-editor-notion .cm-table-column-selected": {
      boxShadow: "inset 0 0 0 2px var(--editor-primary-color, #1a73e8)",
      background: "color-mix(in srgb, var(--editor-primary-color, #1a73e8) 9%, var(--editor-bg, #fff))",
    },
    ".cm-content .cm-table-editor-notion .cm-table-col-handle": {
      position: "absolute",
      top: "0",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: "16px",
      height: "10px",
      padding: "0",
      border: "none",
      background: "transparent",
      opacity: "0",
      cursor: "pointer",
    },
    ".cm-content .cm-table-editor-notion .cm-table-col-handle::before": {
      content: '""',
      display: "block",
      width: "10px",
      height: "2px",
      margin: "4px auto 0",
      borderRadius: "999px",
      background:
        "color-mix(in srgb, var(--editor-secondary-color, #5f6368) 70%, var(--editor-bg, #fff))",
    },
    ".cm-content .cm-table-editor-notion .cm-table-header-cell:hover .cm-table-col-handle, .cm-content .cm-table-editor-notion .cm-table-col-handle[data-selected='true']": {
      opacity: "0.95",
    },
    ".cm-content .cm-table-editor-notion .cm-table-row-handle": {
      position: "absolute",
      left: "0",
      top: "50%",
      transform: "translate(-50%, -50%)",
      width: "10px",
      height: "16px",
      padding: "0",
      border: "none",
      background: "var(--editor-bg, #fff)",
      opacity: "0",
      cursor: "pointer",
    },
    ".cm-content .cm-table-editor-notion .cm-table-row-handle::before": {
      content: '""',
      display: "block",
      width: "2px",
      height: "10px",
      margin: "3px 0 0 4px",
      borderRadius: "999px",
      background:
        "color-mix(in srgb, var(--editor-secondary-color, #5f6368) 70%, var(--editor-bg, #fff))",
    },
    ".cm-content .cm-table-editor-notion .cm-table-row:hover .cm-table-row-handle, .cm-content .cm-table-editor-notion .cm-table-row-handle[data-selected='true']": {
      opacity: "1",
    },
    ".cm-content .cm-table-editor-notion .cm-table-context-menu": {
      position: "absolute",
      minWidth: "164px",
      background: "var(--editor-bg, #fff)",
      border: "1px solid color-mix(in srgb, var(--editor-border, #dadce0) 88%, transparent)",
      borderRadius: "8px",
      boxShadow: "0 12px 24px rgba(0, 0, 0, 0.14)",
      padding: "6px",
      zIndex: "30",
      display: "none",
    },
    ".cm-content .cm-table-editor-notion .cm-table-context-menu[data-open='true']": {
      display: "grid",
      gap: "4px",
    },
    ".cm-content .cm-table-editor-notion .cm-table-context-menu-item": {
      border: "none",
      background: "transparent",
      color: "var(--editor-foreground, #202124)",
      borderRadius: "6px",
      textAlign: "left",
      padding: "6px 8px",
      cursor: "pointer",
      font: "inherit",
      fontSize: "12px",
    },
    ".cm-content .cm-table-editor-notion .cm-table-context-menu-item:hover": {
      background:
        "color-mix(in srgb, var(--editor-bg, #fff) 86%, var(--editor-border, #dadce0))",
    },
    ".cm-content .cm-table-editor-notion .cm-table-overlay-input": {
      position: "absolute",
      zIndex: "20",
      resize: "none",
      border: "1px solid var(--editor-primary-color, #1a73e8)",
      borderRadius: "4px",
      outline: "none",
      margin: "0",
      padding: "7px 9px",
      background: "var(--editor-bg, #fff)",
      color: "var(--editor-foreground, #202124)",
      font: "inherit",
      lineHeight: "1.35",
      boxSizing: "border-box",
      display: "none",
    },
    ".cm-content .cm-table-editor-notion .cm-table-overlay-input[data-open='true']": {
      display: "block",
    },
  });

  const decorations = StateField.define<DecorationSet>({
    create(state) {
      return buildDecorations(state, resolved);
    },
    update(_decorations, tr) {
      return buildDecorations(tr.state, resolved);
    },
    provide: (field) => EditorView.decorations.from(field),
  });

  return [theme, decorations];
}

export * from "./types";
export * from "./tableModel";
export * from "./tableMarkdown";
