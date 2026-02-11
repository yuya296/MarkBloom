import assert from "node:assert/strict";
import test from "node:test";
import type { TableData } from "../src/types";
import {
  buildTableMarkdown,
  formatCell,
  parseAlignmentLine,
  parseAlignmentsFromLines,
  toDisplayText,
  toMarkdownText,
} from "../src/tableMarkdown";

test("formatCell trims and escapes pipes", () => {
  assert.equal(formatCell("  a|b  "), "a\\|b");
});

test("parseAlignmentLine pads missing columns and truncates extras", () => {
  assert.deepEqual(parseAlignmentLine("| :--- |", 3), ["left", null, null]);
  assert.deepEqual(parseAlignmentLine("| :--- | ---: | :---: | --- |", 2), ["left", "right"]);
});

test("parseAlignmentsFromLines returns empty list when columnCount is zero", () => {
  assert.deepEqual(parseAlignmentsFromLines(["| A |", "| --- |"], 0), []);
});

test("toDisplayText and toMarkdownText convert line breaks both ways", () => {
  assert.equal(toDisplayText("a<br>b<BR />c"), "a\nb\nc");
  assert.equal(toMarkdownText("a\r\nb\nc"), "a<br>b<br>c");
});

test("buildTableMarkdown keeps one-column minimum and aligns with current default header behavior", () => {
  const data: TableData = {
    header: null,
    rows: [],
    alignments: [],
  };
  assert.equal(buildTableMarkdown(data), "|  |\n|  |");
});

test("buildTableMarkdown preserves escaped cell content and separator alignment", () => {
  const data: TableData = {
    header: {
      cells: [
        { text: "A", from: -1, to: -1 },
        { text: "B", from: -1, to: -1 },
      ],
    },
    rows: [{ cells: [{ text: "x|y", from: -1, to: -1 }, { text: "z", from: -1, to: -1 }] }],
    alignments: ["left", "right"],
  };
  const lines = buildTableMarkdown(data).split("\n");
  assert.equal(lines[1], "| :--- | ---: |");
  assert.equal(lines[2], "| x\\|y | z |");
});
