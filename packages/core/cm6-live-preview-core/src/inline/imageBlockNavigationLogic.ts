import type { ImageBlockInfo } from "./imageBlocks";

type ImageBoundaryBlock = Pick<ImageBlockInfo, "replaceRange">;
type PendingDirection = "down";

export function shouldMoveCursorToImageTop(
  prevHead: number,
  currentHead: number,
  block: ImageBoundaryBlock
): boolean {
  return prevHead < block.replaceRange.from && currentHead === block.replaceRange.to;
}

export function shouldMoveCursorPastImageBottom(
  prevHead: number,
  currentHead: number,
  block: ImageBoundaryBlock
): boolean {
  return (
    prevHead >= block.replaceRange.from &&
    prevHead < block.replaceRange.to &&
    currentHead === block.replaceRange.to
  );
}

export function resolveImageBlockAdjustedHead(
  prevHead: number,
  currentHead: number,
  block: ImageBoundaryBlock,
  pendingDirection: PendingDirection | null,
  wasRawModeAtStart: boolean
): number | null {
  if (pendingDirection !== "down") {
    return null;
  }
  if (shouldMoveCursorToImageTop(prevHead, currentHead, block)) {
    return block.replaceRange.from;
  }
  // Allow escaping to the next line when cursor is at the image-block top.
  // This covers the "entered from above, then ArrowDown again" sequence.
  const isAtImageTop = prevHead === block.replaceRange.from;
  // If navigation starts in raw mode, keep plain markdown cursor movement
  // unless we are at the synthetic image-block top anchor.
  if (wasRawModeAtStart && !isAtImageTop) {
    return null;
  }
  if (shouldMoveCursorPastImageBottom(prevHead, currentHead, block)) {
    return block.replaceRange.to + 1;
  }
  return null;
}
