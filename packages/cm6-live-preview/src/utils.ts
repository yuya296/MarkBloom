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
