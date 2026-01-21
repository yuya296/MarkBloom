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
import { Grid } from "ag-grid-community";
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

type GridApi = any;
type ColumnApi = any;
type GridOptions = Record<string, unknown>;
type MenuItemDef = { name: string; action: () => void };

const alignmentClassName = (alignment: TableAlignment) => {
  switch (alignment) {
    case "left":
      return "cm-table-align-left";
    case "center":
      return "cm-table-align-center";
    case "right":
      return "cm-table-align-right";
    default:
      return "";
  }
};

const alignmentFromClassName = (className?: string | string[]) => {
  const classes = Array.isArray(className) ? className : [className ?? ""];
  if (classes.some((value) => value?.includes("cm-table-align-left"))) {
    return "left" as const;
  }
  if (classes.some((value) => value?.includes("cm-table-align-center"))) {
    return "center" as const;
  }
  if (classes.some((value) => value?.includes("cm-table-align-right"))) {
    return "right" as const;
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
  private gridApi: GridApi | null = null;
  private columnApi: ColumnApi | null = null;
  private readonly abortController = new AbortController();
  private syncing = false;

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
    wrapper.className = "cm-table-editor cm-table-editor-aggrid ag-theme-alpine";
    wrapper.dataset.tableId = String(this.tableInfo.id);
    wrapper.tabIndex = 0;

    const container = document.createElement("div");
    container.className = "cm-table-editor-aggrid__container";
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

    const buildColumnDefs = () => {
      const columnCount = Math.max(1, getColumnCount(data));
      ensureHeader(data, columnCount);
      ensureAlignmentCount(columnCount);
      return Array.from({ length: columnCount }, (_value, index) => {
        const headerName = toDisplayText(
          data.header?.cells[index]?.text ?? `Col ${index + 1}`
        );
        const alignment = alignmentClassName(data.alignments[index] ?? null);
        return {
          headerName,
          field: `col_${index}`,
          editable: true,
          cellClass: alignment || undefined,
          headerClass: alignment || undefined,
        };
      });
    };

    const buildRowData = () =>
      data.rows.map((row) => {
        const rowData: Record<string, string> = {};
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

    const syncGridFromData = () => {
      if (!this.gridApi || !this.columnApi) {
        return;
      }
      this.syncing = true;
      this.gridApi.setColumnDefs(buildColumnDefs());
      this.gridApi.setRowData(buildRowData());
      this.syncing = false;
    };

    const rebuildDataFromGrid = () => {
      if (!this.gridApi || !this.columnApi) {
        return;
      }
      const columns = this.columnApi.getAllDisplayedColumns() as Array<any>;
      const columnCount = columns.length;
      ensureAlignmentCount(columnCount);
      data.header = {
        cells: columns.map((column: any, index: number) => ({
          text: toMarkdownText(column.getColDef().headerName ?? `Col ${index + 1}`),
          from: -1,
          to: -1,
        })),
      };
      data.alignments = columns.map((column: any) =>
        alignmentFromClassName(column.getColDef().cellClass)
      );
      const rows: Array<Record<string, unknown>> = [];
      this.gridApi.forEachNodeAfterFilterAndSort((node: any) => {
        if (node.data) {
          rows.push(node.data);
        }
      });
      data.rows = rows.map((row) => ({
        cells: columns.map((column: any) => ({
          text: toMarkdownText(normalizeCellValue(row[column.getColId()])),
          from: -1,
          to: -1,
        })),
      }));
    };

    const commitFromGrid = () => {
      if (this.syncing) {
        return;
      }
      rebuildDataFromGrid();
      commitTable();
    };

    const getColumnIndex = (colId: string) => {
      if (!this.columnApi) {
        return -1;
      }
      const columns = this.columnApi.getAllDisplayedColumns() as Array<any>;
      return columns.findIndex((column: any) => column.getColId() === colId);
    };

    const createEmptyRow = () => {
      if (!this.columnApi) {
        return {} as Record<string, string>;
      }
      const row: Record<string, string> = {};
      (this.columnApi.getAllDisplayedColumns() as Array<any>).forEach((column: any) => {
        row[column.getColId()] = "";
      });
      return row;
    };

    const getContextMenuItems = (params: { node?: { rowIndex?: number; data?: unknown } }) => {
      const rowIndex = params.node?.rowIndex ?? 0;
      const items: MenuItemDef[] = [
        {
          name: "Add row above",
          action: () => {
            if (this.gridApi) {
              this.gridApi.applyTransaction({
                add: [createEmptyRow()],
                addIndex: rowIndex,
              });
              commitFromGrid();
            }
          },
        },
        {
          name: "Add row below",
          action: () => {
            if (this.gridApi) {
              this.gridApi.applyTransaction({
                add: [createEmptyRow()],
                addIndex: rowIndex + 1,
              });
              commitFromGrid();
            }
          },
        },
        {
          name: "Delete row",
          action: () => {
            if (this.gridApi && params.node?.data) {
              this.gridApi.applyTransaction({ remove: [params.node.data] });
              commitFromGrid();
            }
          },
        },
      ];
      return items;
    };

    const getMainMenuItems = (params: { column?: { getColId: () => string } }) => {
      const colId = params.column?.getColId();
      if (!colId) {
        return [] as MenuItemDef[];
      }
      const columnIndex = getColumnIndex(colId);
      if (columnIndex < 0) {
        return [] as MenuItemDef[];
      }
      return [
        {
          name: "Add column left",
          action: () => {
            insertColumnAt(data, columnIndex);
            syncGridFromData();
            commitTable();
          },
        },
        {
          name: "Add column right",
          action: () => {
            insertColumnAt(data, columnIndex + 1);
            syncGridFromData();
            commitTable();
          },
        },
        {
          name: "Delete column",
          action: () => {
            deleteColumnAt(data, columnIndex);
            syncGridFromData();
            commitTable();
          },
        },
        {
          name: "Rename column",
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
            syncGridFromData();
            commitTable();
          },
        },
        {
          name: "Align left",
          action: () => {
            setColumnAlignment(data, columnIndex, "left");
            syncGridFromData();
            commitTable();
          },
        },
        {
          name: "Align center",
          action: () => {
            setColumnAlignment(data, columnIndex, "center");
            syncGridFromData();
            commitTable();
          },
        },
        {
          name: "Align right",
          action: () => {
            setColumnAlignment(data, columnIndex, "right");
            syncGridFromData();
            commitTable();
          },
        },
        {
          name: "Align default",
          action: () => {
            setColumnAlignment(data, columnIndex, null);
            syncGridFromData();
            commitTable();
          },
        },
      ];
    };

    const gridOptions: GridOptions = {
      columnDefs: buildColumnDefs(),
      rowData: buildRowData(),
      defaultColDef: {
        resizable: true,
        sortable: false,
        suppressMovable: false,
        editable: true,
        cellClassRules: {
          "cm-table-align-left": () => false,
          "cm-table-align-center": () => false,
          "cm-table-align-right": () => false,
        },
      },
      rowDragManaged: true,
      rowDragEntireRow: true,
      animateRows: true,
      suppressRowClickSelection: true,
      rowSelection: "single",
      domLayout: "autoHeight",
      getContextMenuItems,
      getMainMenuItems,
      onCellValueChanged: commitFromGrid,
      onRowDragEnd: commitFromGrid,
      onColumnMoved: commitFromGrid,
      onGridReady: (event: { api: GridApi; columnApi: ColumnApi }) => {
        this.gridApi = event.api;
        this.columnApi = event.columnApi;
      },
    };

    new Grid(container, gridOptions);

    const signal = this.abortController.signal;
    wrapper.addEventListener(
      "focusout",
      (event) => {
        const related = event.relatedTarget;
        if (related instanceof Node && wrapper.contains(related)) {
          return;
        }
        this.gridApi?.clearFocusedCell();
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
    this.gridApi?.destroy();
    this.gridApi = null;
    this.columnApi = null;
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
    ".cm-content .cm-table-editor-aggrid__container": {
      width: "100%",
    },
    ".cm-content .cm-table-editor-aggrid .cm-table-align-left": {
      textAlign: "left",
    },
    ".cm-content .cm-table-editor-aggrid .cm-table-align-center": {
      textAlign: "center",
    },
    ".cm-content .cm-table-editor-aggrid .cm-table-align-right": {
      textAlign: "right",
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
