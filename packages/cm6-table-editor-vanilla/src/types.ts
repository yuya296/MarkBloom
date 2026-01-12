export type TableAlignment = "left" | "center" | "right" | null;

export type TableCell = {
  text: string;
  from: number;
  to: number;
};

export type TableRow = {
  cells: TableCell[];
};

export type TableData = {
  header: TableRow | null;
  rows: TableRow[];
  alignments: TableAlignment[];
};
