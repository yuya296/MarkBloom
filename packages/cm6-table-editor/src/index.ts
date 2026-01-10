import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder, type Extension } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { defineCustomElements } from "@revolist/revogrid/loader";

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
  editable: boolean;
};

type TableSourceRow = Record<string, string>;

const defaultOptions: Required<TableEditorOptions> = {
  enabled: true,
  renderMode: "widget",
  editMode: "sourceOnFocus",
};

let customElementsRegistered = false;

function ensureCustomElements() {
  if (customElementsRegistered) {
    return;
  }
  defineCustomElements();
  customElementsRegistered = true;
}

class TableWidget extends WidgetType {
  constructor(
    private readonly view: EditorView,
    private readonly data: TableData,
    private readonly isEditable: boolean
  ) {
    super();
  }

  eq(other: TableWidget): boolean {
    return this.isEditable === other.isEditable && JSON.stringify(this.data) === JSON.stringify(other.data);
  }

  toDOM(): HTMLElement {
    ensureCustomElements();
    const wrapper = document.createElement("div");
    wrapper.className = "cm-table-editor";

    const grid = document.createElement("revo-grid") as HTMLElement & {
      columns: TableColumn[];
      source: TableSourceRow[];
      readonly: boolean;
      rowHeaders: boolean;
      range: boolean;
      useClipboard: boolean;
      autoSizeColumn: boolean;
      canFocus: boolean;
    };

    const columns = buildColumns(this.data, this.isEditable);
    const source = buildSource(this.data, columns.length);

    grid.columns = columns;
    grid.source = source;
    grid.readonly = !this.isEditable;
    grid.canFocus = true;
    grid.rowHeaders = false;
    grid.range = false;
    grid.useClipboard = false;
    grid.autoSizeColumn = true;
    grid.tabIndex = 0;

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
      });
    };

    grid.addEventListener("afteredit", onAfterEdit);
    (grid as HTMLElement & { __cmOnAfterEdit?: (event: Event) => void }).__cmOnAfterEdit = onAfterEdit;

    wrapper.appendChild(grid);

    return wrapper;
  }

  ignoreEvent(): boolean {
    return this.isEditable;
  }

  destroy(dom: HTMLElement): void {
    const grid = dom.querySelector("revo-grid") as HTMLElement & {
      __cmOnAfterEdit?: (event: Event) => void;
    };
    if (grid?.__cmOnAfterEdit) {
      grid.removeEventListener("afteredit", grid.__cmOnAfterEdit);
    }
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

function buildColumns(data: TableData, editable: boolean): TableColumn[] {
  const columns: TableColumn[] = [];
  const maxCells = Math.max(
    data.header?.cells.length ?? 0,
    ...data.rows.map((row) => row.cells.length),
    0
  );

  for (let index = 0; index < maxCells; index += 1) {
    const headerText = data.header?.cells[index]?.text ?? `Col ${index + 1}`;
    columns.push({ prop: `c${index}`, name: headerText, editable });
  }
  return columns;
}

function buildSource(data: TableData, columnCount: number): TableSourceRow[] {
  return data.rows.map((row) => {
    const record: TableSourceRow = {};
    for (let index = 0; index < columnCount; index += 1) {
      record[`c${index}`] = row.cells[index]?.text ?? "";
    }
    return record;
  });
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

function buildDecorations(view: EditorView, options: Required<TableEditorOptions>): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  if (!options.enabled || options.renderMode !== "widget") {
    return builder.finish();
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
      const pending: Array<{ from: number; to: number; decoration: Decoration }> = [];
      const widgetDecoration = Decoration.replace({
        widget: new TableWidget(view, data, options.editMode === "inlineCellEdit"),
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
    },
  });

  return builder.finish();
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

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view, resolved);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged || update.selectionSet) {
          this.decorations = buildDecorations(update.view, resolved);
        }
      }
    },
    {
      decorations: (view) => view.decorations,
    }
  );

  return [theme, plugin];
}
