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

export type TableEditorOptions = {
  enabled?: boolean;
  renderMode?: "widget" | "none";
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

const tableEditAnnotation = Annotation.define<boolean>();
const defaultOptions: Required<TableEditorOptions> = {
  enabled: true,
  renderMode: "widget",
};

class TableWidget extends WidgetType {
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
    wrapper.className = "cm-table-editor cm-table-editor-vanilla";
    wrapper.dataset.tableId = String(this.tableInfo.id);

    const data = cloneTableData(this.data);
    const table = document.createElement("table");
    table.className = "cm-table";

    const commitTable = () => {
      normalizeTableData(data);
      const markdown = buildTableMarkdown(data);
      dispatchOutsideUpdate(view, {
        changes: {
          from: this.tableInfo.startLineFrom,
          to: this.tableInfo.endLineTo,
          insert: markdown,
        },
        annotations: tableEditAnnotation.of(true),
      });
    };

    const createCellEditor = (
      initialValue: string,
      onChange: (value: string) => void,
      onCommit: (value: string) => void
    ): HTMLTextAreaElement => {
      const input = document.createElement("textarea");
      input.className = "cm-table-input";
      input.rows = 1;
      input.value = toDisplayText(initialValue);
      const resizeToContent = () => {
        input.style.height = "0px";
        input.style.height = `${input.scrollHeight}px`;
      };
      resizeToContent();
      requestAnimationFrame(resizeToContent);
      let committed = false;
      const commit = () => {
        if (committed) {
          return;
        }
        committed = true;
        onCommit(input.value);
      };
      input.addEventListener("input", () => {
        onChange(input.value);
        resizeToContent();
      });
      input.addEventListener("focus", resizeToContent);
      input.addEventListener("blur", (event) => {
        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof Node && wrapper.contains(nextTarget)) {
          committed = false;
          return;
        }
        commit();
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Tab") {
          event.preventDefault();
          const inputs = Array.from(
            wrapper.querySelectorAll<HTMLTextAreaElement>("textarea.cm-table-input")
          );
          const currentIndex = inputs.indexOf(input);
          if (currentIndex !== -1) {
            const direction = event.shiftKey ? -1 : 1;
            const nextIndex =
              (currentIndex + direction + inputs.length) % inputs.length;
            inputs[nextIndex]?.focus();
          }
          return;
        }
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          commit();
        }
      });
      return input;
    };

    const addRowButton = document.createElement("button");
    addRowButton.type = "button";
    addRowButton.className = "cm-table-control";
    addRowButton.textContent = "Add row";
    addRowButton.addEventListener("click", () => {
      const columnCount = getColumnCount(data);
      normalizeTableData(data);
      data.rows.push({
        cells: Array.from({ length: columnCount }, () => ({ text: "", from: -1, to: -1 })),
      });
      commitTable();
    });

    const addColumnButton = document.createElement("button");
    addColumnButton.type = "button";
    addColumnButton.className = "cm-table-control";
    addColumnButton.textContent = "Add column";
    addColumnButton.addEventListener("click", () => {
      normalizeTableData(data);
      const columnCount = getColumnCount(data) + 1;
      ensureHeader(data, columnCount);
      if (data.header) {
        data.header.cells.push({
          text: `Col ${columnCount}`,
          from: -1,
          to: -1,
        });
      }
      data.rows.forEach((row) => {
        row.cells.push({ text: "", from: -1, to: -1 });
      });
      commitTable();
    });

    const renderHeader = () => {
      const thead = document.createElement("thead");
      const row = document.createElement("tr");
      const columnCount = getColumnCount(data);
      ensureHeader(data, columnCount);
      const headerRow = data.header;
      if (!headerRow) {
        return thead;
      }
      headerRow.cells.forEach((cell, colIndex) => {
        const th = document.createElement("th");
        const input = createCellEditor(
          cell.text,
          (value) => {
            cell.text = toMarkdownText(value);
          },
          (value) => {
            cell.text = toMarkdownText(value);
            commitTable();
          }
        );
        th.appendChild(input);
        th.dataset.colIndex = String(colIndex);
        row.appendChild(th);
      });
      thead.appendChild(row);
      return thead;
    };

    const renderBody = () => {
      const tbody = document.createElement("tbody");
      const columnCount = getColumnCount(data);
      data.rows.forEach((row, rowIndex) => {
        const tr = document.createElement("tr");
        for (let colIndex = 0; colIndex < columnCount; colIndex += 1) {
          const cell = row.cells[colIndex] ?? { text: "", from: -1, to: -1 };
          const td = document.createElement("td");
          const input = createCellEditor(
            cell.text,
            (value) => {
              cell.text = toMarkdownText(value);
              row.cells[colIndex] = cell;
            },
            (value) => {
              cell.text = toMarkdownText(value);
              row.cells[colIndex] = cell;
              commitTable();
            }
          );
          td.appendChild(input);
          td.dataset.rowIndex = String(rowIndex);
          td.dataset.colIndex = String(colIndex);
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      });
      return tbody;
    };

    table.appendChild(renderHeader());
    table.appendChild(renderBody());

    const controls = document.createElement("div");
    controls.className = "cm-table-controls";
    controls.appendChild(addRowButton);
    controls.appendChild(addColumnButton);

    wrapper.appendChild(table);
    wrapper.appendChild(controls);

    return wrapper;
  }

  ignoreEvent(): boolean {
    return true;
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

function collectTableData(state: EditorState, node: SyntaxNode): TableData {
  const headerNode = node.getChild("TableHeader");
  const rowNodes = node.getChildren("TableRow");
  const header = headerNode ? { cells: collectCells(state, headerNode) } : null;
  const rows = rowNodes.map((row) => ({ cells: collectCells(state, row) }));
  return { header, rows };
}

function collectTableLines(state: EditorState, from: number, to: number) {
  const lines = [];
  const startLine = state.doc.lineAt(from);
  const endLine = state.doc.lineAt(Math.max(from, to - 1));
  for (let lineNumber = startLine.number; lineNumber <= endLine.number; lineNumber += 1) {
    lines.push(state.doc.line(lineNumber));
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

function toDisplayText(value: string): string {
  return value.replace(/<br\s*\/?>/gi, "\n");
}

function toMarkdownText(value: string): string {
  return value.replace(/\r?\n/g, "<br>");
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

      const data = collectTableData(state, node.node);
      const lines = collectTableLines(state, node.from, node.to);
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
      resize: "none",
      outline: "none",
      boxShadow: "none",
      overflow: "hidden",
      background: "transparent",
      color: "var(--editor-text-color)",
      font: "inherit",
      lineHeight: "1.4",
      padding: "2px",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
    },
    ".cm-content .cm-table-editor .cm-table-input:focus": {
      outline: "none",
      boxShadow: "none",
      background: "var(--app-input-bg)",
    },
    ".cm-content .cm-table-editor .cm-table-cell": {
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
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
