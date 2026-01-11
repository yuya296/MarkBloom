import { syntaxTree } from "@codemirror/language";
import { Annotation, RangeSetBuilder, type Extension } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
  keymap,
} from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { TabulatorFull as Tabulator } from "tabulator-tables";
import "tabulator-tables/dist/css/tabulator.min.css";

export type TableEditorOptions = {
  enabled?: boolean;
  renderMode?: "widget" | "none";
  editMode?: "sourceOnFocus" | "inlineCellEdit";
};

type TableRow = {
  cells: Array<{ text: string; from: number; to: number }>;
};

type TableData = {
  header: TableRow | null;
  rows: TableRow[];
};

type TableColumn = {
  field: string;
  title: string;
};

type TableSourceRow = Record<string, string>;

type TableInfo = {
  id: number;
  from: number;
  to: number;
  startLineFrom: number;
  endLineFrom: number;
  lineBeforeFrom: number | null;
  lineAfterFrom: number | null;
  rowCount: number;
  colCount: number;
};

type TableRegistryEntry = {
  focusCell: (rowIndex: number, colIndex: number) => boolean;
  lastFocus: { rowIndex: number; colIndex: number } | null;
};

const tableEditAnnotation = Annotation.define<boolean>();
const defaultRowSize = 27;
const defaultOptions: Required<TableEditorOptions> = {
  enabled: true,
  renderMode: "widget",
  editMode: "sourceOnFocus",
};

const tableRegistry = new Map<number, TableRegistryEntry>();

function registerTable(tableId: number, entry: TableRegistryEntry) {
  tableRegistry.set(tableId, entry);
}

function unregisterTable(tableId: number) {
  tableRegistry.delete(tableId);
}

function updateFocus(tableId: number, focus: { rowIndex: number; colIndex: number }) {
  const entry = tableRegistry.get(tableId);
  if (entry) {
    entry.lastFocus = focus;
  }
}

function focusGridCell(tableId: number, rowIndex: number, colIndex: number): boolean {
  const entry = tableRegistry.get(tableId);
  if (!entry) {
    return false;
  }
  return entry.focusCell(rowIndex, colIndex);
}

class TableWidget extends WidgetType {
  private table: unknown;

  constructor(
    private readonly view: EditorView,
    private readonly data: TableData,
    private readonly isEditable: boolean,
    private readonly tableInfo: TableInfo
  ) {
    super();
  }

  eq(other: TableWidget): boolean {
    return (
      this.isEditable === other.isEditable &&
      this.tableInfo.id === other.tableInfo.id &&
      JSON.stringify(this.data) === JSON.stringify(other.data)
    );
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "cm-table-editor cm-table-editor-tabulator";
    wrapper.dataset.tableId = String(this.tableInfo.id);

    const columns = safeClone(buildColumns(this.data));
    const source = safeClone(buildSource(this.data, columns.length));
    const updateHeader = (colIndex: number, nextValue: string, headerElement?: HTMLElement) => {
      const header = this.data.header;
      const headerCell = header?.cells[colIndex];
      if (!headerCell) {
        return;
      }
      const insert = toMarkdownText(nextValue);
      if (insert === headerCell.text) {
        return;
      }
      headerCell.text = insert;
      const nextTitle = toPlainText(nextValue);
      columns[colIndex].title = nextTitle;
      this.view.dispatch({
        changes: { from: headerCell.from, to: headerCell.to, insert },
        annotations: tableEditAnnotation.of(true),
      });
      const field = columns[colIndex]?.field;
      const tabulatorApi = tabulator as {
        getColumn?: (field: string) => { updateDefinition?: (next: Record<string, unknown>) => void };
      };
      const column = field ? tabulatorApi.getColumn?.(field) : null;
      column?.updateDefinition?.({ title: nextTitle });
      const titleElement =
        headerElement?.querySelector<HTMLElement>(".tabulator-col-title") ?? null;
      if (titleElement) {
        titleElement.textContent = nextTitle;
      }
    };

    const tabulator = new Tabulator(wrapper, {
      data: source,
      columns: columns.map((column) => ({
        title: column.title,
        field: column.field,
        editor: "textarea",
        formatter: "textarea",
      })),
      layout: "fitDataTable",
      variableHeight: true,
      rowHeight: defaultRowSize,
      clipboard: true,
      selectable: true,
    });

    this.table = tabulator;

    const focusCell = (rowIndex: number, colIndex: number): boolean => {
      const field = columns[colIndex]?.field;
      if (!field) {
        return false;
      }
      const tableInstance = tabulator as unknown as {
        setActiveCell?: (row: number, column: string) => void;
        getRow?: (row: number) => {
          getCell?: (field: string) => {
            getElement?: () => HTMLElement | null;
          };
        };
      };
      if (typeof tableInstance.setActiveCell === "function") {
        tableInstance.setActiveCell(rowIndex, field);
        return true;
      }
      const row = tableInstance.getRow?.(rowIndex);
      const cell = row?.getCell?.(field);
      const element = cell?.getElement?.();
      if (element) {
        element.focus();
        return true;
      }
      return false;
    };

    registerTable(this.tableInfo.id, {
      focusCell,
      lastFocus: null,
    });

    const onCellEdited = (cell: unknown) => {
      const info = extractCellInfo(cell, columns);
      if (!info) {
        return;
      }
      const { rowIndex, colIndex, value } = info;
      const row = this.data.rows[rowIndex];
      if (!row) {
        return;
      }
      const cellMeta = row.cells[colIndex];
      if (!cellMeta) {
        return;
      }
      const insert = toMarkdownText(String(value ?? ""));
      if (insert === cellMeta.text) {
        return;
      }
      this.view.dispatch({
        changes: { from: cellMeta.from, to: cellMeta.to, insert },
        annotations: tableEditAnnotation.of(true),
      });
    };

    const onCellFocus = (cell: unknown) => {
      const info = extractCellInfo(cell, columns);
      if (!info) {
        return;
      }
      updateFocus(this.tableInfo.id, { rowIndex: info.rowIndex, colIndex: info.colIndex });
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
        return;
      }
      const entry = tableRegistry.get(this.tableInfo.id);
      const focus = entry?.lastFocus;
      if (!focus) {
        return;
      }
      if (event.key === "ArrowUp" && focus.rowIndex === 0 && this.tableInfo.lineBeforeFrom != null) {
        event.preventDefault();
        moveCursorToLine(this.view, this.tableInfo.lineBeforeFrom);
        return;
      }
      if (
        event.key === "ArrowDown" &&
        focus.rowIndex === this.tableInfo.rowCount - 1 &&
        this.tableInfo.lineAfterFrom != null
      ) {
        event.preventDefault();
        moveCursorToLine(this.view, this.tableInfo.lineAfterFrom);
      }
    };

    const onHeaderDblClick = (event: MouseEvent) => {
      if (!this.isEditable) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const headerCell = target?.closest(".tabulator-col") as HTMLElement | null;
      if (!headerCell) {
        return;
      }
      const field = headerCell.dataset.field;
      if (!field) {
        return;
      }
      const colIndex = columns.findIndex((col) => col.field === field);
      if (colIndex < 0) {
        return;
      }
      const headerData = this.data.header?.cells[colIndex];
      if (!headerData) {
        return;
      }
      const currentValue = toDisplayText(headerData.text);
      const nextValue = window.prompt("Edit header", currentValue);
      if (nextValue == null) {
        return;
      }
      updateHeader(colIndex, nextValue, headerCell);
    };

    (tabulator as unknown as { on?: (event: string, cb: (...args: any[]) => void) => void })
      .on?.("cellEdited", onCellEdited);
    (tabulator as unknown as { on?: (event: string, cb: (...args: any[]) => void) => void })
      .on?.("cellClick", (_event: unknown, cell: unknown) => onCellFocus(cell));
    (tabulator as unknown as { on?: (event: string, cb: (...args: any[]) => void) => void })
      .on?.("cellEdited", onCellFocus);

    wrapper.addEventListener("keydown", onKeyDown);
    wrapper.addEventListener("dblclick", onHeaderDblClick);

    (wrapper as HTMLElement & {
      __cmOnKeyDown?: (event: KeyboardEvent) => void;
      __cmOnHeaderDblClick?: (event: MouseEvent) => void;
    }).__cmOnKeyDown = onKeyDown;
    (wrapper as HTMLElement & {
      __cmOnKeyDown?: (event: KeyboardEvent) => void;
      __cmOnHeaderDblClick?: (event: MouseEvent) => void;
    }).__cmOnHeaderDblClick = onHeaderDblClick;

    return wrapper;
  }

  ignoreEvent(): boolean {
    return this.isEditable;
  }

  destroy(dom: HTMLElement): void {
    const wrapper = dom as HTMLElement & {
      __cmOnKeyDown?: (event: KeyboardEvent) => void;
      __cmOnHeaderDblClick?: (event: MouseEvent) => void;
    };
    if (wrapper.__cmOnKeyDown) {
      wrapper.removeEventListener("keydown", wrapper.__cmOnKeyDown);
    }
    if (wrapper.__cmOnHeaderDblClick) {
      wrapper.removeEventListener("dblclick", wrapper.__cmOnHeaderDblClick);
    }
    if (this.table && typeof (this.table as { destroy?: () => void }).destroy === "function") {
      (this.table as { destroy?: () => void }).destroy?.();
    }
    unregisterTable(this.tableInfo.id);
  }
}

function safeClone<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}

function isSelectionInside(view: EditorView, from: number, to: number): boolean {
  return view.state.selection.ranges.some((range) => {
    if (range.from === range.to) {
      return range.from >= from && range.from <= to;
    }
    return range.from < to && range.to > from;
  });
}

function collectTableData(view: EditorView, node: SyntaxNode): TableData {
  const headerNode = node.getChild("TableHeader");
  const rowNodes = node.getChildren("TableRow");
  const header = headerNode ? { cells: collectCells(view, headerNode) } : null;
  const rows = rowNodes.map((row) => ({ cells: collectCells(view, row) }));
  return { header, rows };
}

function collectTableLines(view: EditorView, from: number, to: number) {
  const lines = [];
  const startLine = view.state.doc.lineAt(from);
  const endLine = view.state.doc.lineAt(Math.max(from, to - 1));
  for (let lineNumber = startLine.number; lineNumber <= endLine.number; lineNumber += 1) {
    lines.push(view.state.doc.line(lineNumber));
  }
  return lines;
}

function collectCells(
  view: EditorView,
  rowNode: SyntaxNode
): Array<{ text: string; from: number; to: number }> {
  const cells: Array<{ text: string; from: number; to: number }> = [];
  for (let child = rowNode.firstChild; child; child = child.nextSibling) {
    if (child.name === "TableCell") {
      cells.push({
        text: view.state.doc.sliceString(child.from, child.to).trim(),
        from: child.from,
        to: child.to,
      });
    }
  }
  return cells;
}

function buildColumns(data: TableData): TableColumn[] {
  const columns: TableColumn[] = [];
  const maxCells = Math.max(
    data.header?.cells.length ?? 0,
    ...data.rows.map((row) => row.cells.length),
    0
  );

  for (let index = 0; index < maxCells; index += 1) {
    const headerText = data.header?.cells[index]?.text ?? `Col ${index + 1}`;
    columns.push({ field: `c${index}`, title: toPlainText(headerText) });
  }
  return columns;
}

function buildSource(data: TableData, columnCount: number): TableSourceRow[] {
  return data.rows.map((row) => {
    const record: TableSourceRow = {};
    for (let index = 0; index < columnCount; index += 1) {
      record[`c${index}`] = toDisplayText(toPlainText(row.cells[index]?.text ?? ""));
    }
    return record;
  });
}

function toPlainText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value == null) {
    return "";
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function toDisplayText(value: string): string {
  return value.replace(/<br\s*\/?>/gi, "\n");
}

function toMarkdownText(value: string): string {
  return value.replace(/\r?\n/g, "<br>");
}

function extractCellInfo(
  cell: unknown,
  columns: TableColumn[]
): { rowIndex: number; colIndex: number; value: unknown } | null {
  const cellApi = cell as {
    getRow?: () => { getPosition?: (visible?: boolean) => number; getIndex?: () => number | string };
    getColumn?: () => { getField?: () => string | undefined };
    getField?: () => string | undefined;
    getValue?: () => unknown;
  };

  const rowComponent = cellApi.getRow?.();
  const rawRowIndex = rowComponent?.getPosition?.(true) ?? rowComponent?.getIndex?.();
  const rowIndex = typeof rawRowIndex === "number" ? rawRowIndex : Number(rawRowIndex);

  const field = cellApi.getColumn?.().getField?.() ?? cellApi.getField?.();
  if (typeof rowIndex !== "number" || Number.isNaN(rowIndex) || !field) {
    return null;
  }

  const colIndex = columns.findIndex((col) => col.field === field);
  if (colIndex < 0) {
    return null;
  }

  return { rowIndex, colIndex, value: cellApi.getValue?.() };
}

function moveCursorToLine(view: EditorView, lineFrom: number) {
  view.dispatch({ selection: { anchor: lineFrom }, scrollIntoView: true });
  view.focus();
}

function buildDecorations(
  view: EditorView,
  options: Required<TableEditorOptions>
): { decorations: DecorationSet; tables: TableInfo[] } {
  const builder = new RangeSetBuilder<Decoration>();
  const tables: TableInfo[] = [];

  if (!options.enabled || options.renderMode !== "widget") {
    return { decorations: builder.finish(), tables };
  }

  const shouldRenderRich = (from: number, to: number) => {
    if (options.editMode !== "sourceOnFocus") {
      return true;
    }
    return !isSelectionInside(view, from, to);
  };

  const visibleRanges = view.visibleRanges;
  const isVisible = (from: number, to: number) =>
    visibleRanges.some((range) => from < range.to && to > range.from);

  let tableId = 0;

  syntaxTree(view.state).iterate({
    enter: (node) => {
      if (node.name !== "Table") {
        return;
      }
      if (!isVisible(node.from, node.to)) {
        return;
      }
      if (!shouldRenderRich(node.from, node.to)) {
        return;
      }

      const data = collectTableData(view, node.node);
      const lines = collectTableLines(view, node.from, node.to);
      if (lines.length === 0) {
        return;
      }

      const firstLine = lines[0];
      const lastLine = lines[lines.length - 1];
      const lineBefore = firstLine.number > 1 ? view.state.doc.line(firstLine.number - 1) : null;
      const lineAfter =
        lastLine.number < view.state.doc.lines
          ? view.state.doc.line(lastLine.number + 1)
          : null;

      const columns = buildColumns(data);
      const info: TableInfo = {
        id: tableId,
        from: node.from,
        to: node.to,
        startLineFrom: firstLine.from,
        endLineFrom: lastLine.from,
        lineBeforeFrom: lineBefore ? lineBefore.from : null,
        lineAfterFrom: lineAfter ? lineAfter.from : null,
        rowCount: data.rows.length,
        colCount: columns.length,
      };
      tables.push(info);

      const pending: Array<{ from: number; to: number; decoration: Decoration }> = [];
      const widgetDecoration = Decoration.replace({
        widget: new TableWidget(view, data, options.editMode === "inlineCellEdit", info),
        inclusive: false,
      });
      pending.push({ from: firstLine.from, to: firstLine.to, decoration: widgetDecoration });

      for (let i = 1; i < lines.length; i += 1) {
        const line = lines[i];
        pending.push({
          from: line.from,
          to: line.to,
          decoration: Decoration.replace({ inclusive: false }),
        });
        pending.push({
          from: line.from,
          to: line.from,
          decoration: Decoration.line({ class: "cm-table-editor-hidden" }),
        });
      }

      pending.sort((a, b) => (a.from === b.from ? a.to - b.to : a.from - b.from));
      for (const item of pending) {
        builder.add(item.from, item.to, item.decoration);
      }

      tableId += 1;
    },
  });

  return { decorations: builder.finish(), tables };
}

function handleArrowFromEditor(
  view: EditorView,
  tables: TableInfo[],
  direction: "up" | "down"
): boolean {
  const head = view.state.selection.main.head;
  const line = view.state.doc.lineAt(head);
  if (direction === "down") {
    const table = tables.find((info) => info.lineBeforeFrom === line.from);
    if (!table) {
      return false;
    }
    return focusGridCell(table.id, 0, 0);
  }

  const table = tables.find((info) => info.lineAfterFrom === line.from);
  if (!table) {
    return false;
  }
  const lastRow = Math.max(0, table.rowCount - 1);
  return focusGridCell(table.id, lastRow, 0);
}

export function tableEditor(options: TableEditorOptions = {}): Extension {
  const resolved = { ...defaultOptions, ...options };

  const theme = EditorView.baseTheme({
    ".cm-content .cm-table-editor": {
      overflowX: "auto",
      margin: "0.5rem 0",
    },
    ".cm-content .cm-table-editor .tabulator": {
      background: "transparent",
    },
    ".cm-content .cm-table-editor .tabulator-cell": {
      whiteSpace: "pre-wrap",
    },
    ".cm-content .cm-table-editor-hidden": {
      padding: "0",
      margin: "0",
      border: "0",
      visibility: "hidden",
    },
  });

  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      tables: TableInfo[];

      constructor(view: EditorView) {
        const state = buildDecorations(view, resolved);
        this.decorations = state.decorations;
        this.tables = state.tables;
      }

      update(update: ViewUpdate) {
        const isTableEdit = update.transactions.some(
          (transaction) => transaction.annotation(tableEditAnnotation) === true
        );
        if (update.docChanged && isTableEdit) {
          this.decorations = this.decorations.map(update.changes);
          this.tables = this.tables.map((table) => ({
            ...table,
            from: update.changes.mapPos(table.from),
            to: update.changes.mapPos(table.to),
            startLineFrom: update.changes.mapPos(table.startLineFrom),
            endLineFrom: update.changes.mapPos(table.endLineFrom),
            lineBeforeFrom:
              table.lineBeforeFrom != null ? update.changes.mapPos(table.lineBeforeFrom) : null,
            lineAfterFrom:
              table.lineAfterFrom != null ? update.changes.mapPos(table.lineAfterFrom) : null,
          }));
          return;
        }
        if (update.docChanged || update.viewportChanged || update.selectionSet) {
          const state = buildDecorations(update.view, resolved);
          this.decorations = state.decorations;
          this.tables = state.tables;
        }
      }
    },
    {
      decorations: (view) => view.decorations,
    }
  );

  const navKeymap = keymap.of([
    {
      key: "ArrowDown",
      run: (view) => {
        const instance = view.plugin(plugin) as { tables: TableInfo[] } | null;
        if (!instance) {
          return false;
        }
        return handleArrowFromEditor(view, instance.tables, "down");
      },
    },
    {
      key: "ArrowUp",
      run: (view) => {
        const instance = view.plugin(plugin) as { tables: TableInfo[] } | null;
        if (!instance) {
          return false;
        }
        return handleArrowFromEditor(view, instance.tables, "up");
      },
    },
  ]);

  return [theme, plugin, navKeymap];
}
