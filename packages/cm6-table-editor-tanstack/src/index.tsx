import { syntaxTree } from "@codemirror/language";
import { Annotation, RangeSetBuilder, type Extension } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import React, { useEffect, useMemo, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";

export type TableEditorOptions = {
  enabled?: boolean;
  renderMode?: "widget" | "none";
  editMode?: "sourceOnFocus" | "inlineCellEdit";
};

type TableCell = {
  text: string;
  from: number;
  to: number;
};

type TableRow = {
  cells: TableCell[];
};

type TableData = {
  header: TableRow | null;
  rows: TableRow[];
};

type TableInfo = {
  id: number;
  from: number;
  to: number;
  startLineFrom: number;
  endLineTo: number;
};

type TableModel = {
  header: string[];
  rows: string[][];
};

type TableEditorProps = {
  model: TableModel;
  editable: boolean;
  onCommitModel: (model: TableModel) => void;
};

const tableEditAnnotation = Annotation.define<boolean>();
const defaultOptions: Required<TableEditorOptions> = {
  enabled: true,
  renderMode: "widget",
  editMode: "sourceOnFocus",
};

function TableEditorView({
  model,
  editable,
  onCommitModel,
}: TableEditorProps) {
  const [draft, setDraft] = useState(model);

  useEffect(() => {
    setDraft(model);
  }, [model]);

  const columns = useMemo<ColumnDef<Record<string, string>>[]>(() => {
    return draft.header.map((title, colIndex) => ({
      id: `c${colIndex}`,
      header: () => (
        <HeaderCell
          value={title}
          editable={editable}
          onChange={(nextValue) => {
            setDraft((prev) => {
              const header = [...prev.header];
              header[colIndex] = nextValue;
              return { ...prev, header };
            });
          }}
          onCommit={(nextValue) => {
            const nextModel = cloneTableModel(draft);
            nextModel.header[colIndex] = nextValue;
            onCommitModel(nextModel);
          }}
        />
      ),
      cell: ({ row }) => {
        const rowIndex = row.index;
        const value = draft.rows[rowIndex]?.[colIndex] ?? "";
        return (
          <BodyCell
            value={value}
            editable={editable}
            onChange={(nextValue) => {
              setDraft((prev) => {
                const rows = prev.rows.map((cells) => [...cells]);
                if (!rows[rowIndex]) {
                  rows[rowIndex] = [];
                }
                rows[rowIndex][colIndex] = nextValue;
                return { ...prev, rows };
              });
            }}
            onCommit={(nextValue) => {
              const nextModel = cloneTableModel(draft);
              if (!nextModel.rows[rowIndex]) {
                nextModel.rows[rowIndex] = [];
              }
              nextModel.rows[rowIndex][colIndex] = nextValue;
              onCommitModel(nextModel);
            }}
          />
        );
      },
    }));
  }, [draft, editable, onCommitModel]);

  const data = useMemo(() => {
    return draft.rows.map((cells) => {
      const record: Record<string, string> = {};
      cells.forEach((cell, index) => {
        record[`c${index}`] = cell;
      });
      return record;
    });
  }, [draft.rows]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="cm-table-react">
      <table className="cm-table">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {editable ? (
        <div className="cm-table-controls">
          <button
            type="button"
            className="cm-table-control"
            onClick={() => {
              const nextModel = cloneTableModel(draft);
              const columnCount = Math.max(1, nextModel.header.length);
              nextModel.rows.push(Array.from({ length: columnCount }, () => ""));
              onCommitModel(nextModel);
            }}
          >
            Add row
          </button>
          <button
            type="button"
            className="cm-table-control"
            onClick={() => {
              const nextModel = cloneTableModel(draft);
              const columnCount = nextModel.header.length + 1;
              nextModel.header.push(`Col ${columnCount}`);
              nextModel.rows = nextModel.rows.map((row) => [...row, ""]);
              onCommitModel(nextModel);
            }}
          >
            Add column
          </button>
        </div>
      ) : null}
    </div>
  );
}

type CellProps = {
  value: string;
  editable: boolean;
  onChange: (value: string) => void;
  onCommit: (value: string) => void;
};

function HeaderCell({ value, editable, onChange, onCommit }: CellProps) {
  if (!editable) {
    return <div className="cm-table-cell">{value}</div>;
  }
  return (
    <textarea
      className="cm-table-input"
      rows={1}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={(event) => onCommit(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          onCommit((event.target as HTMLTextAreaElement).value);
        }
      }}
    />
  );
}

function BodyCell({ value, editable, onChange, onCommit }: CellProps) {
  if (!editable) {
    return <div className="cm-table-cell">{value}</div>;
  }
  return (
    <textarea
      className="cm-table-input"
      rows={1}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={(event) => onCommit(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          onCommit((event.target as HTMLTextAreaElement).value);
        }
      }}
    />
  );
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
    const wrapper = document.createElement("div");
    wrapper.className = "cm-table-editor cm-table-editor-tanstack";
    wrapper.dataset.tableId = String(this.tableInfo.id);

    const model = buildTableModel(this.data);

    const commitTable = (nextModel: TableModel) => {
      const nextData = applyModelToData(nextModel, cloneTableData(this.data));
      normalizeTableData(nextData);
      const markdown = buildTableMarkdown(nextData);
      dispatchOutsideUpdate(this.view, {
        changes: {
          from: this.tableInfo.startLineFrom,
          to: this.tableInfo.endLineTo,
          insert: markdown,
        },
        annotations: tableEditAnnotation.of(true),
      });
    };

    const root = createRoot(wrapper);
    root.render(
      <TableEditorView
        model={model}
        editable={this.isEditable}
        onCommitModel={commitTable}
      />
    );

    (wrapper as HTMLElement & { __reactRoot?: Root }).__reactRoot = root;

    return wrapper;
  }

  destroy(dom: HTMLElement): void {
    const wrapper = dom as HTMLElement & { __reactRoot?: Root };
    wrapper.__reactRoot?.unmount();
  }

  ignoreEvent(): boolean {
    return this.isEditable;
  }
}

function cloneTableData(data: TableData): TableData {
  return {
    header: data.header
      ? { cells: data.header.cells.map((cell) => ({ ...cell })) }
      : null,
    rows: data.rows.map((row) => ({
      cells: row.cells.map((cell) => ({ ...cell })),
    })),
  };
}

function buildTableModel(data: TableData): TableModel {
  const columnCount = Math.max(1, getColumnCount(data));
  const header = data.header?.cells ?? [];
  const headerValues = Array.from({ length: columnCount }, (_value, index) =>
    toDisplayText(header[index]?.text ?? `Col ${index + 1}`)
  );
  const rows = data.rows.map((row) => {
    return Array.from({ length: columnCount }, (_value, index) =>
      toDisplayText(row.cells[index]?.text ?? "")
    );
  });
  return { header: headerValues, rows };
}

function cloneTableModel(model: TableModel): TableModel {
  return {
    header: [...model.header],
    rows: model.rows.map((row) => [...row]),
  };
}

function applyModelToData(model: TableModel, data: TableData): TableData {
  const columnCount = Math.max(1, model.header.length);
  data.header = {
    cells: Array.from({ length: columnCount }, (_value, index) => ({
      text: toMarkdownText(model.header[index] ?? `Col ${index + 1}`),
      from: -1,
      to: -1,
    })),
  };
  data.rows = model.rows.map((row) => ({
    cells: Array.from({ length: columnCount }, (_value, index) => ({
      text: toMarkdownText(row[index] ?? ""),
      from: -1,
      to: -1,
    })),
  }));
  return data;
}

function normalizeTableData(data: TableData): void {
  const columnCount = getColumnCount(data);
  ensureHeader(data, columnCount);
  if (data.header && data.header.cells.length < columnCount) {
    for (let i = data.header.cells.length; i < columnCount; i += 1) {
      data.header.cells.push({ text: `Col ${i + 1}`, from: -1, to: -1 });
    }
  }
  data.rows.forEach((row) => {
    for (let i = row.cells.length; i < columnCount; i += 1) {
      row.cells.push({ text: "", from: -1, to: -1 });
    }
  });
}

function ensureHeader(data: TableData, columnCount: number): void {
  if (data.header) {
    return;
  }
  data.header = {
    cells: Array.from({ length: columnCount }, (_value, index) => ({
      text: `Col ${index + 1}`,
      from: -1,
      to: -1,
    })),
  };
}

function getColumnCount(data: TableData): number {
  return Math.max(
    data.header?.cells.length ?? 0,
    ...data.rows.map((row) => row.cells.length),
    0
  );
}

function buildTableMarkdown(data: TableData): string {
  const columnCount = Math.max(1, getColumnCount(data));
  normalizeTableData(data);
  const headerCells = data.header?.cells ?? [];
  const headerLine = `| ${headerCells
    .slice(0, columnCount)
    .map((cell, index) => formatCell(cell.text || `Col ${index + 1}`))
    .join(" | ")} |`;
  const separatorLine = `| ${Array.from({ length: columnCount }, () => "---").join(" | ")} |`;
  const bodyLines = data.rows.map((row) => {
    const cells = Array.from({ length: columnCount }, (_value, index) => {
      const cell = row.cells[index];
      return formatCell(cell?.text ?? "");
    });
    return `| ${cells.join(" | ")} |`;
  });
  return [headerLine, separatorLine, ...bodyLines].join("\n");
}

function dispatchOutsideUpdate(
  view: EditorView,
  transaction: { changes: { from: number; to: number; insert: string }; annotations: Annotation<any> }
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

function formatCell(value: string): string {
  const normalized = escapePipes(value);
  return normalized.trim();
}

function escapePipes(value: string): string {
  return value.replace(/\|/g, "\\|");
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

function toDisplayText(value: string): string {
  return value.replace(/<br\s*\/?>/gi, "\n");
}

function toMarkdownText(value: string): string {
  return value.replace(/\r?\n/g, "<br>");
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
      const info: TableInfo = {
        id: tableId,
        from: node.from,
        to: node.to,
        startLineFrom: firstLine.from,
        endLineTo: lastLine.to,
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

export function tableEditor(options: TableEditorOptions = {}): Extension {
  const resolved = { ...defaultOptions, ...options };

  const theme = EditorView.baseTheme({
    ".cm-content .cm-table-editor": {
      overflowX: "auto",
      margin: "0.5rem 0",
    },
    ".cm-content .cm-table-editor table.cm-table": {
      width: "100%",
      borderCollapse: "collapse",
      backgroundColor: "var(--editor-surface)",
    },
    ".cm-content .cm-table-editor th, .cm-content .cm-table-editor td": {
      border: "1px solid var(--editor-border)",
      padding: "4px",
      verticalAlign: "top",
    },
    ".cm-content .cm-table-editor th": {
      backgroundColor: "var(--app-pill-bg)",
      textAlign: "left",
    },
    ".cm-content .cm-table-editor .cm-table-input": {
      width: "100%",
      minHeight: "1.6rem",
      border: "0",
      resize: "vertical",
      background: "transparent",
      color: "var(--editor-text-color)",
      font: "inherit",
      lineHeight: "1.4",
      padding: "2px",
    },
    ".cm-content .cm-table-editor .cm-table-input:focus": {
      outline: "1px solid var(--editor-primary-color)",
      background: "var(--app-input-bg)",
    },
    ".cm-content .cm-table-editor .cm-table-controls": {
      display: "flex",
      gap: "8px",
      marginTop: "6px",
    },
    ".cm-content .cm-table-editor .cm-table-control": {
      borderRadius: "6px",
      border: "1px solid var(--app-button-border)",
      background: "var(--app-button-bg)",
      color: "var(--app-text)",
      padding: "4px 8px",
      cursor: "pointer",
      fontSize: "12px",
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
        const state = buildDecorations(view, resolved);
        this.decorations = state.decorations;
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged || update.selectionSet) {
          const state = buildDecorations(update.view, resolved);
          this.decorations = state.decorations;
        }
      }
    },
    {
      decorations: (view) => view.decorations,
    }
  );

  return [theme, plugin];
}
