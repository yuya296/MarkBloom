import { clampCellSelection } from "./tableEditing";

// TableWidget 内部の selection 型と同一構造。
// (#134 phase 3 で SelectionState 全体を別ファイルに移すまで、ここで cell 選択のみ
//  ローカル型として持っておく。RowSelection / ColumnSelection は本ファイルでは扱わない)
export type TableCellSelection = {
  kind: "cell";
  row: number;
  col: number;
};

// 行・列のサイズに収まるよう座標をクランプし、CellSelection を返す。
export function clampCell(
  nextRow: number,
  nextCol: number,
  totalRows: number,
  columnCount: number
): TableCellSelection {
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
): TableCellSelection {
  return clampCell(bodyRowCount > 0 ? 1 : 0, 0, totalRows, columnCount);
}

// 平坦化 (row * columnCount + col) されたインデックスで delta セル分移動する。
// オフセット計算は totalRows * columnCount でラップする。
export function moveCellByOffset(
  current: TableCellSelection,
  delta: number,
  totalRows: number,
  columnCount: number
): TableCellSelection {
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
