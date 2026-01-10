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
  prop: string;
  name: string;
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
  grid: HTMLElement;
  rows: number;
  cols: number;
  lastFocus: { rowIndex: number; colIndex: number } | null;
};

const tableEditAnnotation = Annotation.define<boolean>();

const defaultOptions: Required<TableEditorOptions> = {
  enabled: true,
  renderMode: "widget",
  editMode: "sourceOnFocus",
};

let customElementsRegistered = false;
let customElementsPromise: Promise<void> | null = null;
const tableRegistry = new Map<number, TableRegistryEntry>();

function ensureCustomElements() {
  if (customElementsRegistered || customElementsPromise) {
    return;
  }
  customElementsPromise = import("@revolist/revogrid/loader")
    .then((mod) => {
      mod.defineCustomElements(window);
      customElementsRegistered = true;
    })
    .catch(() => {
      customElementsPromise = null;
    });
}

function registerTable(tableId: number, grid: HTMLElement, rows: number, cols: number) {
  tableRegistry.set(tableId, { grid, rows, cols, lastFocus: null });
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

  const grid = entry.grid as HTMLElement & {
    setCellsFocus?: (
      cellStart?: { x: number; y: number },
      cellEnd?: { x: number; y: number },
      colType?: string,
      rowType?: string
    ) => Promise<void>;
  };

  grid.focus();

  if (typeof grid.setCellsFocus === "function") {
    grid.setCellsFocus({ x: colIndex, y: rowIndex }, { x: colIndex, y: rowIndex }, "rgCol", "rgRow");
    return true;
  }

  return false;
}

class TableWidget extends WidgetType {
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
    ensureCustomElements();
    const wrapper = document.createElement("div");
    wrapper.className = "cm-table-editor";
    wrapper.dataset.tableId = String(this.tableInfo.id);

    const grid = document.createElement("revo-grid") as HTMLElement & {
      columns: TableColumn[];
      source: TableSourceRow[];
      readonly: boolean;
      rowHeaders: boolean;
      range: boolean;
      useClipboard: boolean;
      autoSizeColumn: boolean;
      canFocus: boolean;
      rowClass: string;
      theme: string;
      refresh?: () => Promise<void>;
      componentOnReady?: () => Promise<void>;
    };

    const columns = safeClone(sanitizeColumns(buildColumns(this.data)));
    const source = safeClone(sanitizeSource(buildSource(this.data, columns.length)));

    let applied = false;
    const applyConfig = () => {
      if (applied) {
        return;
      }
      applied = true;
      grid.columns = columns;
      grid.source = source;
      grid.readonly = !this.isEditable;
      grid.canFocus = true;
      grid.rowHeaders = false;
      grid.rowClass = "";
      grid.theme = "default";
      grid.range = false;
      grid.useClipboard = false;
      grid.autoSizeColumn = true;
      grid.tabIndex = 0;
      if (typeof grid.refresh === "function") {
        grid.refresh();
      }
    };

    if (typeof grid.componentOnReady === "function") {
      grid.componentOnReady().then(applyConfig).catch(applyConfig);
    } else {
      queueMicrotask(applyConfig);
    }

    registerTable(this.tableInfo.id, grid, this.tableInfo.rowCount, this.tableInfo.colCount);

  const onAfterEdit = (event: Event) => {
      const detail = (event as CustomEvent).detail as Record<string, unknown>;
      const edit = extractEdit(detail, columns);
      if (!edit) {
        return;
      }
      const { rowIndex, colIndex, value } = edit;
      const row = this.data.rows[rowIndex];
      if (!row) {
        return;
      }
      const cell = row.cells[colIndex];
      if (!cell) {
        return;
      }
      const insert = String(value ?? "");
      if (insert === cell.text) {
        return;
      }
      this.view.dispatch({
        changes: { from: cell.from, to: cell.to, insert },
        annotations: tableEditAnnotation.of(true),
      });
    };

    const onAfterFocus = (event: Event) => {
      const detail = (event as CustomEvent).detail as Record<string, unknown>;
      const focus = extractFocus(detail, columns);
      if (!focus) {
        return;
      }
      updateFocus(this.tableInfo.id, focus);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
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

    grid.addEventListener("afteredit", onAfterEdit);
    grid.addEventListener("afterfocus", onAfterFocus);
    grid.addEventListener("keydown", onKeyDown);

    (grid as HTMLElement & {
      __cmOnAfterEdit?: (event: Event) => void;
      __cmOnAfterFocus?: (event: Event) => void;
      __cmOnKeyDown?: (event: KeyboardEvent) => void;
    }).__cmOnAfterEdit = onAfterEdit;
    (grid as HTMLElement & {
      __cmOnAfterFocus?: (event: Event) => void;
      __cmOnKeyDown?: (event: KeyboardEvent) => void;
    }).__cmOnAfterFocus = onAfterFocus;
    (grid as HTMLElement & {
      __cmOnAfterFocus?: (event: Event) => void;
      __cmOnKeyDown?: (event: KeyboardEvent) => void;
    }).__cmOnKeyDown = onKeyDown;

    wrapper.appendChild(grid);

    return wrapper;
  }

  ignoreEvent(): boolean {
    return this.isEditable;
  }

  destroy(dom: HTMLElement): void {
    const grid = dom.querySelector("revo-grid") as HTMLElement & {
      __cmOnAfterEdit?: (event: Event) => void;
      __cmOnAfterFocus?: (event: Event) => void;
      __cmOnKeyDown?: (event: KeyboardEvent) => void;
    };
    if (grid?.__cmOnAfterEdit) {
      grid.removeEventListener("afteredit", grid.__cmOnAfterEdit);
    }
    if (grid?.__cmOnAfterFocus) {
      grid.removeEventListener("afterfocus", grid.__cmOnAfterFocus);
    }
    if (grid?.__cmOnKeyDown) {
      grid.removeEventListener("keydown", grid.__cmOnKeyDown);
    }
    unregisterTable(this.tableInfo.id);
  }
}

function sanitizeColumns(columns: TableColumn[]): TableColumn[] {
  return columns.map((column) => ({
    prop: toPlainText(column.prop),
    name: toPlainText(column.name),
  }));
}

function sanitizeSource(source: TableSourceRow[]): TableSourceRow[] {
  return source.map((row) => {
    const record: TableSourceRow = {};
    for (const [key, value] of Object.entries(row)) {
      record[toPlainText(key)] = toPlainText(value);
    }
    return record;
  });
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
    columns.push({ prop: `c${index}`, name: toPlainText(headerText) });
  }
  return columns;
}

function buildSource(data: TableData, columnCount: number): TableSourceRow[] {
  return data.rows.map((row) => {
    const record: TableSourceRow = {};
    for (let index = 0; index < columnCount; index += 1) {
      record[`c${index}`] = toPlainText(row.cells[index]?.text ?? "");
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

function extractEdit(
  detail: Record<string, unknown>,
  columns: TableColumn[]
): { rowIndex: number; colIndex: number; value: unknown } | null {
  const rowIndex =
    (detail.rowIndex as number | undefined) ??
    (detail.row as number | undefined) ??
    (detail?.model && typeof detail.model === "object"
      ? (detail.model as Record<string, unknown>).rowIndex
      : undefined);

  const prop =
    (detail.prop as string | undefined) ??
    (detail?.column && typeof detail.column === "object"
      ? ((detail.column as Record<string, unknown>).prop as string | undefined)
      : undefined);

  let colIndex = (detail.colIndex as number | undefined) ?? (detail.col as number | undefined);

  if (colIndex == null && prop) {
    const match = prop.match(/^c(\d+)$/);
    if (match) {
      colIndex = Number(match[1]);
    } else {
      colIndex = columns.findIndex((col) => col.prop === prop);
    }
  }

  const value =
    detail.val ??
    detail.value ??
    (detail?.model && typeof detail.model === "object" && prop
      ? (detail.model as Record<string, unknown>)[prop]
      : undefined);

  if (typeof rowIndex !== "number" || typeof colIndex !== "number") {
    return null;
  }
  return { rowIndex, colIndex, value };
}

function extractFocus(
  detail: Record<string, unknown>,
  columns: TableColumn[]
): { rowIndex: number; colIndex: number } | null {
  const rowIndex =
    (detail.rowIndex as number | undefined) ??
    (detail.row as number | undefined) ??
    (detail?.model && typeof detail.model === "object"
      ? (detail.model as Record<string, unknown>).rowIndex
      : undefined);

  const prop =
    (detail.prop as string | undefined) ??
    (detail?.column && typeof detail.column === "object"
      ? ((detail.column as Record<string, unknown>).prop as string | undefined)
      : undefined);

  let colIndex = (detail.colIndex as number | undefined) ?? (detail.col as number | undefined);

  if (colIndex == null && prop) {
    const match = prop.match(/^c(\d+)$/);
    if (match) {
      colIndex = Number(match[1]);
    } else {
      colIndex = columns.findIndex((col) => col.prop === prop);
    }
  }

  if (typeof rowIndex !== "number" || typeof colIndex !== "number") {
    return null;
  }
  return { rowIndex, colIndex };
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
    ".cm-content .cm-table-editor revo-grid": {
      width: "100%",
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
