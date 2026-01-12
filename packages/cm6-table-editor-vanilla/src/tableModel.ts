import type { TableAlignment, TableData } from "./types";

export function cloneTableData(data: TableData): TableData {
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

export function getColumnCount(data: TableData): number {
  return Math.max(
    data.header?.cells.length ?? 0,
    ...data.rows.map((row) => row.cells.length),
    0
  );
}

export function ensureHeader(data: TableData, columnCount: number): void {
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

export function normalizeTableData(data: TableData): void {
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

export function insertRowAt(data: TableData, index: number): void {
  const columnCount = Math.max(1, getColumnCount(data));
  normalizeTableData(data);
  const nextIndex = Math.max(0, Math.min(index, data.rows.length));
  data.rows.splice(nextIndex, 0, {
    cells: Array.from({ length: columnCount }, () => ({ text: "", from: -1, to: -1 })),
  });
}

export function deleteRowAt(data: TableData, index: number): void {
  if (index < 0 || index >= data.rows.length) {
    return;
  }
  data.rows.splice(index, 1);
}

export function insertColumnAt(data: TableData, index: number): void {
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
}

export function deleteColumnAt(data: TableData, index: number): void {
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
}

export function setColumnAlignment(
  data: TableData,
  index: number,
  alignment: TableAlignment
): void {
  normalizeTableData(data);
  const columnCount = Math.max(1, getColumnCount(data));
  if (index < 0 || index >= columnCount) {
    return;
  }
  data.alignments[index] = alignment;
}

export function reorderRows(data: TableData, sourceIndex: number, targetIndex: number): void {
  const total = data.rows.length;
  if (total <= 1) {
    return;
  }
  const clampedSource = Math.max(0, Math.min(sourceIndex, total - 1));
  let clampedTarget = Math.max(0, Math.min(targetIndex, total));
  if (clampedSource < clampedTarget) {
    clampedTarget -= 1;
  }
  if (clampedTarget === clampedSource) {
    return;
  }
  const [moved] = data.rows.splice(clampedSource, 1);
  data.rows.splice(clampedTarget, 0, moved);
}

export function reorderColumns(
  data: TableData,
  sourceIndex: number,
  targetIndex: number
): void {
  normalizeTableData(data);
  const columnCount = getColumnCount(data);
  if (columnCount <= 1) {
    return;
  }
  const clampedSource = Math.max(0, Math.min(sourceIndex, columnCount - 1));
  let clampedTarget = Math.max(0, Math.min(targetIndex, columnCount));
  if (clampedSource < clampedTarget) {
    clampedTarget -= 1;
  }
  if (clampedTarget === clampedSource) {
    return;
  }
  if (data.header) {
    const [movedHeader] = data.header.cells.splice(clampedSource, 1);
    data.header.cells.splice(clampedTarget, 0, movedHeader);
  }
  data.rows.forEach((row) => {
    const [movedCell] = row.cells.splice(clampedSource, 1);
    row.cells.splice(clampedTarget, 0, movedCell);
  });
  const [movedAlign] = data.alignments.splice(clampedSource, 1);
  data.alignments.splice(clampedTarget, 0, movedAlign);
}
