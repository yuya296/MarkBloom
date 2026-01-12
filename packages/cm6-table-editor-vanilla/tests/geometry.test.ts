import assert from "node:assert/strict";
import test from "node:test";
import {
  getDropIndexByX,
  getDropIndexByY,
  isWithinBounds,
  isWithinVerticalRange,
} from "../src/geometry";

const rects = [
  { top: 10, bottom: 20, left: 10, right: 110, width: 100, height: 10 },
  { top: 20, bottom: 30, left: 10, right: 110, width: 100, height: 10 },
  { top: 30, bottom: 40, left: 10, right: 110, width: 100, height: 10 },
];

test("getDropIndexByY returns first index before midpoint", () => {
  assert.equal(getDropIndexByY(rects, 14), 0);
  assert.equal(getDropIndexByY(rects, 24), 1);
  assert.equal(getDropIndexByY(rects, 50), 3);
});

test("getDropIndexByX returns index by midpoint", () => {
  const columns = [
    { top: 0, bottom: 10, left: 0, right: 10, width: 10, height: 10 },
    { top: 0, bottom: 10, left: 10, right: 20, width: 10, height: 10 },
  ];
  assert.equal(getDropIndexByX(columns, 5), 0);
  assert.equal(getDropIndexByX(columns, 15), 1);
  assert.equal(getDropIndexByX(columns, 25), 2);
});

test("isWithinVerticalRange checks first/last bounds", () => {
  assert.equal(isWithinVerticalRange(rects, 9), false);
  assert.equal(isWithinVerticalRange(rects, 15), true);
  assert.equal(isWithinVerticalRange(rects, 41), false);
});

test("isWithinBounds honors tolerance", () => {
  const rect = { top: 10, bottom: 20, left: 10, right: 20, width: 10, height: 10 };
  assert.equal(isWithinBounds(rect, 5, 15, 5), true);
  assert.equal(isWithinBounds(rect, 0, 15, 5), false);
});
