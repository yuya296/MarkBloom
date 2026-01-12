import assert from "node:assert/strict";
import test from "node:test";
import type { TableData } from "../src/types";
import {
  deleteColumnAt,
  deleteRowAt,
  insertColumnAt,
  insertRowAt,
  normalizeTableData,
  reorderColumns,
  reorderRows,
  setColumnAlignment,
} from "../src/tableModel";

const createSampleTable = (): TableData => ({
  header: {
    cells: [
      { text: "Col A", from: -1, to: -1 },
      { text: "Col B", from: -1, to: -1 },
    ],
  },
  rows: [
    { cells: [{ text: "a1", from: -1, to: -1 }, { text: "b1", from: -1, to: -1 }] },
    { cells: [{ text: "a2", from: -1, to: -1 }, { text: "b2", from: -1, to: -1 }] },
  ],
  alignments: ["left", "right"],
});

test("normalizeTableData ensures header cells and alignments length", () => {
  const data: TableData = {
    header: null,
    rows: [{ cells: [{ text: "a", from: -1, to: -1 }] }],
    alignments: [],
  };
  normalizeTableData(data);
  assert.equal(data.header?.cells.length, 1);
  assert.equal(data.alignments.length, 1);
});

test("insertRowAt inserts row at target index", () => {
  const data = createSampleTable();
  insertRowAt(data, 1);
  assert.equal(data.rows.length, 3);
  assert.equal(data.rows[1]?.cells.length, 2);
});

test("deleteRowAt removes row at index", () => {
  const data = createSampleTable();
  deleteRowAt(data, 0);
  assert.equal(data.rows.length, 1);
  assert.equal(data.rows[0]?.cells[0]?.text, "a2");
});

test("reorderRows moves row to target index", () => {
  const data = createSampleTable();
  reorderRows(data, 0, 2);
  assert.equal(data.rows[0]?.cells[0]?.text, "a2");
});

test("insertColumnAt inserts header/rows and alignments", () => {
  const data = createSampleTable();
  insertColumnAt(data, 1);
  assert.equal(data.header?.cells.length, 3);
  assert.equal(data.rows[0]?.cells.length, 3);
  assert.equal(data.alignments.length, 3);
});

test("deleteColumnAt removes header/rows and alignments", () => {
  const data = createSampleTable();
  deleteColumnAt(data, 0);
  assert.equal(data.header?.cells.length, 1);
  assert.equal(data.rows[0]?.cells.length, 1);
  assert.equal(data.alignments.length, 1);
});

test("reorderColumns moves header/rows/alignments", () => {
  const data = createSampleTable();
  setColumnAlignment(data, 0, "left");
  setColumnAlignment(data, 1, "right");
  reorderColumns(data, 0, 2);
  assert.equal(data.header?.cells[0]?.text, "Col B");
  assert.equal(data.rows[0]?.cells[0]?.text, "b1");
  assert.equal(data.alignments[0], "right");
});
