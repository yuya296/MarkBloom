import type { TableAlignment, TableData } from "./types";
import { normalizeTableData } from "./tableModel";

export function buildTableMarkdown(data: TableData): string {
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

export function formatAlignment(alignment: TableAlignment): string {
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

export function parseAlignmentsFromLines(
  lines: string[],
  columnCount: number
): TableAlignment[] {
  if (columnCount <= 0) {
    return [];
  }
  const separatorLine = lines[1];
  if (!separatorLine) {
    return Array.from({ length: columnCount }, () => null);
  }
  return parseAlignmentLine(separatorLine, columnCount);
}

export function parseAlignmentLine(line: string, columnCount: number): TableAlignment[] {
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

export function formatCell(value: string): string {
  const normalized = escapePipes(value);
  return normalized.trim();
}

export function escapePipes(value: string): string {
  return value.replace(/\|/g, "\\|");
}

export function toDisplayText(value: string): string {
  return value.replace(/<br\s*\/?>/gi, "\n");
}

export function toMarkdownText(value: string): string {
  return value.replace(/\r?\n/g, "<br>");
}

function getColumnCount(data: TableData): number {
  return Math.max(
    data.header?.cells.length ?? 0,
    ...data.rows.map((row) => row.cells.length),
    0
  );
}
