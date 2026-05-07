// TableWidget 内の selection 状態の型定義。
// 以前は index.ts と tableCellSelection.ts / tableReorder.ts に分散していた。

export type CellSelection = {
  kind: "cell";
  row: number;
  col: number;
};

export type RowSelection = {
  kind: "row";
  row: number;
};

export type ColumnSelection = {
  kind: "column";
  col: number;
};

export type SelectionState = CellSelection | RowSelection | ColumnSelection;
