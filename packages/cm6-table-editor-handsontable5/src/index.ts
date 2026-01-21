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
import Handsontable from "handsontable";
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

const alignmentToClass = (alignment: TableAlignment): string => {
  switch (alignment) {
    case "left":
      return "htLeft";
    case "center":
      return "htCenter";
    case "right":
      return "htRight";
    default:
      return "";
  }
};

const normalizeHeaders = (headers: Array<string | number | null | undefined>) =>
  headers.map((header, index) => {
    if (header === null || header === undefined) {
      return `Col ${index + 1}`;
    }
    return String(header);
  });

const normalizeCellValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
};

const estimateTableHeight = (rowCount: number) => {
  const baseRowHeight = 28;
  const headerHeight = 34;
  const minHeight = 140;
  return Math.max(minHeight, headerHeight + rowCount * baseRowHeight);
};

class TableWidget extends WidgetType {
  private hot: Handsontable | null = null;
  private readonly abortController = new AbortController();

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
    wrapper.className = "cm-table-editor cm-table-editor-handsontable";
    wrapper.dataset.tableId = String(this.tableInfo.id);
    wrapper.tabIndex = 0;

    const container = document.createElement("div");
    container.className = "cm-table-editor-handsontable__container";
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

    const buildHeaders = () => {
      const columnCount = Math.max(1, getColumnCount(data));
      ensureHeader(data, columnCount);
      ensureAlignmentCount(columnCount);
      return normalizeHeaders(
        data.header?.cells.map((cell) => toDisplayText(cell.text)) ?? []
      );
    };

    const buildRows = () =>
      data.rows.map((row) => row.cells.map((cell) => toDisplayText(cell.text)));

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

    const rebuildDataFromHot = () => {
      if (!this.hot) {
        return;
      }
      const hot = this.hot;
      const headers = normalizeHeaders(hot.getColHeader() as Array<string | number | null>);
      const columnCount = headers.length;
      ensureAlignmentCount(columnCount);
      data.header = {
        cells: headers.map((header) => ({
          text: toMarkdownText(header),
          from: -1,
          to: -1,
        })),
      };
      const rows = hot.getData() as Array<Array<unknown>>;
      data.rows = rows.map((row) => ({
        cells: row.map((cell: unknown) => ({
          text: toMarkdownText(normalizeCellValue(cell)),
          from: -1,
          to: -1,
        })),
      }));
    };

    const commitFromHot = () => {
      rebuildDataFromHot();
      if (this.hot) {
        this.hot.updateSettings({ height: estimateTableHeight(this.hot.countRows()) }, false);
      }
      commitTable();
    };

    const updateHeaderAlignment = () => {
      if (!this.hot) {
        return;
      }
      this.hot.render();
    };

    const renameColumn = (columnIndex: number) => {
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
      if (this.hot) {
        this.hot.updateSettings({ colHeaders: buildHeaders() }, false);
      }
      commitTable();
    };

    const applyAlignment = (columnIndex: number, alignment: TableAlignment) => {
      const columnCount = Math.max(1, getColumnCount(data));
      ensureAlignmentCount(columnCount);
      data.alignments[columnIndex] = alignment;
      updateHeaderAlignment();
      commitTable();
    };

    const hot = new Handsontable(container, {
      data: buildRows(),
      colHeaders: buildHeaders(),
      rowHeaders: true,
      height: estimateTableHeight(data.rows.length),
      stretchH: "all",
      manualRowMove: true,
      manualColumnMove: true,
      contextMenu: {
        callback: () => {},
        items: {
          row_above: {},
          row_below: {},
          col_left: {},
          col_right: {},
          remove_row: {},
          remove_col: {},
          rename_col: {
            name: "Rename column",
            callback: () => {
              const selected = hot.getSelectedLast();
              if (!selected) {
                return;
              }
              const colIndex = selected[1];
              if (colIndex < 0) {
                return;
              }
              renameColumn(colIndex);
            },
          },
          align_left: {
            name: "Align left",
            callback: () => {
              const selected = hot.getSelectedLast();
              if (!selected) {
                return;
              }
              const colIndex = selected[1];
              if (colIndex < 0) {
                return;
              }
              applyAlignment(colIndex, "left");
            },
          },
          align_center: {
            name: "Align center",
            callback: () => {
              const selected = hot.getSelectedLast();
              if (!selected) {
                return;
              }
              const colIndex = selected[1];
              if (colIndex < 0) {
                return;
              }
              applyAlignment(colIndex, "center");
            },
          },
          align_right: {
            name: "Align right",
            callback: () => {
              const selected = hot.getSelectedLast();
              if (!selected) {
                return;
              }
              const colIndex = selected[1];
              if (colIndex < 0) {
                return;
              }
              applyAlignment(colIndex, "right");
            },
          },
          align_default: {
            name: "Align default",
            callback: () => {
              const selected = hot.getSelectedLast();
              if (!selected) {
                return;
              }
              const colIndex = selected[1];
              if (colIndex < 0) {
                return;
              }
              applyAlignment(colIndex, null);
            },
          },
        },
      },
      cells: (_row?: number, col?: number) => {
        const columnIndex = typeof col === "number" ? col : 0;
        const className = alignmentToClass(data.alignments[columnIndex] ?? null);
        return className ? { className } : {};
      },
      afterGetColHeader: (col: number, th) => {
        if (!(th instanceof HTMLElement)) {
          return;
        }
        th.classList.remove("htLeft", "htCenter", "htRight");
        const className = alignmentToClass(data.alignments[col] ?? null);
        if (className) {
          th.classList.add(className);
        }
      },
    });

    this.hot = hot;

    const addHook = hot.addHook as unknown as (
      name: string,
      callback: (...args: unknown[]) => void
    ) => void;

    addHook("afterChange", (changes: unknown, source: unknown) => {
      if (!changes || source === "loadData" || source === "updateData") {
        return;
      }
      commitFromHot();
    });

    addHook("afterCreateRow", () => {
      commitFromHot();
    });

    addHook("afterRemoveRow", () => {
      commitFromHot();
    });

    addHook("afterCreateCol", () => {
      ensureAlignmentCount(hot.countCols());
      commitFromHot();
    });

    addHook("afterRemoveCol", () => {
      ensureAlignmentCount(hot.countCols());
      commitFromHot();
    });

    addHook("afterColumnMove", (...args: unknown[]) => {
      const [movedColumns, finalIndex, _dropIndex, _movePossible, orderChanged] =
        args as [number[] | undefined, number, number, boolean, boolean];
      if (!orderChanged || !movedColumns || movedColumns.length === 0) {
        return;
      }
      data.alignments = moveItems(data.alignments, movedColumns, finalIndex);
      commitFromHot();
    });

    addHook("afterRowMove", () => {
      commitFromHot();
    });

    const signal = this.abortController.signal;
    wrapper.addEventListener(
      "focusout",
      (event) => {
        const related = event.relatedTarget;
        if (related instanceof Node && wrapper.contains(related)) {
          return;
        }
        hot.deselectCell();
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
    this.hot?.destroy();
    this.hot = null;
  }
}

const moveItems = <T,>(items: T[], moved: number[], targetIndex: number): T[] => {
  const unique = Array.from(new Set(moved)).sort((a, b) => a - b);
  const remaining = items.filter((_item, index) => !unique.includes(index));
  let insertAt = Math.max(0, Math.min(targetIndex, remaining.length));
  if (unique.length > 0 && targetIndex > unique[0]) {
    insertAt = Math.max(0, insertAt - unique.length);
  }
  const movedItems = unique.map((index) => items[index]).filter((item) => item !== undefined);
  const result = [...remaining];
  result.splice(insertAt, 0, ...movedItems);
  return result;
};

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
    ".cm-content .cm-table-editor-handsontable__container": {
      width: "100%",
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
