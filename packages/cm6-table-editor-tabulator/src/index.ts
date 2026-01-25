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
import { TabulatorFull as Tabulator } from "tabulator-tables";
import {
  buildTableMarkdown,
  cloneTableData,
  deleteColumnAt,
  deleteRowAt,
  ensureHeader,
  getColumnCount,
  insertColumnAt,
  insertRowAt,
  normalizeTableData,
  parseAlignmentsFromLines,
  setColumnAlignment,
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

const tableEditAnnotation = Annotation.define<boolean>();
const defaultOptions: Required<TableEditorOptions> = {
  enabled: true,
  renderMode: "widget",
};

type TabulatorColumn = {
  getDefinition: () => { title?: string; field?: string; hozAlign?: string | null };
  getField: () => string;
  getElement: () => HTMLElement;
};

type TabulatorRow = {
  getPosition: () => number;
  getElement: () => HTMLElement;
};

type TabulatorCell = {
  getColumn: () => TabulatorColumn;
};

const toTabulatorAlign = (alignment: TableAlignment): string | undefined => {
  switch (alignment) {
    case "left":
      return "left";
    case "center":
      return "center";
    case "right":
      return "right";
    default:
      return undefined;
  }
};

const fromTabulatorAlign = (alignment?: string | null): TableAlignment => {
  if (alignment === "left" || alignment === "center" || alignment === "right") {
    return alignment;
  }
  return null;
};

const normalizeCellValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
};

class TableWidget extends WidgetType {
  private table: InstanceType<typeof Tabulator> | null = null;
  private readonly abortController = new AbortController();
  private syncing = false;
  private hoveredColumnEl: HTMLElement | null = null;
  private hoveredRowEl: HTMLElement | null = null;
  private hoveredRowHandleEl: HTMLElement | null = null;

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
    wrapper.className = "cm-table-editor cm-table-editor-tabulator";
    wrapper.dataset.tableId = String(this.tableInfo.id);
    wrapper.tabIndex = 0;

    const container = document.createElement("div");
    container.className = "cm-table-editor-tabulator__container";
    wrapper.appendChild(container);

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

    const buildColumns = () => {
      const columnCount = Math.max(1, getColumnCount(data));
      ensureHeader(data, columnCount);
      ensureAlignmentCount(columnCount);
      const handleColumn = {
        title: "",
        field: "__row_handle",
        headerSort: false,
        editor: false,
        resizable: false,
        movable: false,
        frozen: true,
        width: 22,
        hozAlign: "center",
        headerHozAlign: "center",
        rowHandle: true,
        formatter: () => "",
        cssClass: "tabulator-row-handle",
      };
      return [
        handleColumn,
        ...Array.from({ length: columnCount }, (_value, index) => {
        const title = toDisplayText(data.header?.cells[index]?.text ?? `Col ${index + 1}`);
        const alignment = toTabulatorAlign(data.alignments[index] ?? null);
        return {
          title,
          field: `col_${index}`,
          editor: "input",
          headerSort: false,
          headerTooltip: title,
          hozAlign: alignment,
          headerHozAlign: alignment,
          headerMenu: (column: TabulatorColumn) => buildHeaderMenu(column),
        };
        }),
      ];
    };

    const buildRows = () =>
      data.rows.map((row) => {
        const rowData: Record<string, string> = {};
        rowData.__row_handle = "";
        row.cells.forEach((cell, index) => {
          rowData[`col_${index}`] = toDisplayText(cell.text);
        });
        return rowData;
      });

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

    const syncTableFromData = () => {
      if (!this.table) {
        return;
      }
      this.syncing = true;
      this.table.setColumns(buildColumns());
      this.table.setData(buildRows());
      this.syncing = false;
    };

    const rebuildDataFromTable = () => {
      if (!this.table) {
        return;
      }
      const columns = (this.table.getColumns() as TabulatorColumn[]).filter(
        (column) => column.getField() !== "__row_handle"
      );
      const columnCount = columns.length;
      ensureAlignmentCount(columnCount);
      data.header = {
        cells: columns.map((column, index) => ({
          text: toMarkdownText(
            column.getDefinition().title ?? `Col ${index + 1}`
          ),
          from: -1,
          to: -1,
        })),
      };
      data.alignments = columns.map((column) =>
        fromTabulatorAlign(column.getDefinition().hozAlign ?? null)
      );
      const rows = this.table.getData() as Array<Record<string, unknown>>;
      data.rows = rows.map((row) => ({
        cells: columns.map((column) => ({
          text: toMarkdownText(normalizeCellValue(row[column.getField()])),
          from: -1,
          to: -1,
        })),
      }));
    };

    const commitFromTable = () => {
      if (this.syncing) {
        return;
      }
      rebuildDataFromTable();
      commitTable();
    };

    const getColumnIndex = (column: TabulatorColumn) => {
      if (!this.table) {
        return -1;
      }
      if (column.getField() === "__row_handle") {
        return -1;
      }
      const columns = (this.table.getColumns() as TabulatorColumn[]).filter(
        (candidate) => candidate.getField() !== "__row_handle"
      );
      return columns.indexOf(column);
    };

    const buildHeaderMenu = (column: TabulatorColumn) => {
      if (column.getField() === "__row_handle") {
        return [];
      }
      const columnIndex = getColumnIndex(column);
      return [
        {
          label: "Add column left",
          action: () => {
            if (columnIndex < 0) {
              return;
            }
            insertColumnAt(data, columnIndex);
            syncTableFromData();
            commitTable();
          },
        },
        {
          label: "Add column right",
          action: () => {
            if (columnIndex < 0) {
              return;
            }
            insertColumnAt(data, columnIndex + 1);
            syncTableFromData();
            commitTable();
          },
        },
        {
          label: "Delete column",
          action: () => {
            if (columnIndex < 0) {
              return;
            }
            deleteColumnAt(data, columnIndex);
            syncTableFromData();
            commitTable();
          },
        },
        {
          label: "Rename column",
          action: () => {
            const columnCount = Math.max(1, getColumnCount(data));
            ensureHeader(data, columnCount);
            if (!data.header) {
              return;
            }
            const current = data.header.cells[columnIndex]?.text ?? "";
            const next = window.prompt("Rename column", toDisplayText(current));
            if (next === null) {
              return;
            }
            data.header.cells[columnIndex].text = toMarkdownText(next);
            syncTableFromData();
            commitTable();
          },
        },
        {
          label: "Align left",
          action: () => {
            setColumnAlignment(data, columnIndex, "left");
            syncTableFromData();
            commitTable();
          },
        },
        {
          label: "Align center",
          action: () => {
            setColumnAlignment(data, columnIndex, "center");
            syncTableFromData();
            commitTable();
          },
        },
        {
          label: "Align right",
          action: () => {
            setColumnAlignment(data, columnIndex, "right");
            syncTableFromData();
            commitTable();
          },
        },
        {
          label: "Align default",
          action: () => {
            setColumnAlignment(data, columnIndex, null);
            syncTableFromData();
            commitTable();
          },
        },
      ];
    };

    const rowContextMenu = (row: TabulatorRow) => {
      const rowIndex = row.getPosition();
      return [
        {
          label: "Add row above",
          action: () => {
            insertRowAt(data, rowIndex);
            syncTableFromData();
            commitTable();
          },
        },
        {
          label: "Add row below",
          action: () => {
            insertRowAt(data, rowIndex + 1);
            syncTableFromData();
            commitTable();
          },
        },
        {
          label: "Delete row",
          action: () => {
            deleteRowAt(data, rowIndex);
            syncTableFromData();
            commitTable();
          },
        },
      ];
    };

    const table = new Tabulator(container, {
      data: buildRows(),
      columns: buildColumns(),
      layout: "fitColumns",
      movableRows: true,
      movableColumns: true,
      reactiveData: false,
      selectable: 1,
      selectableRange: true,
      selectableRangeColumns: true,
      selectableRangeClearCells: true,
      selectableRangeMode: "click",
      rowContextMenu,
    });

    this.table = table;

    const clearColumnHover = () => {
      if (this.hoveredColumnEl) {
        this.hoveredColumnEl.classList.remove("tabulator-col-hover");
        this.hoveredColumnEl = null;
      }
    };

    const clearRowHover = () => {
      if (this.hoveredRowEl) {
        this.hoveredRowEl.classList.remove("tabulator-row-hover");
        this.hoveredRowEl = null;
      }
      if (this.hoveredRowHandleEl) {
        this.hoveredRowHandleEl.classList.remove("tabulator-row-handle-hover");
        this.hoveredRowHandleEl = null;
      }
    };

    table.on("cellMouseOver", (_event, cell) => {
      const columnEl = (cell as TabulatorCell).getColumn().getElement();
      if (!columnEl || columnEl === this.hoveredColumnEl) {
        return;
      }
      clearColumnHover();
      columnEl.classList.add("tabulator-col-hover");
      this.hoveredColumnEl = columnEl;
    });

    table.on("cellMouseOut", () => {
      clearColumnHover();
    });

    table.on("rowMouseOver", (_event, row) => {
      const rowEl = (row as TabulatorRow).getElement();
      const handleEl = rowEl.querySelector(".tabulator-cell.tabulator-row-handle");
      if (!rowEl || rowEl === this.hoveredRowEl) {
        return;
      }
      clearRowHover();
      rowEl.classList.add("tabulator-row-hover");
      if (handleEl instanceof HTMLElement) {
        handleEl.classList.add("tabulator-row-handle-hover");
        this.hoveredRowHandleEl = handleEl;
      }
      this.hoveredRowEl = rowEl;
    });

    table.on("rowMouseOut", () => {
      clearRowHover();
    });

    container.addEventListener("mouseleave", () => {
      clearColumnHover();
      clearRowHover();
    });

    const applyHeaderSizing = () => {
      const header = container.querySelector(".tabulator-header");
      if (!(header instanceof HTMLElement)) {
        return;
      }
      header.style.height = "18px";
      header.style.minHeight = "18px";
      header
        .querySelectorAll(
          ".tabulator-col, .tabulator-col-content, .tabulator-col-title-holder"
        )
        .forEach((element) => {
          if (element instanceof HTMLElement) {
            element.style.height = "18px";
          }
        });
    };

    table.on("tableBuilt", applyHeaderSizing);
    table.on("cellEdited", () => {
      applyHeaderSizing();
      commitFromTable();
    });
    table.on("rowMoved", () => {
      applyHeaderSizing();
      commitFromTable();
    });
    table.on("columnMoved", () => {
      applyHeaderSizing();
      commitFromTable();
    });
    table.on("columnResized", applyHeaderSizing);

    requestAnimationFrame(applyHeaderSizing);
    setTimeout(applyHeaderSizing, 0);
    setTimeout(applyHeaderSizing, 100);

    const signal = this.abortController.signal;
    wrapper.addEventListener(
      "focusout",
      (event) => {
        const related = event.relatedTarget;
        if (related instanceof Node && wrapper.contains(related)) {
          return;
        }
        table.deselectRow?.();
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
    this.table?.destroy();
    this.table = null;
  }
}

function dispatchOutsideUpdate(
  view: EditorView,
  transaction: { changes: { from: number; to: number; insert: string }; annotations: Annotation<unknown> }
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
    ".cm-content .cm-table-editor-tabulator__container": {
      width: "100%",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator": {
      border: "none !important",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator-tableholder": {
      border: "none !important",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator-row .tabulator-cell": {
      background: "transparent !important",
      borderRight: "1px solid var(--editor-border) !important",
      borderBottom: "1px solid var(--editor-border) !important",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator-row": {
      background: "transparent !important",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator-row.tabulator-row-odd": {
      background: "transparent !important",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator-row.tabulator-row-even": {
      background: "transparent !important",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator-cell.tabulator-row-handle": {
      padding: "0",
      position: "relative",
      color: "var(--editor-secondary-color)",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator-cell.tabulator-row-handle::after": {
      content: "\"\"",
      position: "absolute",
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      width: "12px",
      height: "3px",
      background: "currentColor",
      boxShadow: "0 5px 0 currentColor, 0 10px 0 currentColor",
      opacity: "0",
      pointerEvents: "none",
      transition: "opacity 120ms ease",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator-row.tabulator-row-hover .tabulator-cell.tabulator-row-handle::after": {
      opacity: "0.9 !important",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator-row:hover .tabulator-cell.tabulator-row-handle::after": {
      opacity: "0.9 !important",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator-cell.tabulator-row-handle.tabulator-row-handle-hover::after": {
      opacity: "0.9 !important",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator-row .tabulator-cell.tabulator-selected": {
      borderColor: "rgba(229, 231, 235, 0.45) !important",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator-row .tabulator-cell.tabulator-range-selected": {
      borderColor: "rgba(229, 231, 235, 0.45) !important",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator-row .tabulator-cell.tabulator-range-highlight": {
      borderColor: "rgba(229, 231, 235, 0.45) !important",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator-header": {
      background: "transparent !important",
      border: "none !important",
      minHeight: "18px !important",
      height: "18px !important",
      padding: "0",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator-headers": {
      background: "var(--editor-surface) !important",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator-header-contents": {
      background: "transparent !important",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator-header .tabulator-col": {
      position: "relative",
      height: "18px !important",
      padding: "0",
      background: "transparent !important",
      borderRight: "1px solid var(--editor-border) !important",
      borderBottom: "1px solid var(--editor-border) !important",
      lineHeight: "18px",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator-header .tabulator-col-content": {
      height: "18px !important",
      padding: "0",
      background: "transparent !important",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator-header .tabulator-col-title-holder": {
      height: "18px !important",
      padding: "0",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator-header .tabulator-col-title": {
      padding: "0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: "100%",
      color: "transparent",
      lineHeight: "18px",
      position: "relative",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator-header-popup-button": {
      opacity: "0.25",
      width: "18px",
      height: "18px",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "16px",
      color: "transparent",
      transition: "opacity 120ms ease",
      userSelect: "none",
      borderRadius: "4px",
      background: "rgba(255, 255, 255, 0.12) !important",
      position: "absolute",
      top: "0",
      right: "0",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator-col:hover .tabulator-header-popup-button": {
      opacity: "1",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator-header-popup-button::before": {
      content: "\"⋮\"",
      color: "var(--editor-secondary-color)",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator-col[tabulator-field=\"__row_handle\"] .tabulator-col-title": {
      display: "none",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator-col[tabulator-field=\"__row_handle\"] .tabulator-header-popup-button": {
      display: "none",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator-col::after": {
      content: "\"\"",
      position: "absolute",
      top: "3px",
      left: "50%",
      transform: "translateX(-50%)",
      width: "12px",
      height: "3px",
      background: "currentColor",
      boxShadow: "0 5px 0 currentColor, 0 10px 0 currentColor",
      color: "var(--editor-secondary-color)",
      opacity: "0",
      pointerEvents: "none",
      transition: "opacity 120ms ease",
    },
    ".cm-content .cm-table-editor-tabulator:hover .tabulator-col:hover::after": {
      opacity: "0.9",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator-col.tabulator-col-hover::after": {
      opacity: "0.9",
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
