export type Rect = {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
};

export function getDropIndexByY(rects: Rect[], clientY: number): number {
  for (let index = 0; index < rects.length; index += 1) {
    const rect = rects[index];
    if (clientY <= rect.top + rect.height / 2) {
      return index;
    }
  }
  return rects.length;
}

export function getDropIndexByX(rects: Rect[], clientX: number): number {
  for (let index = 0; index < rects.length; index += 1) {
    const rect = rects[index];
    if (clientX <= rect.left + rect.width / 2) {
      return index;
    }
  }
  return rects.length;
}

export function isWithinVerticalRange(rects: Rect[], clientY: number): boolean {
  const first = rects[0];
  const last = rects[rects.length - 1];
  if (!first || !last) {
    return false;
  }
  return clientY >= first.top && clientY <= last.bottom;
}

export function isWithinBounds(
  rect: Rect,
  clientX: number,
  clientY: number,
  tolerance: number
): boolean {
  const withinY =
    clientY >= rect.top - tolerance && clientY <= rect.bottom + tolerance;
  const withinX =
    clientX >= rect.left - tolerance && clientX <= rect.right + tolerance;
  return withinX && withinY;
}
