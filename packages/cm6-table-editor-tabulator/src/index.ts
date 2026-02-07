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

const tableEditAnnotation = Annotation.define<boolean>();
const defaultOptions: Required<TableEditorOptions> = {
  enabled: true,
  renderMode: "widget",
};

type TabulatorColumn = {
  getDefinition: () => { title?: string; field?: string; hozAlign?: string | null };
  getField: () => string;
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
      return Array.from({ length: columnCount }, (_value, index) => {
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

    const rebuildDataFromTable = () => {
      if (!this.table) {
        return;
      }
      const columns = this.table.getColumns() as TabulatorColumn[];
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

    const table = new Tabulator(container, {
      data: buildRows(),
      columns: buildColumns(),
      layout: "fitColumns",
      reactiveData: false,
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
    });

    this.table = table;
    table.on("cellEdited", commitFromTable);
    table.on("clipboardPasted", commitFromTable);

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
      position: "relative",
    },
    ".cm-content .cm-table-editor-tabulator__container": {
      width: "100%",
    },
    ".cm-content .cm-table-editor-tabulator .tabulator-row .tabulator-cell.tabulator-range-selected": {
      backgroundColor: "var(--editor-selection-bg)",
      borderColor: "var(--editor-primary-color)",
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
