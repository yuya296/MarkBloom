import { clampCellSelection } from "./tableEditing";
import type { CellSelection, SelectionState } from "./tableSelectionTypes";

// 後方互換のための alias。新規コードでは `CellSelection` を直接使うこと。
export type TableCellSelection = CellSelection;

// 行・列のサイズに収まるよう座標をクランプし、CellSelection を返す。
export function clampCell(
  nextRow: number,
  nextCol: number,
  totalRows: number,
  columnCount: number
): CellSelection {
  return {
    kind: "cell",
    ...clampCellSelection(nextRow, nextCol, totalRows, columnCount),
  };
}

// テーブルが空でない場合は最初の body 行 (row=1)、空なら header 行 (row=0) を選択する。
export function defaultCellSelection(
  bodyRowCount: number,
  totalRows: number,
  columnCount: number
): CellSelection {
  return clampCell(bodyRowCount > 0 ? 1 : 0, 0, totalRows, columnCount);
}

// 平坦化 (row * columnCount + col) されたインデックスで delta セル分移動する。
// オフセット計算は totalRows * columnCount でラップする。
export function moveCellByOffset(
  current: CellSelection,
  delta: number,
  totalRows: number,
  columnCount: number
): CellSelection {
  const totalCells = totalRows * columnCount;
  if (totalCells === 0) {
    return current;
  }
  const flat = current.row * columnCount + current.col;
  const nextFlat = (((flat + delta) % totalCells) + totalCells) % totalCells;
  const nextRow = Math.floor(nextFlat / columnCount);
  const nextCol = nextFlat % columnCount;
  return { kind: "cell", row: nextRow, col: nextCol };
}

// 任意の selection を cell selection に昇格させる純粋関数。
// - selection が null の場合は default cell selection (テーブル空なら header 行) を返す
// - selection が cell の場合は範囲内へクランプ
// - selection が row の場合はその行 +1 (header の次) の col 0 を選択
// - selection が column の場合は最初の body 行 (空なら header) の同じ col を選択
export function ensureCellSelection(
  current: SelectionState | null,
  bodyRowCount: number,
  totalRows: number,
  columnCount: number
): CellSelection {
  if (!current) {
    return defaultCellSelection(bodyRowCount, totalRows, columnCount);
  }
  if (current.kind === "cell") {
    return clampCell(current.row, current.col, totalRows, columnCount);
  }
  if (current.kind === "row") {
    return clampCell(current.row + 1, 0, totalRows, columnCount);
  }
  return clampCell(
    bodyRowCount > 0 ? 1 : 0,
    current.col,
    totalRows,
    columnCount
  );
}
