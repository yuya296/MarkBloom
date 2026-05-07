// 行・列を並べ替えたとき、selection を新しい位置に追従させる純粋ロジック。
// TableWidget の toDOM 内クロージャから切り出した。
//
// `sourceIndex`: 動かしたい行/列の元のインデックス
// `targetInsertIndex`: 挿入したい位置 (元の配列での「この位置の前」を指す)
// `index`: 追従計算したい既存の選択座標

import type { SelectionState } from "./tableSelectionTypes";

// reorder 後のインデックスを再計算する。範囲外は最も近い有効インデックスへクランプ。
export function remapReorderIndex(
  sourceIndex: number,
  targetInsertIndex: number,
  index: number,
  totalCount: number
): number {
  if (totalCount <= 0) {
    return 0;
  }
  const clampedSource = Math.max(0, Math.min(sourceIndex, totalCount - 1));
  const clampedIndex = Math.max(0, Math.min(index, totalCount - 1));
  let finalInsert = Math.max(0, Math.min(targetInsertIndex, totalCount));
  if (clampedSource < finalInsert) {
    finalInsert -= 1;
  }
  if (clampedIndex === clampedSource) {
    return finalInsert;
  }
  if (clampedSource < finalInsert) {
    return clampedIndex > clampedSource && clampedIndex <= finalInsert
      ? clampedIndex - 1
      : clampedIndex;
  }
  return clampedIndex >= finalInsert && clampedIndex < clampedSource
    ? clampedIndex + 1
    : clampedIndex;
}

// 行 reorder に対して selection を追従。
// - row selection: そのまま remap
// - cell selection: header 行 (row=0) は変えず、body 行は body index (row-1) で remap して +1
// - column selection: 列 reorder の影響を受けないのでそのまま
export function remapSelectionForRowReorder(
  current: SelectionState | null,
  sourceIndex: number,
  targetInsertIndex: number,
  bodyRowCount: number
): SelectionState | null {
  if (!current) {
    return null;
  }
  if (current.kind === "row") {
    return {
      kind: "row",
      row: remapReorderIndex(sourceIndex, targetInsertIndex, current.row, bodyRowCount),
    };
  }
  if (current.kind === "cell") {
    if (current.row === 0) {
      return current;
    }
    const bodyRowIndex = current.row - 1;
    return {
      kind: "cell",
      row:
        remapReorderIndex(sourceIndex, targetInsertIndex, bodyRowIndex, bodyRowCount) +
        1,
      col: current.col,
    };
  }
  return current;
}

// 列 reorder に対して selection を追従。
// - column selection: remap
// - cell selection: row はそのまま、col のみ remap
// - row selection: 行 reorder の影響を受けないのでそのまま
export function remapSelectionForColReorder(
  current: SelectionState | null,
  sourceIndex: number,
  targetInsertIndex: number,
  columnCount: number
): SelectionState | null {
  if (!current) {
    return null;
  }
  if (current.kind === "column") {
    return {
      kind: "column",
      col: remapReorderIndex(sourceIndex, targetInsertIndex, current.col, columnCount),
    };
  }
  if (current.kind === "cell") {
    return {
      kind: "cell",
      row: current.row,
      col: remapReorderIndex(sourceIndex, targetInsertIndex, current.col, columnCount),
    };
  }
  return current;
}
