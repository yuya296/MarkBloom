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
  getCells: () => TabulatorCell[];
};

type TabulatorRow = {
  getPosition: () => number;
  getCells: () => TabulatorCell[];
  getElement: () => HTMLElement;
};

type TabulatorCell = {
  getColumn: () => TabulatorColumn;
  getRow: () => TabulatorRow;
};

type TabulatorRange = {
  remove: () => void;
};

type HeaderSelection =
  | { kind: "column"; index: number }
  | { kind: "row"; index: number }
  | null;

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
  private activeHeaderSelection: HeaderSelection = null;

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

    const getEffectiveColumnCount = () => Math.max(1, getColumnCount(data));

    type LayoutMode = "fitDataFill" | "fitColumns";

    const resolveLayoutMode = (): LayoutMode =>
      getEffectiveColumnCount() === 1 ? "fitDataFill" : "fitColumns";

    const buildColumns = () => {
      const columnCount = getEffectiveColumnCount();
      ensureHeader(data, columnCount);
      ensureAlignmentCount(columnCount);
      return Array.from({ length: columnCount }, (_value, index) => {
        const title = toDisplayText(data.header?.cells[index]?.text ?? `Col ${index + 1}`);
        const alignment = toTabulatorAlign(data.alignments[index] ?? null);
        return {
          title,
          field: `col_${index}`,
          editor: "input",
          minWidth: 160,
          headerSort: false,
          headerTooltip: title,
          hozAlign: alignment,
          headerHozAlign: alignment,
          titleFormatter: () => {
            const el = document.createElement("div");
            el.className = "mb-col-header";
            const handle = document.createElement("button");
            handle.type = "button";
            handle.className = "mb-col-handle-btn";
            handle.tabIndex = -1;
            handle.setAttribute("aria-label", "Select column");
            handle.textContent = ":::";
            const label = document.createElement("span");
            label.className = "mb-col-title";
            label.textContent = title;
            el.appendChild(handle);
            el.appendChild(label);
            return el;
          },
          headerClick: (event: MouseEvent, column: TabulatorColumn) => {
            const target = event.target;
            if (!(target instanceof Element) || !target.closest(".mb-col-handle-btn")) {
              this.activeHeaderSelection = null;
              return;
            }
            event.preventDefault();
            event.stopPropagation();
            const columnIndex = getDataColumns().indexOf(column);
            if (columnIndex >= 0) {
              selectColumnRange(columnIndex);
            }
          },
          headerContextMenu: (_event: MouseEvent, column: TabulatorColumn) => {
            const columnIndex = getDataColumns().indexOf(column);
            return columnMenuFor(columnIndex);
          },
        };
      });
    };

    const buildRows = () =>
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

    const isDataField = (field?: string | null) => Boolean(field?.startsWith("col_"));

    const getDataColumns = () =>
      ((this.table?.getColumns() as TabulatorColumn[] | undefined) ?? []).filter((column) =>
        isDataField(column.getField())
      );

    const clearRanges = () => {
      const ranges = (this.table?.getRanges?.() as TabulatorRange[] | undefined) ?? [];
      ranges.forEach((range) => range.remove());
    };

    let currentLayoutMode: LayoutMode = resolveLayoutMode();

    const mountTable = (layoutMode: LayoutMode) => {
      const table = new Tabulator(container, {
        data: buildRows(),
        columns: buildColumns(),
        layout: layoutMode,
        reactiveData: false,
        rowHeader: false,
        rowFormatter: (row: TabulatorRow) => {
          const rowElement = row.getElement();
          const firstCell = rowElement.querySelector(".tabulator-cell");
          if (!(firstCell instanceof HTMLElement)) {
            return;
          }
          if (firstCell.querySelector(".mb-row-handle-btn")) {
            return;
          }
          const handle = document.createElement("button");
          handle.type = "button";
          handle.className = "mb-row-handle-btn";
          handle.tabIndex = -1;
          handle.setAttribute("aria-label", "Select row");
          handle.textContent = ":::";
          handle.addEventListener("mousedown", (event) => {
            event.preventDefault();
          });
          handle.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const rowIndex = (row.getPosition() ?? 1) - 1;
            if (rowIndex >= 0) {
              selectRowRange(rowIndex);
            }
          });
          firstCell.append(handle);
        },
        editTriggerEvent: "dblclick",
        selectableRange: 1,
        selectableRangeColumns: true,
        selectableRangeRows: false,
        selectableRangeClearCells: true,
        selectableRangeMode: "click",
        clipboard: true,
        clipboardCopyStyled: false,
        clipboardCopyRowRange: "range",
        clipboardCopyConfig: {
          rowHeaders: false,
          columnHeaders: false,
        },
        clipboardPasteParser: "range",
        clipboardPasteAction: "range",
        rowContextMenu: (_event: MouseEvent, row: TabulatorRow) => {
          const rowIndex = (row.getPosition() ?? 1) - 1;
          return rowMenuFor(rowIndex);
        },
      });

      this.table = table;
      table.on("cellEdited", commitFromTable);
      table.on("clipboardPasted", commitFromTable);
      table.on("cellClick", (_event: MouseEvent, cell: TabulatorCell) => {
        if (!isDataField(cell.getColumn().getField())) {
          return;
        }
        this.activeHeaderSelection = null;
      });
      currentLayoutMode = layoutMode;
    };

    const syncTableFromData = () => {
      if (!this.table) {
        return;
      }
      const nextLayoutMode = resolveLayoutMode();
      if (nextLayoutMode !== currentLayoutMode) {
        this.table.destroy();
        container.textContent = "";
        this.table = null;
        mountTable(nextLayoutMode);
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
      const columns = getDataColumns();
      const columnCount = columns.length;
      ensureAlignmentCount(columnCount);
      data.alignments = columns.map((column) =>
        fromTabulatorAlign(column.getDefinition().hozAlign ?? null)
      );
      const rows = this.table.getData() as Array<Record<string, unknown>>;
      const cellsFromRow = (row: Record<string, unknown>) =>
        columns.map((column) => ({
          text: toMarkdownText(normalizeCellValue(row[column.getField()])),
          from: -1,
          to: -1,
        }));
      data.header = {
        cells: columns.map((column, index) => ({
          text: toMarkdownText(column.getDefinition().title ?? `Col ${index + 1}`),
          from: -1,
          to: -1,
        })),
      };
      data.rows = rows.map((row) => ({
        cells: cellsFromRow(row),
      }));
    };

    const commitFromTable = () => {
      if (this.syncing) {
        return;
      }
      rebuildDataFromTable();
      commitTable();
    };

    const selectColumnRange = (columnIndex: number) => {
      if (!this.table) {
        return;
      }
      const column = getDataColumns()[columnIndex];
      if (!column) {
        return;
      }
      const cells = column.getCells();
      if (!cells.length) {
        return;
      }
      clearRanges();
      this.table.addRange(cells[0], cells[cells.length - 1]);
      this.activeHeaderSelection = { kind: "column", index: columnIndex };
    };

    const selectRowRange = (rowIndex: number) => {
      if (!this.table) {
        return;
      }
      const row = (this.table.getRows() as TabulatorRow[])[rowIndex];
      if (!row) {
        return;
      }
      const cells = row
        .getCells()
        .filter((cell) => isDataField(cell.getColumn().getField()));
      if (!cells.length) {
        return;
      }
      clearRanges();
      this.table.addRange(cells[0], cells[cells.length - 1]);
      this.activeHeaderSelection = { kind: "row", index: rowIndex };
    };

    const columnMenuFor = (columnIndex: number) => {
      if (
        !this.activeHeaderSelection ||
        this.activeHeaderSelection.kind !== "column" ||
        this.activeHeaderSelection.index !== columnIndex
      ) {
        return [];
      }
      return [
        {
          label: "Insert column left",
          action: () => {
            insertColumnAt(data, columnIndex);
            syncTableFromData();
            commitTable();
          },
        },
        {
          label: "Insert column right",
          action: () => {
            insertColumnAt(data, columnIndex + 1);
            syncTableFromData();
            commitTable();
          },
        },
        {
          label: "Delete column",
          action: () => {
            deleteColumnAt(data, columnIndex);
            syncTableFromData();
            commitTable();
          },
        },
      ];
    };

    const rowMenuFor = (rowIndex: number) => {
      if (
        !this.activeHeaderSelection ||
        this.activeHeaderSelection.kind !== "row" ||
        this.activeHeaderSelection.index !== rowIndex
      ) {
        return [];
      }
      return [
        {
          label: "Insert row above",
          action: () => {
            insertRowAt(data, rowIndex);
            syncTableFromData();
            commitTable();
          },
        },
        {
          label: "Insert row below",
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

    mountTable(currentLayoutMode);

    const signal = this.abortController.signal;
    wrapper.addEventListener(
      "focusout",
      (event) => {
        const related = event.relatedTarget;
        if (related instanceof Node && wrapper.contains(related)) {
          return;
        }
        this.table?.deselectRow?.();
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
      position: "relative",
    },
    ".cm-content .cm-table-editor-tabulator__container": {
      width: "100%",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator": {
      border: "none",
      background: "var(--editor-bg, #fff)",
      color: "var(--editor-foreground, #202124)",
      borderRadius: "8px",
      boxShadow: "0 1px 2px rgba(60,64,67,0.18)",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator-tableholder": {
      overflowX: "visible !important",
      background: "var(--editor-bg, #fff)",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator-header": {
      background: "var(--editor-bg, #fff)",
      borderBottom: "1px solid color-mix(in srgb, var(--editor-border, #dadce0) 85%, transparent)",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator-col": {
      background: "var(--editor-bg, #fff)",
      color: "var(--editor-secondary-color, #5f6368)",
      fontWeight: "500",
      borderTop: "1px solid color-mix(in srgb, var(--editor-border, #dadce0) 85%, transparent)",
      borderRight: "1px solid color-mix(in srgb, var(--editor-border, #dadce0) 70%, transparent)",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator-row": {
      overflow: "visible",
      position: "relative",
      background: "var(--editor-bg, #fff)",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator-row .tabulator-cell": {
      borderBottom: "1px solid color-mix(in srgb, var(--editor-border, #dadce0) 70%, transparent)",
      borderRight: "1px solid color-mix(in srgb, var(--editor-border, #dadce0) 70%, transparent)",
      background: "var(--editor-bg, #fff)",
      color: "var(--editor-foreground, #202124)",
      padding: "8px 10px",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator-row:hover .tabulator-cell": {
      background: "color-mix(in srgb, var(--editor-bg, #fff) 92%, var(--editor-border, #dadce0))",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator-row .tabulator-cell:first-child": {
      borderLeft: "1px solid color-mix(in srgb, var(--editor-border, #dadce0) 70%, transparent)",
      position: "relative",
    },
    ".cm-content .cm-table-editor-tabulator .mb-col-header": {
      position: "relative",
      minHeight: "16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      paddingTop: "6px",
    },
    ".cm-content .cm-table-editor-tabulator .mb-col-handle-btn": {
      position: "absolute",
      top: "-2px",
      left: "50%",
      transform: "translateX(-50%)",
      opacity: "0",
      pointerEvents: "none",
      border: "none",
      background: "transparent",
      color: "var(--editor-secondary-color)",
      lineHeight: "1",
      fontSize: "11px",
      cursor: "pointer",
      padding: "0",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator-col:hover .mb-col-handle-btn": {
      opacity: "0.95",
      pointerEvents: "auto",
    },
    ".cm-content .cm-table-editor-tabulator .mb-row-handle-btn": {
      position: "absolute",
      left: "-12px",
      top: "50%",
      transform: "translateY(-50%)",
      opacity: "0",
      pointerEvents: "none",
      border: "none",
      background: "transparent",
      color: "var(--editor-secondary-color, #5f6368)",
      lineHeight: "1",
      fontSize: "11px",
      letterSpacing: "-1px",
      zIndex: "2",
      cursor: "pointer",
      padding: "0",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator-row:hover .mb-row-handle-btn, .cm-content .cm-table-editor-tabulator .tabulator-row .tabulator-cell:first-child:hover .mb-row-handle-btn": {
      opacity: "1",
      pointerEvents: "auto",
      color: "var(--editor-secondary-color, #5f6368)",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator-row .tabulator-cell.tabulator-range-selected": {
      backgroundColor: "color-mix(in srgb, var(--editor-primary-color, #1a73e8) 15%, var(--editor-bg, #fff))",
      borderColor: "var(--editor-primary-color, #1a73e8)",
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
