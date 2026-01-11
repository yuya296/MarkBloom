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

type TableAlignment = "left" | "center" | "right" | null;

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
  alignments: TableAlignment[];
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
  private readonly menuAbort = new AbortController();

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

    const scrollArea = document.createElement("div");
    scrollArea.className = "cm-table-scroll";
    const rowActions = document.createElement("div");
    rowActions.className = "cm-table-row-actions";
    const rowDropIndicator = document.createElement("div");
    rowDropIndicator.className = "cm-table-row-drop-indicator";

    let scheduleRowActionLayout: () => void = () => {};
    let dragSourceIndex: number | null = null;
    let dragTargetIndex: number | null = null;

    const closeAllMenus = () => {
      wrapper
        .querySelectorAll<HTMLElement>(".cm-table-action[data-open=\"true\"]")
        .forEach((element) => {
          element
            .querySelector<HTMLElement>(".cm-table-action-menu")
            ?.removeAttribute("style");
          element.dataset.open = "false";
        });
    };

    wrapper.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (!target.closest(".cm-table-action")) {
        closeAllMenus();
      }
    });

    const closeOnScroll = () => {
      closeAllMenus();
      scheduleRowActionLayout();
    };

    const signal = this.menuAbort.signal;
    view.scrollDOM.addEventListener("scroll", closeOnScroll, { passive: true, signal });
    window.addEventListener("scroll", closeOnScroll, { passive: true, signal });
    window.addEventListener("resize", closeOnScroll, { signal });

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
        scheduleRowActionLayout();
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

    const insertRow = (index: number) => {
      const columnCount = Math.max(1, getColumnCount(data));
      normalizeTableData(data);
      const nextIndex = Math.max(0, Math.min(index, data.rows.length));
      data.rows.splice(nextIndex, 0, {
        cells: Array.from({ length: columnCount }, () => ({ text: "", from: -1, to: -1 })),
      });
      commitTable();
    };

    const deleteRow = (index: number) => {
      if (index < 0 || index >= data.rows.length) {
        return;
      }
      data.rows.splice(index, 1);
      commitTable();
    };

    const insertColumn = (index: number) => {
      normalizeTableData(data);
      const columnCount = Math.max(1, getColumnCount(data));
      const nextIndex = Math.max(0, Math.min(index, columnCount));
      ensureHeader(data, columnCount + 1);
      if (data.header) {
        data.header.cells.splice(nextIndex, 0, {
          text: `Col ${nextIndex + 1}`,
          from: -1,
          to: -1,
        });
      }
      data.rows.forEach((row) => {
        row.cells.splice(nextIndex, 0, { text: "", from: -1, to: -1 });
      });
      data.alignments.splice(nextIndex, 0, null);
      commitTable();
    };

    const deleteColumn = (index: number) => {
      const columnCount = Math.max(1, getColumnCount(data));
      if (columnCount <= 1) {
        return;
      }
      normalizeTableData(data);
      const nextIndex = Math.max(0, Math.min(index, columnCount - 1));
      if (data.header) {
        data.header.cells.splice(nextIndex, 1);
      }
      data.rows.forEach((row) => {
        row.cells.splice(nextIndex, 1);
      });
      data.alignments.splice(nextIndex, 1);
      commitTable();
    };

    const setColumnAlignment = (index: number, alignment: TableAlignment) => {
      normalizeTableData(data);
      const columnCount = Math.max(1, getColumnCount(data));
      if (index < 0 || index >= columnCount) {
        return;
      }
      data.alignments[index] = alignment;
      commitTable();
    };

    type ActionItem = {
      label: string;
      onSelect?: () => void;
      submenu?: ActionItem[];
      disabled?: boolean;
    };

    const createActionMenu = (items: ActionItem[], menuLabel: string) => {
      const container = document.createElement("div");
      container.className = "cm-table-action";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "cm-table-action-button";
      button.textContent = "⋯";
      button.setAttribute("aria-label", menuLabel);

      const menu = document.createElement("div");
      menu.className = "cm-table-action-menu";

      const renderMenuItem = (item: ActionItem) => {
        if (item.submenu && item.submenu.length > 0) {
          const submenuWrapper = document.createElement("div");
          submenuWrapper.className = "cm-table-action-item cm-table-action-item--submenu";

          const submenuButton = document.createElement("button");
          submenuButton.type = "button";
          submenuButton.className = "cm-table-action-item-button";
          submenuButton.textContent = `${item.label} ▸`;
          submenuButton.disabled = Boolean(item.disabled);

          const submenu = document.createElement("div");
          submenu.className = "cm-table-action-submenu";

          item.submenu.forEach((subItem) => {
            const subButton = document.createElement("button");
            subButton.type = "button";
            subButton.className = "cm-table-action-item-button";
            subButton.textContent = subItem.label;
            subButton.disabled = Boolean(subItem.disabled);
            subButton.addEventListener("click", (event) => {
              event.preventDefault();
              event.stopPropagation();
              subItem.onSelect?.();
              closeAllMenus();
            });
            submenu.appendChild(subButton);
          });

          submenuWrapper.appendChild(submenuButton);
          submenuWrapper.appendChild(submenu);
          return submenuWrapper;
        }

        const itemButton = document.createElement("button");
        itemButton.type = "button";
        itemButton.className = "cm-table-action-item-button";
        itemButton.textContent = item.label;
        itemButton.disabled = Boolean(item.disabled);
        itemButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          item.onSelect?.();
          closeAllMenus();
        });
        return itemButton;
      };

      items.forEach((item) => {
        menu.appendChild(renderMenuItem(item));
      });

      const positionMenu = () => {
        const rect = button.getBoundingClientRect();
        const top = rect.bottom + 6;
        const left = rect.left;
        menu.style.position = "fixed";
        menu.style.top = `${top}px`;
        menu.style.left = `${left}px`;
        menu.style.maxWidth = "240px";
        menu.style.zIndex = "2000";
        menu.style.display = "grid";
        menu.style.gap = "4px";
      };

      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const isOpen = container.dataset.open === "true";
        closeAllMenus();
        if (!isOpen) {
          container.dataset.open = "true";
          positionMenu();
        }
      });

      container.appendChild(button);
      container.appendChild(menu);
      return container;
    };

    const rowElements: HTMLTableRowElement[] = [];
    let rowActionLayoutPending = false;
    const positionRowActions = () => {
      if (rowElements.length === 0) {
        return;
      }
      rowElements.forEach((rowElement, index) => {
        const rowRect = rowElement.getBoundingClientRect();
        const menu = rowActions.children[index];
        if (!(menu instanceof HTMLElement)) {
          return;
        }
        const menuHeight = menu.getBoundingClientRect().height;
        const top = rowRect.top + Math.max(0, (rowRect.height - menuHeight) / 2);
        const left = rowRect.left - 26;
        menu.style.top = `${top}px`;
        menu.style.left = `${left}px`;
        menu.style.transform = "none";
      });
    };
    scheduleRowActionLayout = () => {
      if (rowActionLayoutPending) {
        return;
      }
      rowActionLayoutPending = true;
      requestAnimationFrame(() => {
        rowActionLayoutPending = false;
        positionRowActions();
      });
    };

    const getDropIndex = (clientY: number) => {
      for (let index = 0; index < rowElements.length; index += 1) {
        const rowRect = rowElements[index].getBoundingClientRect();
        if (clientY < rowRect.top + rowRect.height / 2) {
          return index;
        }
      }
      return rowElements.length;
    };

    const updateDropIndicator = (clientX: number, clientY: number) => {
      if (dragSourceIndex === null) {
        return;
      }
      const firstRow = rowElements[0];
      const lastRow = rowElements[rowElements.length - 1];
      if (!firstRow || !lastRow) {
        clearDropIndicator();
        return;
      }
      const firstRect = firstRow.getBoundingClientRect();
      const lastRect = lastRow.getBoundingClientRect();
      const withinY = clientY >= firstRect.top && clientY <= lastRect.bottom;
      if (!withinY) {
        clearDropIndicator();
        return;
      }
      const dropIndex = getDropIndex(clientY);
      dragTargetIndex = dropIndex;
      const referenceIndex = Math.min(dropIndex, rowElements.length - 1);
      const referenceRow = rowElements[referenceIndex];
      if (!referenceRow) {
        rowDropIndicator.style.display = "none";
        return;
      }
      const rowRect = referenceRow.getBoundingClientRect();
      const top = dropIndex >= rowElements.length ? rowRect.bottom : rowRect.top;
      rowDropIndicator.style.display = "block";
      rowDropIndicator.style.top = `${top}px`;
      rowDropIndicator.style.left = `${rowRect.left}px`;
      rowDropIndicator.style.width = `${rowRect.width}px`;
    };

    const clearDropIndicator = () => {
      rowDropIndicator.style.display = "none";
      dragTargetIndex = null;
    };

    const commitRowReorder = () => {
      if (dragSourceIndex === null || dragTargetIndex === null) {
        return;
      }
      const total = data.rows.length;
      if (total <= 1) {
        return;
      }
      const sourceIndex = dragSourceIndex;
      let targetIndex = dragTargetIndex;
      if (sourceIndex < targetIndex) {
        targetIndex -= 1;
      }
      if (targetIndex < 0 || targetIndex >= total || targetIndex === sourceIndex) {
        return;
      }
      const [moved] = data.rows.splice(sourceIndex, 1);
      data.rows.splice(targetIndex, 0, moved);
      commitTable();
    };

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
        const columnMenu = createActionMenu(
          [
            { label: "Insert column left", onSelect: () => insertColumn(colIndex) },
            { label: "Insert column right", onSelect: () => insertColumn(colIndex + 1) },
            {
              label: "Delete column",
              onSelect: () => deleteColumn(colIndex),
              disabled: columnCount <= 1,
            },
            {
              label: "Align",
              submenu: [
                { label: "Left", onSelect: () => setColumnAlignment(colIndex, "left") },
                { label: "Center", onSelect: () => setColumnAlignment(colIndex, "center") },
                { label: "Right", onSelect: () => setColumnAlignment(colIndex, "right") },
              ],
            },
          ],
          "Column actions"
        );
        columnMenu.classList.add("cm-table-action--column");
        th.appendChild(columnMenu);
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
        rowElements.push(tr);
      });
      return tbody;
    };

    table.appendChild(renderHeader());
    table.appendChild(renderBody());

    scrollArea.appendChild(table);
    wrapper.appendChild(scrollArea);
    wrapper.appendChild(rowActions);

    const setActiveRowAction = (activeIndex: number | null) => {
      Array.from(rowActions.children).forEach((child, index) => {
        if (!(child instanceof HTMLElement)) {
          return;
        }
        if (activeIndex !== null && index === activeIndex) {
          child.dataset.active = "true";
        } else {
          child.removeAttribute("data-active");
        }
      });
    };

    rowElements.forEach((rowElement, rowIndex) => {
      const rowMenu = createActionMenu(
        [
          { label: "Insert row above", onSelect: () => insertRow(rowIndex) },
          { label: "Insert row below", onSelect: () => insertRow(rowIndex + 1) },
          { label: "Delete row", onSelect: () => deleteRow(rowIndex) },
        ],
        "Row actions"
      );
      rowMenu.classList.add("cm-table-action--row");
      const rowMenuButton = rowMenu.querySelector<HTMLButtonElement>(".cm-table-action-button");
      if (rowMenuButton) {
        rowMenuButton.draggable = true;
        rowMenuButton.addEventListener("dragstart", (event) => {
          dragSourceIndex = rowIndex;
          dragTargetIndex = rowIndex;
          rowMenu.dataset.dragging = "true";
          event.dataTransfer?.setData("text/plain", String(rowIndex));
          event.dataTransfer?.setDragImage(rowMenuButton, 0, 0);
        });
        rowMenuButton.addEventListener("dragend", () => {
          dragSourceIndex = null;
          rowMenu.removeAttribute("data-dragging");
          clearDropIndicator();
        });
      }
      rowMenu.addEventListener("mouseenter", () => setActiveRowAction(rowIndex));
      rowMenu.addEventListener("mouseleave", () => setActiveRowAction(null));
      rowElement.addEventListener("mouseenter", () => setActiveRowAction(rowIndex));
      rowElement.addEventListener("mouseleave", () => setActiveRowAction(null));
      rowActions.appendChild(rowMenu);
    });

    wrapper.appendChild(rowDropIndicator);
    scheduleRowActionLayout();

    const handleDragOver = (event: DragEvent) => {
      if (dragSourceIndex === null) {
        return;
      }
      event.preventDefault();
      updateDropIndicator(event.clientX, event.clientY);
    };

    const handleDrop = (event: DragEvent) => {
      if (dragSourceIndex === null) {
        return;
      }
      event.preventDefault();
      if (dragTargetIndex !== null) {
        commitRowReorder();
      }
      clearDropIndicator();
      dragSourceIndex = null;
    };

    window.addEventListener("dragover", handleDragOver, { signal });
    window.addEventListener("drop", handleDrop, { signal });


    return wrapper;
  }

  ignoreEvent(): boolean {
    return true;
  }

  destroy(): void {
    this.menuAbort.abort();
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
    alignments: [...data.alignments],
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
  if (!data.alignments) {
    data.alignments = [];
  }
  if (data.alignments.length < columnCount) {
    for (let i = data.alignments.length; i < columnCount; i += 1) {
      data.alignments.push(null);
    }
  } else if (data.alignments.length > columnCount) {
    data.alignments = data.alignments.slice(0, columnCount);
  }
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
  const alignments = data.alignments.slice(0, columnCount);
  const headerCells = data.header?.cells ?? [];
  const headerLine = `| ${headerCells
    .slice(0, columnCount)
    .map((cell, index) => formatCell(cell.text || `Col ${index + 1}`))
    .join(" | ")} |`;
  const separatorLine = `| ${alignments
    .map((alignment) => formatAlignment(alignment))
    .join(" | ")} |`;
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
  const alignments = parseAlignmentsFromLines(lines, columnCount);
  return { header, rows, alignments };
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

function parseAlignmentsFromLines(
  lines: ReturnType<typeof collectTableLines>,
  columnCount: number
): TableAlignment[] {
  if (columnCount <= 0) {
    return [];
  }
  const separatorLine = lines[1]?.text;
  if (!separatorLine) {
    return Array.from({ length: columnCount }, () => null);
  }
  return parseAlignmentLine(separatorLine, columnCount);
}

function parseAlignmentLine(line: string, columnCount: number): TableAlignment[] {
  const trimmed = line.trim();
  const withoutEdges = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  const parts = withoutEdges.split("|").map((part) => part.trim());
  const alignments = parts.map((part) => {
    const startsWith = part.startsWith(":");
    const endsWith = part.endsWith(":");
    if (startsWith && endsWith) {
      return "center";
    }
    if (startsWith) {
      return "left";
    }
    if (endsWith) {
      return "right";
    }
    return null;
  });
  if (alignments.length < columnCount) {
    return alignments.concat(Array.from({ length: columnCount - alignments.length }, () => null));
  }
  return alignments.slice(0, columnCount);
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

function formatAlignment(alignment: TableAlignment): string {
  switch (alignment) {
    case "left":
      return ":---";
    case "center":
      return ":---:";
    case "right":
      return "---:";
    default:
      return "---";
  }
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
    ".cm-content .cm-table-editor .cm-table-scroll": {
      overflowX: "auto",
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
      position: "relative",
    },
    ".cm-content .cm-table-editor td": {
      position: "relative",
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
      position: "relative",
      zIndex: "1",
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
    ".cm-content .cm-table-editor .cm-table-action": {
      position: "absolute",
      zIndex: "10",
      display: "inline-flex",
      flexDirection: "column",
      alignItems: "flex-start",
      gap: "4px",
      pointerEvents: "auto",
    },
    ".cm-content .cm-table-editor .cm-table-action--row": {
      left: "6px",
      top: "50%",
    },
    ".cm-content .cm-table-editor .cm-table-action--column": {
      top: "6px",
      right: "6px",
      left: "auto",
    },
    ".cm-content .cm-table-editor .cm-table-action-button": {
      border: "none",
      background: "transparent",
      color: "var(--app-text)",
      fontSize: "14px",
      padding: "0",
      cursor: "pointer",
      pointerEvents: "auto",
      opacity: "0.35",
      transition: "opacity 120ms ease",
    },
    ".cm-content .cm-table-editor .cm-table-row-actions .cm-table-action-button": {
      opacity: "0.35",
    },
    ".cm-content .cm-table-editor .cm-table-row-actions .cm-table-action:hover .cm-table-action-button":
      {
        opacity: "0.85",
      },
    ".cm-content .cm-table-editor tr:hover .cm-table-action-button": {
      opacity: "0.85",
    },
    ".cm-content .cm-table-editor th:hover .cm-table-action-button": {
      opacity: "0.85",
    },
    ".cm-content .cm-table-editor .cm-table-action[data-open=\"true\"] .cm-table-action-button": {
      opacity: "1",
    },
    ".cm-content .cm-table-editor .cm-table-action-menu": {
      display: "none",
      position: "absolute",
      top: "26px",
      left: "0",
      minWidth: "160px",
      background: "#2f2f2f",
      border: "1px solid var(--editor-border)",
      borderRadius: "8px",
      boxShadow: "0 6px 18px rgba(0, 0, 0, 0.12)",
      padding: "6px",
      zIndex: "3",
    },
    ".cm-content .cm-table-editor .cm-table-action--column .cm-table-action-menu": {
      top: "26px",
      left: "0",
    },
    ".cm-content .cm-table-editor .cm-table-action[data-open=\"true\"] .cm-table-action-menu": {
      display: "grid",
      gap: "4px",
    },
    ".cm-content .cm-table-editor .cm-table-action-item-button": {
      width: "100%",
      textAlign: "left",
      borderRadius: "6px",
      border: "0",
      background: "transparent",
      color: "var(--editor-text-color)",
      padding: "4px 6px",
      cursor: "pointer",
      fontSize: "12px",
    },
    ".cm-content .cm-table-editor .cm-table-action-item-button:hover": {
      background: "var(--app-pill-bg)",
    },
    ".cm-content .cm-table-editor .cm-table-action-item-button:disabled": {
      opacity: "0.4",
      cursor: "not-allowed",
    },
    ".cm-content .cm-table-editor .cm-table-action-item--submenu": {
      position: "relative",
    },
    ".cm-content .cm-table-editor .cm-table-action-submenu": {
      display: "none",
      position: "absolute",
      top: "0",
      left: "100%",
      marginLeft: "6px",
      minWidth: "140px",
      background: "var(--editor-surface)",
      border: "1px solid var(--editor-border)",
      borderRadius: "8px",
      boxShadow: "0 6px 18px rgba(0, 0, 0, 0.12)",
      padding: "6px",
      zIndex: "4",
    },
    ".cm-content .cm-table-editor .cm-table-action-item--submenu:hover .cm-table-action-submenu": {
      display: "grid",
      gap: "4px",
    },
    ".cm-content .cm-table-editor .cm-table-row-actions": {
      position: "fixed",
      top: "0",
      left: "0",
      width: "0",
      height: "0",
      pointerEvents: "none",
      zIndex: "10",
    },
    ".cm-content .cm-table-editor .cm-table-row-drop-indicator": {
      position: "fixed",
      height: "2px",
      background: "var(--editor-primary-color)",
      boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.25)",
      pointerEvents: "none",
      display: "none",
      zIndex: "2000",
    },
    ".cm-content .cm-table-editor .cm-table-row-actions .cm-table-action": {
      opacity: "0",
      transition: "opacity 120ms ease",
    },
    ".cm-content .cm-table-editor .cm-table-row-actions .cm-table-action[data-active=\"true\"]":
      {
        opacity: "0.85",
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
