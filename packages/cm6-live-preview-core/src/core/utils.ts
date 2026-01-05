import type { SelectionRange } from "@codemirror/state";
import type { Range } from "./types";

export function inRanges(pos: number, ranges: Range[]): boolean {
  for (const range of ranges) {
    if (pos >= range.from && pos < range.to) {
      return true;
    }
  }
  return false;
}

export function inRangeSegment(from: number, to: number, ranges: Range[]): boolean {
  for (const range of ranges) {
    if (from >= range.from && to <= range.to) {
      return true;
    }
  }
  return false;
}

export function overlapsRange(from: number, to: number, ranges: Range[]): boolean {
  for (const range of ranges) {
    if (from < range.to && to > range.from) {
      return true;
    }
  }
  return false;
}

export function selectionOverlapsRange(
  selectionRanges: readonly SelectionRange[],
  from: number,
  to: number
): boolean {
  for (const range of selectionRanges) {
    if (range.from === range.to) {
      continue;
    }
    if (range.from < to && range.to > from) {
      return true;
    }
  }
  return false;
}

export function cursorInsideRange(
  selectionRanges: readonly SelectionRange[],
  from: number,
  to: number
): boolean {
  for (const range of selectionRanges) {
    const head = range.head;
    if (head >= from && head <= to) {
      return true;
    }
  }
  return false;
}
