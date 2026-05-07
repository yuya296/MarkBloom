// pointer/mouse イベントの composedPath を辿り、ターゲットになっている
// `.cm-table-cell` 要素を返す純粋ユーティリティ。
// 行/列ハンドル要素 (`.cm-table-col-handle` / `.cm-table-row-handle`) を
// 経由しているイベントは「セル外」とみなして null を返す。

export function isTableHandleElement(node: unknown): boolean {
  return (
    node instanceof Element &&
    !!node.closest(".cm-table-col-handle, .cm-table-row-handle")
  );
}

export function findHoveredCellInEvent(
  event: PointerEvent | MouseEvent
): HTMLTableCellElement | null {
  const path = event.composedPath();
  for (const node of path) {
    if (isTableHandleElement(node)) {
      return null;
    }
    if (!(node instanceof Element)) {
      continue;
    }
    const cell = node.closest<HTMLTableCellElement>(".cm-table-cell");
    if (cell) {
      return cell;
    }
  }
  return null;
}
