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
type RowAction = "insert-above" | "insert-below" | "delete";

type DragState = {
  source: number | null;
  insertIndex: number | null;
  indicator: HTMLDivElement;
};

type RowDragState = {
  source: number | null;
  insertIndex: number | null;
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
    insertIndex: null,
    indicator: document.createElement("div"),
  };
  private readonly rowDragState: RowDragState = {
    source: null,
    insertIndex: null,
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

    const rowMenu = document.createElement("div");
    rowMenu.className = "cm-jss-row-menu";
    rowMenu.setAttribute("role", "menu");
    wrapper.appendChild(rowMenu);

    this.dragState.indicator.className = "cm-jss-column-drop-indicator";
    wrapper.appendChild(this.dragState.indicator);

    this.rowDragState.indicator.className = "cm-jss-row-drop-indicator";
    wrapper.appendChild(this.rowDragState.indicator);

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

    const ensureWorksheetFocus = () => {
      const textarea = container.querySelector<HTMLTextAreaElement>(".jss_textarea");
      if (textarea) {
        try {
          textarea.focus({ preventScroll: true });
        } catch {
          textarea.focus();
        }
        return;
      }
      try {
        wrapper.focus({ preventScroll: true });
      } catch {
        wrapper.focus();
      }
    };

    const applyRowOperation = (action: RowAction, rowIndex: number) => {
      if (!this.worksheet) {
        return;
      }
      let didMutate = true;
      this.syncing = true;
      switch (action) {
        case "insert-above":
          this.worksheet.insertRow(1, Math.max(1, rowIndex), 1);
          break;
        case "insert-below":
          this.worksheet.insertRow(1, rowIndex, 0);
          break;
        case "delete":
          if (rowIndex <= 0) {
            didMutate = false;
            break;
          }
          this.worksheet.deleteRow(rowIndex, 1);
          break;
      }
      this.syncing = false;
      if (!didMutate) {
        return;
      }
      commitFromWorksheet();
      decorateRowHeaders();
      ensureWorksheetFocus();
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
      decorateColumnHeaders();
      ensureWorksheetFocus();
    };

    const openMenu = (columnIndex: number, anchor: HTMLElement) => {
      const rect = anchor.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();
      menu.style.left = `${rect.right - wrapperRect.left - 8}px`;
      menu.style.top = `${rect.bottom - wrapperRect.top + 4}px`;
      menu.dataset.open = "true";
      menu.dataset.column = String(columnIndex);
    };

    const openRowMenu = (rowIndex: number, anchor: HTMLElement) => {
      const rect = anchor.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();
      rowMenu.style.left = `${rect.right - wrapperRect.left - 8}px`;
      rowMenu.style.top = `${rect.top - wrapperRect.top}px`;
      rowMenu.dataset.open = "true";
      rowMenu.dataset.row = String(rowIndex);
    };

    const closeMenu = () => {
      delete menu.dataset.open;
      delete menu.dataset.column;
      delete rowMenu.dataset.open;
      delete rowMenu.dataset.row;
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

    const onRowMenuClick = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const action = target.dataset.action as RowAction | undefined;
      const row = rowMenu.dataset.row ? Number(rowMenu.dataset.row) : null;
      if (!action || row === null || Number.isNaN(row)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      applyRowOperation(action, row);
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

      rowMenu.innerHTML = "";
      const rowItems: Array<{ label: string; action: RowAction }> = [
        { label: "Insert row above", action: "insert-above" },
        { label: "Insert row below", action: "insert-below" },
        { label: "Delete row", action: "delete" },
      ];
      for (const item of rowItems) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "cm-jss-row-menu__item";
        button.textContent = item.label;
        button.dataset.action = item.action;
        button.tabIndex = -1;
        rowMenu.appendChild(button);
      }
      rowMenu.addEventListener("click", onRowMenuClick, { signal: this.abortController.signal });
    };

    const getCellAtPoint = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y);
      if (!(el instanceof Element)) {
        return null;
      }
      const cell = el.closest("td, th");
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

    const getRowIndexFromCell = (cell: HTMLTableCellElement | null) => {
      if (!cell) {
        return null;
      }
      const y = cell.getAttribute("data-y");
      if (!y) {
        return null;
      }
      const index = Number(y);
      if (Number.isNaN(index)) {
        return null;
      }
      return index;
    };

    const getHeaderCellByColumn = (columnIndex: number) =>
      container.querySelector<HTMLTableCellElement>(
        `thead tr td[data-x="${columnIndex}"], thead tr th[data-x="${columnIndex}"]`
      );

    const getRowHeaderCellByRow = (rowIndex: number) =>
      container.querySelector<HTMLTableCellElement>(
        `tbody tr td.jss_row[data-y="${rowIndex}"]`
      );

    const getColumnCountFromDom = () =>
      container.querySelectorAll("thead tr td[data-x], thead tr th[data-x]").length;

    const getRowCountFromDom = () =>
      container.querySelectorAll("tbody tr td.jss_row").length;

    const decorateColumnHeaders = () => {
      const headerCells = Array.from(
        container.querySelectorAll<HTMLElement>("thead tr td, thead tr th")
      );
      headerCells.forEach((cell) => {
        const dataX = cell.getAttribute("data-x");
        if (!dataX) {
          return;
        }
        const columnIndex = Number(dataX);
        if (Number.isNaN(columnIndex)) {
          return;
        }
        cell.style.height = "10px";
        cell.style.lineHeight = "10px";
        cell.style.fontSize = "0px";
        cell.style.overflow = "visible";
        cell.style.padding = "0";
        cell.style.borderWidth = "0";
        const row = cell.parentElement;
        if (row instanceof HTMLElement) {
          row.style.height = "10px";
          row.style.lineHeight = "10px";
          row.style.overflow = "visible";
        }
        cell.classList.add("cm-jss-column-header");
        let handle = cell.querySelector<HTMLButtonElement>(".cm-jss-column-handle");
        if (!handle) {
          handle = document.createElement("button");
          handle.type = "button";
          handle.className = "cm-jss-column-handle";
          handle.setAttribute("aria-label", "Move column");
          handle.tabIndex = -1;
          handle.textContent = "===";
          handle.addEventListener(
            "pointerdown",
            (event) => startDrag(columnIndex, event),
            { signal: this.abortController.signal }
          );
          cell.appendChild(handle);
        }
      });
    };

    const decorateRowHeaders = () => {
      const headerCells = Array.from(
        container.querySelectorAll<HTMLTableCellElement>("tbody td.jss_row")
      );
      headerCells.forEach((cell) => {
        const rowIndex = getRowIndexFromCell(cell);
        if (rowIndex === null) {
          return;
        }
        if (rowIndex === 0) {
          cell
            .querySelector(".cm-jss-row-handle")
            ?.remove();
          return;
        }
        cell.classList.add("cm-jss-row-header");
        let handle = cell.querySelector<HTMLButtonElement>(".cm-jss-row-handle");
        if (!handle) {
          handle = document.createElement("button");
          handle.type = "button";
          handle.className = "cm-jss-row-handle";
          handle.setAttribute("aria-label", "Move row");
          handle.tabIndex = -1;
          handle.textContent = "===";
          handle.addEventListener(
            "pointerdown",
            (event) => startRowDrag(rowIndex, event),
            { signal: this.abortController.signal }
          );
          cell.appendChild(handle);
        }
      });
    };

    const updateDropIndicator = (insertIndex: number | null, columnCount: number) => {
      if (insertIndex === null) {
        this.dragState.indicator.style.display = "none";
        return;
      }
      const content = container.querySelector<HTMLElement>(".jss_content");
      if (!content || columnCount === 0) {
        this.dragState.indicator.style.display = "none";
        return;
      }
      const clampedIndex = Math.max(0, Math.min(columnCount, insertIndex));
      const boundaryIndex = Math.min(clampedIndex, columnCount - 1);
      const targetCell = getHeaderCellByColumn(boundaryIndex);
      if (!targetCell) {
        this.dragState.indicator.style.display = "none";
        return;
      }
      const cellRect = targetCell.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();
      const isEnd = clampedIndex >= columnCount;
      const left = isEnd ? cellRect.right : cellRect.left;
      this.dragState.indicator.style.display = "block";
      this.dragState.indicator.style.left = `${left - wrapperRect.left}px`;
      this.dragState.indicator.style.top = `${contentRect.top - wrapperRect.top}px`;
      this.dragState.indicator.style.height = `${contentRect.height}px`;
    };

    const updateRowDropIndicator = (insertIndex: number | null, rowCount: number) => {
      if (insertIndex === null) {
        this.rowDragState.indicator.style.display = "none";
        return;
      }
      const content = container.querySelector<HTMLElement>(".jss_content");
      if (!content || rowCount === 0) {
        this.rowDragState.indicator.style.display = "none";
        return;
      }
      const clampedIndex = Math.max(0, Math.min(rowCount, insertIndex));
      const boundaryIndex = Math.min(clampedIndex, rowCount - 1);
      const targetCell = getRowHeaderCellByRow(boundaryIndex);
      if (!targetCell) {
        this.rowDragState.indicator.style.display = "none";
        return;
      }
      const cellRect = targetCell.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();
      const isEnd = clampedIndex >= rowCount;
      const top = isEnd ? cellRect.bottom : cellRect.top;
      this.rowDragState.indicator.style.display = "block";
      this.rowDragState.indicator.style.left = `${contentRect.left - wrapperRect.left}px`;
      this.rowDragState.indicator.style.top = `${top - wrapperRect.top}px`;
      this.rowDragState.indicator.style.width = `${contentRect.width}px`;
    };

    const finishDrag = (columnCount: number) => {
      const source = this.dragState.source;
      const insertIndex = this.dragState.insertIndex;
      this.dragState.source = null;
      this.dragState.insertIndex = null;
      updateDropIndicator(null, columnCount);
      wrapper.classList.remove("cm-jss-column-dragging");
      if (!this.worksheet || source === null || insertIndex === null) {
        return;
      }
      const normalizedInsert = insertIndex > source ? insertIndex - 1 : insertIndex;
      if (normalizedInsert === source) {
        return;
      }
      const alignment = data.alignments.splice(source, 1)[0] ?? null;
      data.alignments.splice(normalizedInsert, 0, alignment);
      this.syncing = true;
      this.worksheet.moveColumn(source, normalizedInsert);
      this.syncing = false;
      commitFromWorksheet();
      decorateColumnHeaders();
      ensureWorksheetFocus();
    };

    const finishRowDrag = (rowCount: number) => {
      const source = this.rowDragState.source;
      const insertIndex = this.rowDragState.insertIndex;
      this.rowDragState.source = null;
      this.rowDragState.insertIndex = null;
      updateRowDropIndicator(null, rowCount);
      wrapper.classList.remove("cm-jss-row-dragging");
      if (!this.worksheet || source === null || insertIndex === null) {
        return;
      }
      if (source <= 0) {
        return;
      }
      const clampedInsert = Math.max(1, Math.min(rowCount, insertIndex));
      const normalizedInsert =
        clampedInsert > source ? clampedInsert - 1 : clampedInsert;
      if (normalizedInsert === source) {
        return;
      }
      const moveRow = this.worksheet.moveRow as
        | ((from: number, to: number) => void)
        | undefined;
      if (typeof moveRow !== "function") {
        return;
      }
      this.syncing = true;
      moveRow(source, normalizedInsert);
      this.syncing = false;
      commitFromWorksheet();
      decorateRowHeaders();
      ensureWorksheetFocus();
    };

    const startDrag = (columnIndex: number, event: PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      this.dragState.source = columnIndex;
      this.dragState.insertIndex = columnIndex;
      const columnCount = getColumnCountFromDom() || columns.length;
      wrapper.classList.add("cm-jss-column-dragging");
      updateDropIndicator(columnIndex, columnCount);

      const onMove = (moveEvent: PointerEvent) => {
        const cell = getCellAtPoint(moveEvent.clientX, moveEvent.clientY);
        const targetIndex = getColumnIndexFromCell(cell);
        if (targetIndex === null) {
          this.dragState.insertIndex = null;
          updateDropIndicator(null, columnCount);
          return;
        }
        if (!cell) {
          return;
        }
        const rect = cell.getBoundingClientRect();
        const before = moveEvent.clientX < rect.left + rect.width / 2;
        const insertIndex = before ? targetIndex : targetIndex + 1;
        this.dragState.insertIndex = insertIndex;
        updateDropIndicator(insertIndex, columnCount);
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        finishDrag(columnCount);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    };

    const startRowDrag = (rowIndex: number, event: PointerEvent) => {
      if (rowIndex <= 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      this.rowDragState.source = rowIndex;
      this.rowDragState.insertIndex = rowIndex;
      const rowCount = getRowCountFromDom() || rows.length;
      wrapper.classList.add("cm-jss-row-dragging");
      updateRowDropIndicator(rowIndex, rowCount);

      const onMove = (moveEvent: PointerEvent) => {
        const cell = getCellAtPoint(moveEvent.clientX, moveEvent.clientY);
        const targetIndex = getRowIndexFromCell(cell);
        if (targetIndex === null) {
          this.rowDragState.insertIndex = null;
          updateRowDropIndicator(null, rowCount);
          return;
        }
        if (!cell) {
          return;
        }
        const rect = cell.getBoundingClientRect();
        const before = moveEvent.clientY < rect.top + rect.height / 2;
        const insertIndex = Math.max(1, before ? targetIndex : targetIndex + 1);
        this.rowDragState.insertIndex = insertIndex;
        updateRowDropIndicator(insertIndex, rowCount);
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        finishRowDrag(rowCount);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    };

    const decorateHeaderCell = (cell: HTMLTableCellElement, columnIndex: number) => {
      cell.classList.add("cm-jss-header-cell");
      cell.dataset.cmHeaderCell = "true";
    };

    const clearHeaderDecoration = (cell: HTMLTableCellElement) => {
      if (cell.dataset.cmHeaderCell !== "true") {
        return;
      }
      cell.classList.remove("cm-jss-header-cell");
      delete cell.dataset.cmHeaderCell;
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
        decorateColumnHeaders();
        decorateRowHeaders();
        ensureWorksheetFocus();
      },
      oneditionend: () => {
        ensureWorksheetFocus();
      },
      contextMenu: () => null,
      worksheets: [
        {
          data: rows,
          columns,
          tableOverflow: true,
          tableHeight: estimateTableHeight(rowCount),
          columnDrag: false,
          rowDrag: false,
          allowInsertRow: true,
          allowInsertColumn: true,
          allowDeleteRow: true,
          allowDeleteColumn: true,
          allowComments: false,
        },
      ],
    })[0];

    this.worksheet = worksheet;
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
      instance.options.allowInsertRow = true;
      instance.options.allowDeleteRow = true;
      instance.options.allowComments = false;
      const content = this.container?.querySelector<HTMLElement>(".jss_content");
      if (content) {
        // Jspreadsheet sets inline box-shadow when tableOverflow is enabled.
        content.style.setProperty("box-shadow", "none", "important");
      }
      const colgroup = this.container?.querySelector<HTMLTableColElement>(
        ".jss_worksheet colgroup col:first-child"
      );
      if (colgroup) {
        colgroup.style.width = "10px";
      }
    };
    applyColumnPermissions();
    setTimeout(applyColumnPermissions, 0);
    decorateColumnHeaders();
    decorateRowHeaders();

    const signal = this.abortController.signal;
    document.addEventListener(
      "contextmenu",
      (event) => {
        const target = event.target;
        if (!(target instanceof Element)) {
          return;
        }
        if (!wrapper.contains(target)) {
          return;
        }
        const cell = target.closest<HTMLTableCellElement>("td, th");
        if (!cell) {
          return;
        }
        if (cell.closest("thead")) {
          const columnIndex = getColumnIndexFromCell(cell);
          if (columnIndex === null) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          openMenu(columnIndex, cell);
          return;
        }
        if (cell.classList.contains("jss_row")) {
          const rowIndex = getRowIndexFromCell(cell);
          if (rowIndex === null) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          openRowMenu(rowIndex, cell);
        }
      },
      { signal }
    );

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
        if (!target.closest(".cm-jss-column-menu") && !target.closest(".cm-jss-row-menu")) {
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
      () => {
        setTimeout(() => {
          const active = document.activeElement;
          if (active instanceof Node && wrapper.contains(active)) {
            return;
          }
          this.worksheet?.resetSelection();
        }, 0);
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
      border: "none",
      background: "var(--editor-surface)",
    },
    ".cm-content .cm-table-editor-jspreadsheet .jss_worksheet thead": {
      display: "table-header-group",
    },
    ".cm-content .cm-table-editor-jspreadsheet .jss_worksheet thead tr": {
      height: "10px",
    },
    ".cm-content .cm-table-editor-jspreadsheet .jss_worksheet thead td, .cm-content .cm-table-editor-jspreadsheet .jss_worksheet thead th": {
      height: "10px",
      padding: "0",
      color: "transparent",
      background: "transparent",
      borderColor: "transparent",
    },
    ".cm-content .cm-table-editor-jspreadsheet .jss_selectall": {
      width: "10px",
      padding: "0",
      background: "transparent",
      borderColor: "transparent",
    },
    ".cm-content .cm-table-editor-jspreadsheet .jss_content": {
      background: "var(--editor-surface)",
    },
    ".cm-content .cm-table-editor-jspreadsheet td": {
      borderColor: "var(--editor-border)",
      background: "transparent",
    },
    ".cm-content .cm-table-editor-jspreadsheet td.jss_row": {
      color: "transparent",
      background: "transparent",
      padding: "0",
      borderColor: "transparent",
    },
    ".cm-content .cm-table-editor-jspreadsheet td.cm-jss-header-cell": {
      position: "sticky",
      top: "0",
      zIndex: "2",
      background: "var(--editor-surface)",
      boxShadow: "0 1px 0 var(--editor-border)",
    },
    ".cm-content .cm-table-editor-jspreadsheet .cm-jss-column-handle": {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: "22px",
      height: "18px",
      border: "1px solid var(--editor-border)",
      background: "var(--editor-surface)",
      color: "var(--editor-secondary-color)",
      borderRadius: "9px",
      fontSize: "10px",
      letterSpacing: "0.08em",
      cursor: "grab",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      opacity: "0",
      transition: "opacity 120ms ease",
    },
    ".cm-content .cm-table-editor-jspreadsheet .cm-jss-row-header": {
      position: "relative",
    },
    ".cm-content .cm-table-editor-jspreadsheet .cm-jss-row-handle": {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%) rotate(90deg)",
      width: "22px",
      height: "18px",
      border: "1px solid var(--editor-border)",
      background: "var(--editor-surface)",
      color: "var(--editor-secondary-color)",
      borderRadius: "9px",
      fontSize: "10px",
      letterSpacing: "0.08em",
      cursor: "grab",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      opacity: "0",
      transition: "opacity 120ms ease",
    },
    ".cm-content .cm-table-editor-jspreadsheet:hover .cm-jss-column-handle": {
      opacity: "1",
    },
    ".cm-content .cm-table-editor-jspreadsheet:hover .cm-jss-row-handle": {
      opacity: "1",
    },
    ".cm-content .cm-table-editor-jspreadsheet .cm-jss-column-header": {
      position: "relative",
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
    ".cm-content .cm-table-editor-jspreadsheet .cm-jss-row-menu": {
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
    ".cm-content .cm-table-editor-jspreadsheet .cm-jss-row-menu[data-open='true']": {
      display: "block",
    },
    ".cm-content .cm-table-editor-jspreadsheet .jss_contextmenu": {
      display: "none",
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
    ".cm-content .cm-table-editor-jspreadsheet .cm-jss-row-menu__item": {
      width: "100%",
      textAlign: "left",
      background: "transparent",
      border: "none",
      color: "var(--editor-foreground)",
      padding: "6px 8px",
      borderRadius: "6px",
      cursor: "pointer",
    },
    ".cm-content .cm-table-editor-jspreadsheet .cm-jss-row-menu__item:hover": {
      background: "var(--editor-surface-hover)",
    },
    ".cm-content .cm-table-editor-jspreadsheet .cm-jss-column-drop-indicator": {
      position: "absolute",
      width: "3px",
      background: "var(--editor-primary-color)",
      boxShadow: "0 0 0 1px var(--editor-surface), 0 0 6px var(--editor-accent)",
      display: "none",
      zIndex: "120",
      pointerEvents: "none",
    },
    ".cm-content .cm-table-editor-jspreadsheet .cm-jss-row-drop-indicator": {
      position: "absolute",
      height: "3px",
      background: "var(--editor-primary-color)",
      boxShadow: "0 0 0 1px var(--editor-surface), 0 0 6px var(--editor-accent)",
      display: "none",
      zIndex: "120",
      pointerEvents: "none",
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
