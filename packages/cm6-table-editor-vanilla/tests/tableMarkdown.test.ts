import assert from "node:assert/strict";
import test from "node:test";
import type { TableData } from "../src/types";
import {
  buildTableMarkdown,
  parseAlignmentLine,
  parseAlignmentsFromLines,
} from "../src/tableMarkdown";
import { setColumnAlignment } from "../src/tableModel";

test("parseAlignmentLine reads alignment markers", () => {
  const result = parseAlignmentLine("| :--- | ---: | :---: |", 3);
  assert.deepEqual(result, ["left", "right", "center"]);
});

test("parseAlignmentsFromLines falls back to null alignment", () => {
  const result = parseAlignmentsFromLines(["| A | B |", "| --- | --- |"], 2);
  assert.deepEqual(result, [null, null]);
});

test("buildTableMarkdown preserves alignments", () => {
  const data: TableData = {
    header: {
      cells: [
        { text: "Col A", from: -1, to: -1 },
        { text: "Col B", from: -1, to: -1 },
      ],
    },
    rows: [{ cells: [{ text: "left", from: -1, to: -1 }, { text: "right", from: -1, to: -1 }] }],
    alignments: ["left", "right"],
  };
  const markdown = buildTableMarkdown(data);
  assert.ok(markdown.includes("| :--- | ---: |"));
});

test("setColumnAlignment updates markdown output", () => {
  const data: TableData = {
    header: {
      cells: [
        { text: "Col A", from: -1, to: -1 },
        { text: "Col B", from: -1, to: -1 },
        { text: "Col C", from: -1, to: -1 },
      ],
    },
    rows: [
      {
        cells: [
          { text: "left", from: -1, to: -1 },
          { text: "right", from: -1, to: -1 },
          { text: "center", from: -1, to: -1 },
        ],
      },
    ],
    alignments: [null, null, null],
  };

  setColumnAlignment(data, 1, "right");
  setColumnAlignment(data, 2, "center");

  const lines = buildTableMarkdown(data).split("\n");
  assert.equal(lines[1], "| --- | ---: | :---: |");
});
