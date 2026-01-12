import assert from "node:assert/strict";
import test from "node:test";
import type { TableData } from "../src/types";
import {
  buildTableMarkdown,
  parseAlignmentLine,
  parseAlignmentsFromLines,
} from "../src/tableMarkdown";

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
