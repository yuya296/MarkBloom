import test from "node:test";
import assert from "node:assert/strict";
import {
  clampCell,
  defaultCellSelection,
  ensureCellSelection,
  moveCellByOffset,
} from "../src/tableCellSelection";

test("clampCell keeps in-range coordinates", () => {
  assert.deepEqual(clampCell(1, 2, 4, 4), { kind: "cell", row: 1, col: 2 });
});

test("clampCell clamps negative and overshoot to nearest valid bounds", () => {
  assert.deepEqual(clampCell(-3, -1, 4, 4), { kind: "cell", row: 0, col: 0 });
  assert.deepEqual(clampCell(99, 99, 3, 2), { kind: "cell", row: 2, col: 1 });
});

test("defaultCellSelection prefers first body row when rows exist", () => {
  // bodyRowCount=2, totalRows=3 (header + 2 body), columnCount=2
  assert.deepEqual(defaultCellSelection(2, 3, 2), { kind: "cell", row: 1, col: 0 });
});

test("defaultCellSelection falls back to header row when no body rows exist", () => {
  // body=0, totalRows=1 (only header), columnCount=3
  assert.deepEqual(defaultCellSelection(0, 1, 3), { kind: "cell", row: 0, col: 0 });
});

test("moveCellByOffset advances within row and wraps to next row", () => {
  // 2 rows x 3 cols
  const start = { kind: "cell" as const, row: 0, col: 1 };
  assert.deepEqual(moveCellByOffset(start, 1, 2, 3), { kind: "cell", row: 0, col: 2 });
  assert.deepEqual(moveCellByOffset(start, 2, 2, 3), { kind: "cell", row: 1, col: 0 });
});

test("moveCellByOffset wraps around past the end and from the start", () => {
  const last = { kind: "cell" as const, row: 1, col: 2 };
  assert.deepEqual(moveCellByOffset(last, 1, 2, 3), { kind: "cell", row: 0, col: 0 });
  const first = { kind: "cell" as const, row: 0, col: 0 };
  assert.deepEqual(moveCellByOffset(first, -1, 2, 3), { kind: "cell", row: 1, col: 2 });
});

test("moveCellByOffset handles delta larger than total cells (fixes negative-modulo bug from old closure impl)", () => {
  // 旧実装は (flat + delta + totalCells) % totalCells で、delta < -totalCells で
  // 負の余りが残り row/col が負になる挙動だった。新実装は (((x % m) + m) % m) で安全。
  // total=6 cells; delta=7 should land 1 step forward from start
  const start = { kind: "cell" as const, row: 0, col: 0 };
  assert.deepEqual(moveCellByOffset(start, 7, 2, 3), { kind: "cell", row: 0, col: 1 });
  assert.deepEqual(moveCellByOffset(start, -7, 2, 3), { kind: "cell", row: 1, col: 2 });
});

test("moveCellByOffset returns current selection when grid is empty", () => {
  const cur = { kind: "cell" as const, row: 0, col: 0 };
  assert.deepEqual(moveCellByOffset(cur, 1, 0, 0), cur);
});

test("ensureCellSelection returns default cell when current is null", () => {
  assert.deepEqual(ensureCellSelection(null, 2, 3, 2), {
    kind: "cell",
    row: 1,
    col: 0,
  });
});

test("ensureCellSelection clamps existing cell selection to grid bounds", () => {
  // 範囲外を渡してもクランプされる
  assert.deepEqual(
    ensureCellSelection({ kind: "cell", row: 5, col: 9 }, 2, 3, 2),
    { kind: "cell", row: 2, col: 1 }
  );
});

test("ensureCellSelection promotes row selection to first cell of that body row", () => {
  // row=1 は body の 2 番目 → header の次にあたるので row=2, col=0
  assert.deepEqual(ensureCellSelection({ kind: "row", row: 1 }, 3, 4, 2), {
    kind: "cell",
    row: 2,
    col: 0,
  });
});

test("ensureCellSelection promotes column selection to first body row of that column", () => {
  // body 行があるので row=1, col は維持
  assert.deepEqual(ensureCellSelection({ kind: "column", col: 1 }, 2, 3, 2), {
    kind: "cell",
    row: 1,
    col: 1,
  });
});

test("ensureCellSelection from column falls back to header when no body rows", () => {
  // body 行 0 のときは header (row=0) を選ぶ
  assert.deepEqual(ensureCellSelection({ kind: "column", col: 0 }, 0, 1, 2), {
    kind: "cell",
    row: 0,
    col: 0,
  });
});

test("ensureCellSelection clamps out-of-range row selection during promotion", () => {
  // row=99 が来ても row+1=100 は totalRows-1 にクランプされる
  assert.deepEqual(ensureCellSelection({ kind: "row", row: 99 }, 2, 3, 2), {
    kind: "cell",
    row: 2,
    col: 0,
  });
});

test("ensureCellSelection clamps out-of-range column selection during promotion", () => {
  // col=99 はクランプされて columnCount-1
  assert.deepEqual(ensureCellSelection({ kind: "column", col: 99 }, 2, 3, 2), {
    kind: "cell",
    row: 1,
    col: 1,
  });
});
