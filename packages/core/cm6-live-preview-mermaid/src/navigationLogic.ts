import type { MermaidBlockInfo } from "./blocks";

type MermaidBoundaryBlock = Pick<MermaidBlockInfo, "replaceRange">;

export function isCursorAtTopBoundary(head: number, block: MermaidBoundaryBlock): boolean {
  return head === block.replaceRange.from;
}

export function isCursorAtBottomBoundary(head: number, block: MermaidBoundaryBlock): boolean {
  return head === block.replaceRange.to + 1;
}

export function isDirectionalBoundaryRaw(
  prevHead: number,
  currentHead: number,
  block: MermaidBoundaryBlock
): boolean {
  return prevHead > block.replaceRange.to && isCursorAtBottomBoundary(currentHead, block);
}

export function shouldMoveCursorToMermaidTop(
  prevHead: number,
  currentHead: number,
  block: MermaidBoundaryBlock
): boolean {
  return prevHead < block.replaceRange.from && currentHead === block.replaceRange.to;
}

export function shouldMoveCursorPastMermaidBottom(
  prevHead: number,
  currentHead: number,
  block: MermaidBoundaryBlock
): boolean {
  return (
    prevHead >= block.replaceRange.from &&
    prevHead < block.replaceRange.to &&
    currentHead === block.replaceRange.to
  );
}
