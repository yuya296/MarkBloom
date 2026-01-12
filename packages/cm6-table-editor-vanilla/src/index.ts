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
  reorderColumns,
  reorderRows,
  setColumnAlignment,
} from "./tableModel";
import {
  buildTableMarkdown,
  parseAlignmentsFromLines,
  toDisplayText,
  toMarkdownText,
} from "./tableMarkdown";
import {
  getDropIndexByX,
  getDropIndexByY,
  isWithinBounds,
  isWithinVerticalRange,
} from "./geometry";
import { createActionMenu } from "./actionMenu";

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
};

const tableEditAnnotation = Annotation.define<boolean>();
const defaultOptions: Required<TableEditorOptions> = {
  enabled: true,
  renderMode: "widget",
};

class TableWidget extends WidgetType {
  private readonly menuAbort = new AbortController();

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
    wrapper.className = "cm-table-editor cm-table-editor-vanilla";
    wrapper.dataset.tableId = String(this.tableInfo.id);

    const data = cloneTableData(this.data);
    const table = document.createElement("table");
    table.className = "cm-table";

    const scrollArea = document.createElement("div");
    scrollArea.className = "cm-table-scroll";
    const rowActions = document.createElement("div");
    rowActions.className = "cm-table-row-actions";
    const rowDropIndicator = document.createElement("div");
    rowDropIndicator.className = "cm-table-row-drop-indicator";
    const columnHandles = document.createElement("div");
    columnHandles.className = "cm-table-column-handles";
    const columnDropIndicator = document.createElement("div");
    columnDropIndicator.className = "cm-table-column-drop-indicator";

    let scheduleRowActionLayout: () => void = () => {};
    let scheduleColumnHandleLayout: () => void = () => {};
    let dragSourceIndex: number | null = null;
    let dragTargetIndex: number | null = null;
    let dragSourceColumnIndex: number | null = null;
    let dragTargetColumnIndex: number | null = null;
    const actionMenus: Array<{ close: () => void }> = [];

    const closeAllMenus = () => {
      actionMenus.forEach((menu) => menu.close());
    };

    wrapper.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (!target.closest(".cm-table-action")) {
        closeAllMenus();
      }
    });

    const closeOnScroll = () => {
      closeAllMenus();
      scheduleRowActionLayout();
      scheduleColumnHandleLayout();
    };

    const signal = this.menuAbort.signal;
    view.scrollDOM.addEventListener("scroll", closeOnScroll, { passive: true, signal });
    window.addEventListener("scroll", closeOnScroll, { passive: true, signal });
    window.addEventListener("resize", closeOnScroll, { signal });

    const commitTable = () => {
      normalizeTableData(data);
      const markdown = buildTableMarkdown(data);
      dispatchOutsideUpdate(view, {
        changes: {
          from: this.tableInfo.startLineFrom,
          to: this.tableInfo.endLineTo,
          insert: markdown,
        },
        annotations: tableEditAnnotation.of(true),
      });
    };

    const createCellEditor = (
      initialValue: string,
      alignment: TableAlignment | null,
      onChange: (value: string) => void,
      onCommit: (value: string) => void
    ): HTMLTextAreaElement => {
      const input = document.createElement("textarea");
      input.className = "cm-table-input";
      input.style.textAlign = toCssTextAlign(alignment);
      input.rows = 1;
      input.value = toDisplayText(initialValue);
      const resizeToContent = () => {
        input.style.height = "0px";
        input.style.height = `${input.scrollHeight}px`;
      };
      resizeToContent();
      requestAnimationFrame(resizeToContent);
      let committed = false;
      const commit = () => {
        if (committed) {
          return;
        }
        committed = true;
        onCommit(input.value);
      };
      input.addEventListener("input", () => {
        onChange(input.value);
        resizeToContent();
        scheduleRowActionLayout();
        scheduleColumnHandleLayout();
      });
      input.addEventListener("focus", resizeToContent);
      input.addEventListener("blur", (event) => {
        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof Node && wrapper.contains(nextTarget)) {
          committed = false;
          return;
        }
        commit();
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Tab") {
          event.preventDefault();
          const inputs = Array.from(
            wrapper.querySelectorAll<HTMLTextAreaElement>("textarea.cm-table-input")
          );
          const currentIndex = inputs.indexOf(input);
          if (currentIndex !== -1) {
            const direction = event.shiftKey ? -1 : 1;
            const nextIndex =
              (currentIndex + direction + inputs.length) % inputs.length;
            inputs[nextIndex]?.focus();
          }
          return;
        }
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          commit();
        }
      });
      return input;
    };

    const insertRow = (index: number) => {
      insertRowAt(data, index);
      commitTable();
    };

    const deleteRow = (index: number) => {
      deleteRowAt(data, index);
      commitTable();
    };

    const insertColumn = (index: number) => {
      insertColumnAt(data, index);
      commitTable();
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

    const deleteColumn = (index: number) => {
      deleteColumnAt(data, index);
      commitTable();
    };

    const applyColumnAlignment = (index: number, alignment: TableAlignment) => {
      setColumnAlignment(data, index, alignment);
      const cssAlign = toCssTextAlign(alignment);
      wrapper
        .querySelectorAll<HTMLElement>(`[data-col-index="${index}"]`)
        .forEach((cell) => {
          cell.style.textAlign = cssAlign;
          const input = cell.querySelector<HTMLTextAreaElement>("textarea.cm-table-input");
          if (input) {
            input.style.textAlign = cssAlign;
          }
        });
      commitTable();
    };


    const rowElements: HTMLTableRowElement[] = [];
    const headerCells: HTMLTableCellElement[] = [];
    let rowActionLayoutPending = false;
    const positionRowActions = () => {
      if (rowElements.length === 0) {
        return;
      }
      rowElements.forEach((rowElement, index) => {
        const rowRect = rowElement.getBoundingClientRect();
        const menu = rowActions.children[index];
        if (!(menu instanceof HTMLElement)) {
          return;
        }
        const menuHeight = menu.getBoundingClientRect().height;
        const top = rowRect.top + Math.max(0, (rowRect.height - menuHeight) / 2);
        const left = rowRect.left - 22;
        menu.style.top = `${top}px`;
        menu.style.left = `${left}px`;
        menu.style.transform = "none";
      });
    };
    scheduleRowActionLayout = () => {
      if (rowActionLayoutPending) {
        return;
      }
      rowActionLayoutPending = true;
      requestAnimationFrame(() => {
        rowActionLayoutPending = false;
        positionRowActions();
      });
    };

    let columnHandleLayoutPending = false;
    const positionColumnHandles = () => {
      if (headerCells.length === 0) {
        return;
      }
      headerCells.forEach((cell, index) => {
        const cellRect = cell.getBoundingClientRect();
        const action = columnHandles.children[index];
        if (!(action instanceof HTMLElement)) {
          return;
        }
        const button = action.querySelector<HTMLButtonElement>(".cm-table-action-button");
        const rect = button?.getBoundingClientRect() ?? action.getBoundingClientRect();
        const top = cellRect.top - rect.height + 2;
        const left = cellRect.left + (cellRect.width - rect.width) / 2;
        action.style.top = `${top}px`;
        action.style.left = `${left}px`;
      });
    };
    scheduleColumnHandleLayout = () => {
      if (columnHandleLayoutPending) {
        return;
      }
      columnHandleLayoutPending = true;
      requestAnimationFrame(() => {
        columnHandleLayoutPending = false;
        positionColumnHandles();
      });
    };

    const getRowRects = () =>
      rowElements.map((rowElement) => rowElement.getBoundingClientRect());
    const getHeaderRects = () =>
      headerCells.map((cell) => cell.getBoundingClientRect());

    const updateDropIndicator = (clientX: number, clientY: number) => {
      if (dragSourceIndex === null) {
        return;
      }
      const rowRects = getRowRects();
      const withinY = isWithinVerticalRange(rowRects, clientY);
      if (!withinY) {
        clearDropIndicator();
        return;
      }
      const dropIndex = getDropIndexByY(rowRects, clientY);
      dragTargetIndex = dropIndex;
      const referenceIndex = Math.min(dropIndex, rowElements.length - 1);
      const referenceRect = rowRects[referenceIndex];
      if (!referenceRect) {
        rowDropIndicator.style.display = "none";
        return;
      }
      const top =
        dropIndex >= rowRects.length ? referenceRect.bottom : referenceRect.top;
      rowDropIndicator.style.display = "block";
      rowDropIndicator.style.top = `${top}px`;
      rowDropIndicator.style.left = `${referenceRect.left}px`;
      rowDropIndicator.style.width = `${referenceRect.width}px`;
    };

    const clearDropIndicator = () => {
      rowDropIndicator.style.display = "none";
      dragTargetIndex = null;
    };

    const updateColumnDropIndicator = (clientX: number, clientY: number) => {
      if (dragSourceColumnIndex === null) {
        return;
      }
      const tableRect = table.getBoundingClientRect();
      const tolerance = 60;
      if (!isWithinBounds(tableRect, clientX, clientY, tolerance)) {
        clearColumnDropIndicator();
        return;
      }
      const headerRects = getHeaderRects();
      const dropIndex = getDropIndexByX(headerRects, clientX);
      dragTargetColumnIndex = dropIndex;
      const referenceIndex = Math.min(dropIndex, headerCells.length - 1);
      const referenceRect = headerRects[referenceIndex];
      if (!referenceRect) {
        columnDropIndicator.style.display = "none";
        return;
      }
      const left =
        dropIndex >= headerRects.length ? referenceRect.right : referenceRect.left;
      columnDropIndicator.style.display = "block";
      columnDropIndicator.style.top = `${tableRect.top}px`;
      columnDropIndicator.style.left = `${left}px`;
      columnDropIndicator.style.height = `${tableRect.height}px`;
    };

    const clearColumnDropIndicator = () => {
      columnDropIndicator.style.display = "none";
      dragTargetColumnIndex = null;
    };

    const commitRowReorder = () => {
      if (dragSourceIndex === null || dragTargetIndex === null) {
        return;
      }
      reorderRows(data, dragSourceIndex, dragTargetIndex);
      commitTable();
    };

    const commitColumnReorder = () => {
      if (dragSourceColumnIndex === null || dragTargetColumnIndex === null) {
        return;
      }
      reorderColumns(data, dragSourceColumnIndex, dragTargetColumnIndex);
      commitTable();
    };

    const renderHeader = () => {
      const thead = document.createElement("thead");
      const row = document.createElement("tr");
      const columnCount = getColumnCount(data);
      ensureHeader(data, columnCount);
      const headerRow = data.header;
      if (!headerRow) {
        return thead;
      }
      headerRow.cells.forEach((cell, colIndex) => {
        const th = document.createElement("th");
        th.style.textAlign = toCssTextAlign(data.alignments[colIndex] ?? null);
        const input = createCellEditor(
          cell.text,
          data.alignments[colIndex] ?? null,
          (value) => {
            cell.text = toMarkdownText(value);
          },
          (value) => {
            cell.text = toMarkdownText(value);
            commitTable();
          }
        );
        th.appendChild(input);
        headerCells.push(th);
        th.dataset.colIndex = String(colIndex);
        row.appendChild(th);
      });
      thead.appendChild(row);
      return thead;
    };

    const renderBody = () => {
      const tbody = document.createElement("tbody");
      const columnCount = getColumnCount(data);
      data.rows.forEach((row, rowIndex) => {
        const tr = document.createElement("tr");
        for (let colIndex = 0; colIndex < columnCount; colIndex += 1) {
          const cell = row.cells[colIndex] ?? { text: "", from: -1, to: -1 };
          const td = document.createElement("td");
          td.style.textAlign = toCssTextAlign(data.alignments[colIndex] ?? null);
          const input = createCellEditor(
            cell.text,
            data.alignments[colIndex] ?? null,
            (value) => {
              cell.text = toMarkdownText(value);
              row.cells[colIndex] = cell;
            },
            (value) => {
              cell.text = toMarkdownText(value);
              row.cells[colIndex] = cell;
              commitTable();
            }
          );
          td.appendChild(input);
          td.dataset.rowIndex = String(rowIndex);
          td.dataset.colIndex = String(colIndex);
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
        rowElements.push(tr);
      });
      return tbody;
    };

    table.appendChild(renderHeader());
    table.appendChild(renderBody());

    scrollArea.appendChild(table);
    wrapper.appendChild(scrollArea);
    wrapper.appendChild(rowActions);

    const setActiveRowAction = (activeIndex: number | null) => {
      Array.from(rowActions.children).forEach((child, index) => {
        if (!(child instanceof HTMLElement)) {
          return;
        }
        if (activeIndex !== null && index === activeIndex) {
          child.dataset.active = "true";
        } else {
          child.removeAttribute("data-active");
        }
      });
    };

    rowElements.forEach((rowElement, rowIndex) => {
      const rowMenu = createActionMenu({
        items: [
          { label: "Insert row above", onSelect: () => insertRow(rowIndex) },
          { label: "Insert row below", onSelect: () => insertRow(rowIndex + 1) },
          { label: "Delete row", onSelect: () => deleteRow(rowIndex) },
        ],
        menuLabel: "Row actions",
        iconName: "drag_indicator",
        closeAllMenus,
        signal,
      });
      actionMenus.push(rowMenu);
      rowMenu.element.classList.add("cm-table-action--row");
      const rowMenuButton = rowMenu.element.querySelector<HTMLButtonElement>(
        ".cm-table-action-button"
      );
      if (rowMenuButton) {
        rowMenuButton.draggable = true;
        rowMenuButton.addEventListener("dragstart", (event) => {
          dragSourceIndex = rowIndex;
          dragTargetIndex = rowIndex;
          rowMenu.element.dataset.dragging = "true";
          event.dataTransfer?.setData("text/plain", String(rowIndex));
          event.dataTransfer?.setDragImage(rowMenuButton, 0, 0);
        });
        rowMenuButton.addEventListener("dragend", () => {
          dragSourceIndex = null;
          rowMenu.element.removeAttribute("data-dragging");
          clearDropIndicator();
        });
      }
      rowMenu.element.addEventListener("mouseenter", () => setActiveRowAction(rowIndex));
      rowMenu.element.addEventListener("mouseleave", () => setActiveRowAction(null));
      rowElement.addEventListener("mouseenter", () => setActiveRowAction(rowIndex));
      rowElement.addEventListener("mouseleave", () => setActiveRowAction(null));
      rowActions.appendChild(rowMenu.element);
    });

    const setActiveColumnHandle = (activeIndex: number | null) => {
      Array.from(columnHandles.children).forEach((child, index) => {
        if (!(child instanceof HTMLElement)) {
          return;
        }
        if (activeIndex !== null && index === activeIndex) {
          child.dataset.active = "true";
        } else {
          child.removeAttribute("data-active");
        }
      });
    };

    const columnCount = getColumnCount(data);
    headerCells.forEach((headerCell, colIndex) => {
      const columnMenu = createActionMenu({
        items: [
          { label: "Insert column left", onSelect: () => insertColumn(colIndex) },
          { label: "Insert column right", onSelect: () => insertColumn(colIndex + 1) },
          {
            label: "Delete column",
            onSelect: () => deleteColumn(colIndex),
            disabled: columnCount <= 1,
          },
          {
            label: "Align",
            submenu: [
              { label: "Left", onSelect: () => applyColumnAlignment(colIndex, "left") },
              { label: "Center", onSelect: () => applyColumnAlignment(colIndex, "center") },
              { label: "Right", onSelect: () => applyColumnAlignment(colIndex, "right") },
            ],
          },
        ],
        menuLabel: "Column actions",
        iconName: "drag_indicator",
        closeAllMenus,
        signal,
      });
      actionMenus.push(columnMenu);
      columnMenu.element.classList.add("cm-table-action--column");
      const columnMenuButton =
        columnMenu.element.querySelector<HTMLButtonElement>(".cm-table-action-button");
      if (columnMenuButton) {
        columnMenuButton.draggable = true;
        columnMenuButton.addEventListener("dragstart", (event) => {
          dragSourceColumnIndex = colIndex;
          dragTargetColumnIndex = colIndex;
          event.dataTransfer?.setData("text/plain", String(colIndex));
          event.dataTransfer?.setDragImage(columnMenuButton, 0, 0);
        });
        columnMenuButton.addEventListener("dragend", () => {
          dragSourceColumnIndex = null;
          clearColumnDropIndicator();
        });
      }
      columnMenu.element.addEventListener("mouseenter", () => setActiveColumnHandle(colIndex));
      columnMenu.element.addEventListener("mouseleave", () => setActiveColumnHandle(null));
      headerCell.addEventListener("mouseenter", () => setActiveColumnHandle(colIndex));
      headerCell.addEventListener("mouseleave", () => setActiveColumnHandle(null));
      columnHandles.appendChild(columnMenu.element);
    });

    wrapper.appendChild(rowDropIndicator);
    wrapper.appendChild(columnHandles);
    wrapper.appendChild(columnDropIndicator);
    scheduleRowActionLayout();
    scheduleColumnHandleLayout();

    const handleDragOver = (event: DragEvent) => {
      if (dragSourceIndex === null && dragSourceColumnIndex === null) {
        return;
      }
      event.preventDefault();
      if (dragSourceColumnIndex !== null) {
        updateColumnDropIndicator(event.clientX, event.clientY);
        clearDropIndicator();
        return;
      }
      updateDropIndicator(event.clientX, event.clientY);
    };

    const handleDrop = (event: DragEvent) => {
      if (dragSourceIndex === null && dragSourceColumnIndex === null) {
        return;
      }
      event.preventDefault();
      if (dragSourceColumnIndex !== null && dragTargetColumnIndex !== null) {
        commitColumnReorder();
        clearColumnDropIndicator();
        dragSourceColumnIndex = null;
        return;
      }
      if (dragSourceIndex !== null && dragTargetIndex !== null) {
        const rowRects = getRowRects();
        if (isWithinVerticalRange(rowRects, event.clientY)) {
          commitRowReorder();
        }
      }
      clearDropIndicator();
      dragSourceIndex = null;
    };

    window.addEventListener("dragover", handleDragOver, { signal, capture: true });
    window.addEventListener("drop", handleDrop, { signal, capture: true });


    return wrapper;
  }

  ignoreEvent(): boolean {
    return true;
  }

  destroy(): void {
    this.menuAbort.abort();
  }
}

function dispatchOutsideUpdate(
  view: EditorView,
  transaction: { changes: { from: number; to: number; insert: string }; annotations: Annotation<unknown> }
) {
  const dispatch = () => {
    setTimeout(() => view.dispatch(transaction), 0);
  };
  if (typeof view.requestMeasure === "function") {
    view.requestMeasure({ read() {}, write: dispatch });
    return;
  }
  dispatch();
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
      };

      const widgetDecoration = Decoration.widget({
        widget: new TableWidget(data, info),
        block: true,
      });
      builder.add(firstLine.from, firstLine.from, widgetDecoration);

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
    ".cm-content .cm-table-editor": {
      overflow: "visible",
      margin: "0.5rem 0",
      paddingTop: "0.5rem",
      position: "relative",
    },
    ".cm-content .cm-table-editor .cm-table-scroll": {
      overflowX: "auto",
    },
    ".cm-content .cm-table-editor table.cm-table": {
      width: "100%",
      borderCollapse: "collapse",
      backgroundColor: "var(--editor-surface)",
    },
    ".cm-content .cm-table-editor th, .cm-content .cm-table-editor td": {
      border: "1px solid var(--editor-border)",
      padding: "4px",
      verticalAlign: "top",
    },
    ".cm-content .cm-table-editor th": {
      backgroundColor: "var(--app-pill-bg)",
      textAlign: "left",
      position: "relative",
    },
    ".cm-content .cm-table-editor td": {
      position: "relative",
    },
    ".cm-content .cm-table-editor .cm-table-input": {
      width: "100%",
      minHeight: "1.6rem",
      border: "0",
      resize: "none",
      outline: "none",
      boxShadow: "none",
      overflow: "hidden",
      background: "transparent",
      color: "var(--editor-text-color)",
      font: "inherit",
      lineHeight: "1.4",
      padding: "2px",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      position: "relative",
      zIndex: "1",
    },
    ".cm-content .cm-table-editor .cm-table-input:focus": {
      outline: "none",
      boxShadow: "none",
      background: "var(--app-input-bg)",
    },
    ".cm-content .cm-table-editor .cm-table-cell": {
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
    },
    ".cm-content .cm-table-editor .cm-table-action": {
      position: "absolute",
      zIndex: "10",
      display: "inline-flex",
      flexDirection: "column",
      alignItems: "flex-start",
      gap: "4px",
      pointerEvents: "auto",
    },
    ".cm-content .cm-table-editor .cm-table-action--row": {
      left: "6px",
      top: "50%",
    },
    ".cm-content .cm-table-editor .cm-table-action--column": {
      top: "6px",
      right: "6px",
      left: "auto",
    },
    ".cm-content .cm-table-editor .cm-table-action-button": {
      border: "none",
      background: "transparent",
      color: "var(--app-text)",
      fontSize: "14px",
      padding: "0",
      cursor: "pointer",
      pointerEvents: "auto",
      opacity: "0.35",
      transition: "opacity 120ms ease",
    },
    ".cm-content .cm-table-editor .cm-table-row-actions .cm-table-action-button": {
      opacity: "0.35",
    },
    ".cm-content .cm-table-editor .cm-table-row-actions .cm-table-action:hover .cm-table-action-button":
      {
        opacity: "0.85",
      },
    ".cm-content .cm-table-editor tr:hover .cm-table-action-button": {
      opacity: "0.85",
    },
    ".cm-content .cm-table-editor th:hover .cm-table-action-button": {
      opacity: "0.85",
    },
    ".cm-content .cm-table-editor .cm-table-action[data-open=\"true\"] .cm-table-action-button": {
      opacity: "1",
    },
    ".cm-content .cm-table-editor .cm-table-action-menu": {
      display: "none",
      position: "absolute",
      top: "26px",
      left: "0",
      minWidth: "160px",
      maxWidth: "240px",
      background: "var(--editor-surface)",
      border: "1px solid var(--editor-border)",
      borderRadius: "8px",
      boxShadow: "0 6px 18px rgba(0, 0, 0, 0.12)",
      padding: "6px",
      zIndex: "3",
    },
    ".cm-content .cm-table-editor .cm-table-action--column .cm-table-action-menu": {
      top: "26px",
      left: "0",
    },
    ".cm-content .cm-table-editor .cm-table-action[data-open=\"true\"] .cm-table-action-menu": {
      display: "grid",
      gap: "4px",
    },
    ".cm-content .cm-table-editor .cm-table-action-item-button": {
      width: "100%",
      textAlign: "left",
      borderRadius: "6px",
      border: "0",
      background: "transparent",
      color: "var(--editor-text-color)",
      padding: "4px 6px",
      cursor: "pointer",
      fontSize: "12px",
    },
    ".cm-content .cm-table-editor .cm-table-action-item-button:hover": {
      background: "var(--app-pill-bg)",
    },
    ".cm-content .cm-table-editor .cm-table-action-item-button:disabled": {
      opacity: "0.4",
      cursor: "not-allowed",
    },
    ".cm-content .cm-table-editor .cm-table-action-item--submenu": {
      position: "relative",
    },
    ".cm-content .cm-table-editor .cm-table-action-submenu": {
      display: "none",
      position: "absolute",
      top: "0",
      left: "100%",
      marginLeft: "6px",
      minWidth: "140px",
      background: "var(--editor-surface)",
      border: "1px solid var(--editor-border)",
      borderRadius: "8px",
      boxShadow: "0 6px 18px rgba(0, 0, 0, 0.12)",
      padding: "6px",
      zIndex: "4",
    },
    ".cm-content .cm-table-editor .cm-table-action-item--submenu[data-open=\"true\"] .cm-table-action-submenu":
      {
      display: "grid",
      gap: "4px",
    },
    ".cm-content .cm-table-editor .cm-table-row-actions": {
      position: "fixed",
      top: "0",
      left: "0",
      width: "0",
      height: "0",
      pointerEvents: "none",
      zIndex: "10",
    },
    ".cm-content .cm-table-editor .cm-table-column-handles": {
      position: "fixed",
      top: "0",
      left: "0",
      width: "0",
      height: "0",
      pointerEvents: "none",
      zIndex: "10",
    },
    ".cm-content .cm-table-editor .cm-table-column-handles .cm-table-action-button": {
      cursor: "grab",
      opacity: "0",
    },
    ".cm-content .cm-table-editor .cm-table-column-handles .cm-table-action[data-active=\"true\"] .cm-table-action-button":
      {
        opacity: "0.8",
      },
    ".cm-content .cm-table-editor .cm-table-icon": {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "\"Material Symbols Outlined\"",
      fontSize: "18px",
      lineHeight: "1",
      fontVariationSettings: "\"FILL\" 0, \"wght\" 400, \"GRAD\" 0, \"opsz\" 20",
    },
    ".cm-content .cm-table-editor .cm-table-column-handles .cm-table-icon": {
      transform: "rotate(90deg)",
    },
    ".cm-content .cm-table-editor .cm-table-row-drop-indicator": {
      position: "fixed",
      height: "2px",
      background: "var(--editor-primary-color)",
      boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.25)",
      pointerEvents: "none",
      display: "none",
      zIndex: "2000",
    },
    ".cm-content .cm-table-editor .cm-table-column-drop-indicator": {
      position: "fixed",
      width: "2px",
      background: "var(--editor-primary-color)",
      boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.25)",
      pointerEvents: "none",
      display: "none",
      zIndex: "2000",
    },
    ".cm-content .cm-table-editor .cm-table-row-actions .cm-table-action": {
      opacity: "0",
      transition: "opacity 120ms ease",
    },
    ".cm-content .cm-table-editor .cm-table-row-actions .cm-table-action[data-active=\"true\"]":
      {
        opacity: "0.85",
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
