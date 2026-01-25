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
import jspreadsheet from "jspreadsheet-ce";
import {
  buildTableMarkdown,
  cloneTableData,
  ensureHeader,
  getColumnCount,
  normalizeTableData,
  parseAlignmentsFromLines,
  toDisplayText,
  toMarkdownText,
  type TableAlignment,
  type TableData,
} from "@yuya296/cm6-table-editor-vanilla";

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

type ColumnAction = "insert-left" | "insert-right" | "delete";

type DragState = {
  source: number | null;
  target: number | null;
  indicator: HTMLDivElement;
};

const tableEditAnnotation = Annotation.define<boolean>();
const defaultOptions: Required<TableEditorOptions> = {
  enabled: true,
  renderMode: "widget",
};

const normalizeCellValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
};

const toJspreadsheetAlign = (alignment: TableAlignment): "left" | "center" | "right" | undefined => {
  if (alignment === "left" || alignment === "center" || alignment === "right") {
    return alignment;
  }
  return undefined;
};

const estimateTableHeight = (rowCount: number) => {
  const baseRowHeight = 28;
  const minHeight = 160;
  return Math.max(minHeight, rowCount * baseRowHeight + 24);
};

class TableWidget extends WidgetType {
  private worksheet: jspreadsheet.WorksheetInstance | null = null;
  private container: HTMLDivElement | null = null;
  private readonly abortController = new AbortController();
  private syncing = false;
  private readonly dragState: DragState = {
    source: null,
    target: null,
    indicator: document.createElement("div"),
  };

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
    wrapper.className = "cm-table-editor cm-table-editor-jspreadsheet";
    wrapper.dataset.tableId = String(this.tableInfo.id);
    wrapper.tabIndex = 0;

    const container = document.createElement("div");
    container.className = "cm-table-editor-jspreadsheet__container";
    wrapper.appendChild(container);
    this.container = container;

    const menu = document.createElement("div");
    menu.className = "cm-jss-column-menu";
    menu.setAttribute("role", "menu");
    wrapper.appendChild(menu);

    this.dragState.indicator.className = "cm-jss-column-drop-indicator";
    wrapper.appendChild(this.dragState.indicator);

    const data = cloneTableData(this.data);
    normalizeTableData(data);

    const ensureAlignmentCount = (columnCount: number) => {
      if (data.alignments.length < columnCount) {
        data.alignments = data.alignments.concat(
          Array.from({ length: columnCount - data.alignments.length }, () => null)
        );
      } else if (data.alignments.length > columnCount) {
        data.alignments = data.alignments.slice(0, columnCount);
      }
    };

    const buildRows = () => {
      const rows = [data.header?.cells ?? [], ...data.rows.map((row) => row.cells)];
      return rows.map((row) => row.map((cell) => toDisplayText(cell.text)));
    };

    const buildColumns = () => {
      const columnCount = Math.max(1, getColumnCount(data));
      ensureHeader(data, columnCount);
      ensureAlignmentCount(columnCount);
      return Array.from({ length: columnCount }, (_value, index) => ({
        title: "",
        align: toJspreadsheetAlign(data.alignments[index] ?? null),
        render: (
          cell: HTMLTableCellElement,
          _value: jspreadsheet.CellValue | undefined,
          x: number,
          y: number,
          _instance: jspreadsheet.WorksheetInstance
        ) => {
          if (y === 0) {
            decorateHeaderCell(cell, x);
          } else {
            clearHeaderDecoration(cell);
          }
        },
      }));
    };

    const commitTable = () => {
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

    const rebuildDataFromWorksheet = () => {
      if (!this.worksheet) {
        return;
      }
      const rows = this.worksheet.getData() as Array<Array<unknown>>;
      const normalizedRows = rows.length > 0 ? rows : [[]];
      const [headerRow, ...bodyRows] = normalizedRows;
      data.header = {
        cells: headerRow.map((cell) => ({
          text: toMarkdownText(normalizeCellValue(cell)),
          from: -1,
          to: -1,
        })),
      };
      data.rows = bodyRows.map((row) => ({
        cells: row.map((cell) => ({
          text: toMarkdownText(normalizeCellValue(cell)),
          from: -1,
          to: -1,
        })),
      }));
      const columnCount = Math.max(
        headerRow.length,
        ...bodyRows.map((row) => row.length),
        0
      );
      ensureAlignmentCount(columnCount);
    };

    const commitFromWorksheet = () => {
      rebuildDataFromWorksheet();
      commitTable();
    };

    const applyColumnOperation = (action: ColumnAction, columnIndex: number) => {
      if (!this.worksheet) {
        return;
      }
      this.syncing = true;
      switch (action) {
        case "insert-left":
          data.alignments.splice(columnIndex, 0, null);
          this.worksheet.insertColumn(1, columnIndex, true);
          break;
        case "insert-right":
          data.alignments.splice(columnIndex + 1, 0, null);
          this.worksheet.insertColumn(1, columnIndex, false);
          break;
        case "delete":
          data.alignments.splice(columnIndex, 1);
          this.worksheet.deleteColumn(columnIndex, 1);
          break;
      }
      this.syncing = false;
      commitFromWorksheet();
    };

    const openMenu = (columnIndex: number, anchor: HTMLElement) => {
      const rect = anchor.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();
      menu.style.left = `${rect.right - wrapperRect.left - 8}px`;
      menu.style.top = `${rect.bottom - wrapperRect.top + 4}px`;
      menu.dataset.open = "true";
      menu.dataset.column = String(columnIndex);
    };

    const closeMenu = () => {
      delete menu.dataset.open;
      delete menu.dataset.column;
    };

    const onMenuClick = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const action = target.dataset.action as ColumnAction | undefined;
      const column = menu.dataset.column ? Number(menu.dataset.column) : null;
      if (!action || column === null || Number.isNaN(column)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      applyColumnOperation(action, column);
    };

    const setupMenu = () => {
      menu.innerHTML = "";
      const items: Array<{ label: string; action: ColumnAction }> = [
        { label: "Insert column left", action: "insert-left" },
        { label: "Insert column right", action: "insert-right" },
        { label: "Delete column", action: "delete" },
      ];
      for (const item of items) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "cm-jss-column-menu__item";
        button.textContent = item.label;
        button.dataset.action = item.action;
        button.tabIndex = -1;
        menu.appendChild(button);
      }
      menu.addEventListener("click", onMenuClick, { signal: this.abortController.signal });
    };

    const getCellAtPoint = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y);
      if (!(el instanceof Element)) {
        return null;
      }
      const cell = el.closest("td");
      if (!cell || !wrapper.contains(cell)) {
        return null;
      }
      return cell as HTMLTableCellElement;
    };

    const getColumnIndexFromCell = (cell: HTMLTableCellElement | null) => {
      if (!cell) {
        return null;
      }
      const x = cell.getAttribute("data-x");
      if (!x) {
        return null;
      }
      const index = Number(x);
      if (Number.isNaN(index)) {
        return null;
      }
      return index;
    };

    const getHeaderCellByColumn = (columnIndex: number) =>
      container.querySelector<HTMLTableCellElement>(
        `tbody tr:first-child td[data-x="${columnIndex}"]`
      );

    const updateDropIndicator = (columnIndex: number | null) => {
      if (columnIndex === null) {
        this.dragState.indicator.style.display = "none";
        return;
      }
      const targetCell = getHeaderCellByColumn(columnIndex);
      const content = container.querySelector<HTMLElement>(".jss_content");
      if (!targetCell || !content) {
        this.dragState.indicator.style.display = "none";
        return;
      }
      const cellRect = targetCell.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();
      this.dragState.indicator.style.display = "block";
      this.dragState.indicator.style.left = `${cellRect.left - wrapperRect.left}px`;
      this.dragState.indicator.style.top = `${contentRect.top - wrapperRect.top}px`;
      this.dragState.indicator.style.height = `${contentRect.height}px`;
    };

    const finishDrag = () => {
      const source = this.dragState.source;
      const target = this.dragState.target;
      this.dragState.source = null;
      this.dragState.target = null;
      updateDropIndicator(null);
      wrapper.classList.remove("cm-jss-column-dragging");
      if (!this.worksheet || source === null || target === null || source === target) {
        return;
      }
      const alignment = data.alignments.splice(source, 1)[0] ?? null;
      data.alignments.splice(target, 0, alignment);
      this.syncing = true;
      this.worksheet.moveColumn(source, target);
      this.syncing = false;
      commitFromWorksheet();
    };

    const startDrag = (columnIndex: number, event: PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      this.dragState.source = columnIndex;
      this.dragState.target = columnIndex;
      wrapper.classList.add("cm-jss-column-dragging");
      updateDropIndicator(columnIndex);

      const onMove = (moveEvent: PointerEvent) => {
        const cell = getCellAtPoint(moveEvent.clientX, moveEvent.clientY);
        const targetIndex = getColumnIndexFromCell(cell);
        this.dragState.target = targetIndex;
        updateDropIndicator(targetIndex);
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        finishDrag();
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    };

    const decorateHeaderCell = (cell: HTMLTableCellElement, columnIndex: number) => {
      cell.classList.add("cm-jss-header-cell");
      cell.dataset.cmHeaderCell = "true";
      let tools = cell.querySelector<HTMLElement>(".cm-jss-header-tools");
      if (!tools) {
        tools = document.createElement("div");
        tools.className = "cm-jss-header-tools";
        const menuButton = document.createElement("button");
        menuButton.type = "button";
        menuButton.className = "cm-jss-header-menu";
        menuButton.setAttribute("aria-label", "Column menu");
        menuButton.tabIndex = -1;
        menuButton.textContent = "...";
        menuButton.addEventListener(
          "pointerdown",
          (event) => {
            event.preventDefault();
            event.stopPropagation();
          },
          { signal: this.abortController.signal }
        );
        menuButton.addEventListener(
          "click",
          (event) => {
            event.preventDefault();
            event.stopPropagation();
            const currentIndex = Number(cell.getAttribute("data-x") ?? columnIndex);
            if (!Number.isNaN(currentIndex)) {
              openMenu(currentIndex, cell);
            }
          },
          { signal: this.abortController.signal }
        );

        const handle = document.createElement("button");
        handle.type = "button";
        handle.className = "cm-jss-header-handle";
        handle.setAttribute("aria-label", "Move column");
        handle.tabIndex = -1;
        handle.textContent = "===";
        handle.addEventListener(
          "pointerdown",
          (event) => {
            const currentIndex = Number(cell.getAttribute("data-x") ?? columnIndex);
            if (!Number.isNaN(currentIndex)) {
              startDrag(currentIndex, event);
            }
          },
          { signal: this.abortController.signal }
        );

        tools.appendChild(menuButton);
        tools.appendChild(handle);
        cell.appendChild(tools);
      }
    };

    const clearHeaderDecoration = (cell: HTMLTableCellElement) => {
      if (cell.dataset.cmHeaderCell !== "true") {
        return;
      }
      cell.classList.remove("cm-jss-header-cell");
      delete cell.dataset.cmHeaderCell;
      const tools = cell.querySelector<HTMLElement>(".cm-jss-header-tools");
      if (tools) {
        tools.remove();
      }
    };

    setupMenu();

    const rows = buildRows();
    const columns = buildColumns();
    const rowCount = rows.length;

    const worksheet = jspreadsheet(container, {
      onafterchanges: () => {
        if (this.syncing) {
          return;
        }
        commitFromWorksheet();
      },
      worksheets: [
        {
          data: rows,
          columns,
          tableOverflow: true,
          tableHeight: estimateTableHeight(rowCount),
          columnDrag: false,
          rowDrag: false,
          allowInsertRow: false,
          allowInsertColumn: true,
          allowDeleteRow: false,
          allowDeleteColumn: true,
        },
      ],
    })[0];

    this.worksheet = worksheet;
    this.worksheet.hideIndex();
    const applyColumnPermissions = () => {
      const element =
        this.container as unknown as
          | { jssWorksheet?: jspreadsheet.WorksheetInstance; jspreadsheet?: jspreadsheet.WorksheetInstance }
          | null;
      const instance = this.worksheet ?? element?.jssWorksheet ?? element?.jspreadsheet;
      if (!instance) {
        return;
      }
      this.worksheet = instance;
      instance.options.allowInsertColumn = true;
      instance.options.allowDeleteColumn = true;
      instance.options.allowInsertRow = false;
      instance.options.allowDeleteRow = false;
    };
    applyColumnPermissions();
    setTimeout(applyColumnPermissions, 0);

    const signal = this.abortController.signal;
    document.addEventListener(
      "click",
      (event) => {
        const target = event.target;
        if (!(target instanceof Node)) {
          return;
        }
        if (!wrapper.contains(target)) {
          closeMenu();
          return;
        }
        if (!(target instanceof Element)) {
          return;
        }
        if (!target.closest(".cm-jss-column-menu")) {
          closeMenu();
        }
      },
      { signal }
    );

    const content = container.querySelector<HTMLElement>(".jss_content");
    content?.addEventListener("scroll", closeMenu, { passive: true, signal });
    window.addEventListener("resize", closeMenu, { signal });

    wrapper.addEventListener(
      "focusout",
      (event) => {
        const related = event.relatedTarget;
        if (related instanceof Node && wrapper.contains(related)) {
          return;
        }
        this.worksheet?.resetSelection();
      },
      { signal }
    );

    return wrapper;
  }

  ignoreEvent(): boolean {
    return true;
  }

  destroy(): void {
    this.abortController.abort();
    if (this.container) {
      jspreadsheet.destroy(
        this.container as unknown as jspreadsheet.JspreadsheetInstanceElement
      );
    }
    this.worksheet = null;
    this.container = null;
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
    ".cm-content .cm-table-editor-jspreadsheet__container": {
      width: "100%",
    },
    ".cm-content .cm-table-editor-jspreadsheet .jss_container": {
      background: "transparent",
    },
    ".cm-content .cm-table-editor-jspreadsheet .jss_worksheet": {
      border: "1px solid var(--editor-border)",
      background: "var(--editor-surface)",
    },
    ".cm-content .cm-table-editor-jspreadsheet .jss_worksheet thead": {
      display: "none",
    },
    ".cm-content .cm-table-editor-jspreadsheet .jss_content": {
      background: "var(--editor-surface)",
    },
    ".cm-content .cm-table-editor-jspreadsheet td": {
      borderColor: "var(--editor-border)",
      background: "transparent",
    },
    ".cm-content .cm-table-editor-jspreadsheet td.cm-jss-header-cell": {
      position: "sticky",
      top: "0",
      zIndex: "2",
      background: "var(--editor-surface)",
      boxShadow: "0 1px 0 var(--editor-border)",
    },
    ".cm-content .cm-table-editor-jspreadsheet td.cm-jss-header-cell .cm-jss-header-tools": {
      position: "absolute",
      right: "4px",
      top: "4px",
      display: "flex",
      gap: "4px",
      opacity: "0",
      transition: "opacity 120ms ease",
    },
    ".cm-content .cm-table-editor-jspreadsheet td.cm-jss-header-cell:hover .cm-jss-header-tools": {
      opacity: "1",
    },
    ".cm-content .cm-table-editor-jspreadsheet .cm-jss-header-menu": {
      border: "1px solid var(--editor-border)",
      background: "var(--editor-surface)",
      color: "var(--editor-secondary-color)",
      borderRadius: "8px",
      width: "22px",
      height: "22px",
      lineHeight: "20px",
      fontSize: "14px",
      cursor: "pointer",
    },
    ".cm-content .cm-table-editor-jspreadsheet .cm-jss-header-handle": {
      border: "1px solid var(--editor-border)",
      background: "var(--editor-surface)",
      color: "var(--editor-secondary-color)",
      borderRadius: "8px",
      width: "22px",
      height: "22px",
      lineHeight: "20px",
      fontSize: "12px",
      cursor: "grab",
    },
    ".cm-content .cm-table-editor-jspreadsheet .cm-jss-column-menu": {
      position: "absolute",
      minWidth: "160px",
      background: "var(--editor-surface)",
      border: "1px solid var(--editor-border)",
      borderRadius: "10px",
      boxShadow: "0 10px 22px rgba(0, 0, 0, 0.18)",
      padding: "6px",
      display: "none",
      zIndex: "30",
    },
    ".cm-content .cm-table-editor-jspreadsheet .cm-jss-column-menu[data-open='true']": {
      display: "block",
    },
    ".cm-content .cm-table-editor-jspreadsheet .cm-jss-column-menu__item": {
      width: "100%",
      textAlign: "left",
      background: "transparent",
      border: "none",
      color: "var(--editor-foreground)",
      padding: "6px 8px",
      borderRadius: "6px",
      cursor: "pointer",
    },
    ".cm-content .cm-table-editor-jspreadsheet .cm-jss-column-menu__item:hover": {
      background: "var(--editor-surface-hover)",
    },
    ".cm-content .cm-table-editor-jspreadsheet .cm-jss-column-drop-indicator": {
      position: "absolute",
      width: "2px",
      background: "var(--editor-accent)",
      display: "none",
      zIndex: "20",
    },
    ".cm-content .cm-table-editor-jspreadsheet .jss_worksheet .highlight": {
      backgroundColor: "var(--editor-selection-bg)",
    },
    ".cm-content .cm-table-editor-jspreadsheet .jss_worksheet .selection": {
      backgroundColor: "var(--editor-selection-bg)",
    },
    ".cm-content .cm-table-editor-jspreadsheet .jss_worksheet .highlight-top": {
      borderTopColor: "var(--editor-primary-color)",
      boxShadow: "0 -1px var(--editor-border)",
    },
    ".cm-content .cm-table-editor-jspreadsheet .jss_worksheet .highlight-left": {
      borderLeftColor: "var(--editor-primary-color)",
      boxShadow: "-1px 0 var(--editor-border)",
    },
    ".cm-content .cm-table-editor-jspreadsheet .jss_worksheet .highlight-right": {
      borderRightColor: "var(--editor-primary-color)",
    },
    ".cm-content .cm-table-editor-jspreadsheet .jss_worksheet .highlight-bottom": {
      borderBottomColor: "var(--editor-primary-color)",
    },
    ".cm-content .cm-table-editor-jspreadsheet .jss_worksheet .selection-top": {
      borderTopColor: "var(--editor-primary-color)",
    },
    ".cm-content .cm-table-editor-jspreadsheet .jss_worksheet .selection-left": {
      borderLeftColor: "var(--editor-primary-color)",
    },
    ".cm-content .cm-table-editor-jspreadsheet .jss_worksheet .selection-right": {
      borderRightColor: "var(--editor-primary-color)",
    },
    ".cm-content .cm-table-editor-jspreadsheet .jss_worksheet .selection-bottom": {
      borderBottomColor: "var(--editor-primary-color)",
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
