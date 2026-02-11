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

function sampleTable(): TableData {
  return {
    header: {
      cells: [
        { text: "A", from: -1, to: -1 },
        { text: "B", from: -1, to: -1 },
      ],
    },
    rows: [{ cells: [{ text: "1", from: -1, to: -1 }, { text: "2", from: -1, to: -1 }] }],
    alignments: ["left", "right"],
  };
}

test("normalizeTableData truncates and pads alignments", () => {
  const data: TableData = {
    header: {
      cells: [{ text: "A", from: -1, to: -1 }],
    },
    rows: [],
    alignments: ["left", "center", "right"],
  };
  normalizeTableData(data);
  assert.deepEqual(data.alignments, ["left"]);

  data.header?.cells.push({ text: "B", from: -1, to: -1 });
  normalizeTableData(data);
  assert.deepEqual(data.alignments, ["left", null]);
});

test("insertRowAt clamps negative and overshoot indexes", () => {
  const negative = sampleTable();
  insertRowAt(negative, -10);
  assert.equal(negative.rows.length, 2);
  assert.deepEqual(
    negative.rows[0].cells.map((cell) => cell.text),
    ["", ""]
  );

  const overshoot = sampleTable();
  insertRowAt(overshoot, 999);
  assert.equal(overshoot.rows.length, 2);
  assert.deepEqual(
    overshoot.rows[1].cells.map((cell) => cell.text),
    ["", ""]
  );
});

test("deleteRowAt no-ops for out of range index", () => {
  const data = sampleTable();
  const before = JSON.stringify(data);
  deleteRowAt(data, -1);
  deleteRowAt(data, 99);
  assert.equal(JSON.stringify(data), before);
});

test("insertColumnAt clamps negative and overshoot indexes", () => {
  const negative = sampleTable();
  insertColumnAt(negative, -3);
  assert.equal(negative.header?.cells.length, 3);
  assert.equal(negative.header?.cells[0]?.text, "Col 1");
  assert.deepEqual(
    negative.rows[0].cells.map((cell) => cell.text),
    ["", "1", "2"]
  );

  const overshoot = sampleTable();
  insertColumnAt(overshoot, 100);
  assert.equal(overshoot.header?.cells.length, 3);
  assert.equal(overshoot.header?.cells[2]?.text, "Col 3");
  assert.deepEqual(
    overshoot.rows[0].cells.map((cell) => cell.text),
    ["1", "2", ""]
  );
});

test("deleteColumnAt no-ops for one-column tables", () => {
  const data: TableData = {
    header: { cells: [{ text: "A", from: -1, to: -1 }] },
    rows: [{ cells: [{ text: "1", from: -1, to: -1 }] }],
    alignments: [null],
  };
  deleteColumnAt(data, 0);
  assert.equal(data.header?.cells.length, 1);
  assert.equal(data.rows[0].cells.length, 1);
  assert.equal(data.alignments.length, 1);
});

test("setColumnAlignment ignores out of range index", () => {
  const data = sampleTable();
  const before = [...data.alignments];
  setColumnAlignment(data, -1, "center");
  setColumnAlignment(data, 10, "center");
  assert.deepEqual(data.alignments, before);
});

test("reorderRows and reorderColumns no-op when effectively same position", () => {
  const data = sampleTable();
  const before = JSON.stringify(data);
  reorderRows(data, 0, 1);
  reorderColumns(data, 0, 1);
  assert.equal(JSON.stringify(data), before);
});
