import test from "node:test";
import assert from "node:assert/strict";
import {
  remapReorderIndex,
  remapSelectionForColReorder,
  remapSelectionForRowReorder,
} from "../src/tableReorder";

test("remapReorderIndex returns insert position for the moved index itself", () => {
  // 5 行を仮定し、index=1 を index=4 (4 つ目の前) に移動。
  // remap した後の自身の位置は 3 (targetInsertIndex=4 を超えていれば -1 補正)
  assert.equal(remapReorderIndex(1, 4, 1, 5), 3);
});

test("remapReorderIndex shifts indices between moved and target", () => {
  // 5 行で source=1 を target=4 に動かす場合、index=2 と 3 はそれぞれ 1 と 2 に詰まる
  assert.equal(remapReorderIndex(1, 4, 2, 5), 1);
  assert.equal(remapReorderIndex(1, 4, 3, 5), 2);
  // 範囲外 (target を超えた行) はそのまま
  assert.equal(remapReorderIndex(1, 4, 4, 5), 4);
});

test("remapReorderIndex handles backward moves", () => {
  // source=4 を target=1 に動かす。index=2 / 3 は +1 シフト。
  assert.equal(remapReorderIndex(4, 1, 4, 5), 1);
  assert.equal(remapReorderIndex(4, 1, 1, 5), 2);
  assert.equal(remapReorderIndex(4, 1, 3, 5), 4);
  // index=0 は影響を受けない
  assert.equal(remapReorderIndex(4, 1, 0, 5), 0);
});

test("remapReorderIndex clamps out-of-range arguments", () => {
  assert.equal(remapReorderIndex(99, 99, 99, 4), 3);
  assert.equal(remapReorderIndex(-5, -5, -5, 4), 0);
});

test("remapReorderIndex returns 0 for empty data", () => {
  assert.equal(remapReorderIndex(0, 0, 0, 0), 0);
});

test("remapReorderIndex is identity when source equals targetInsertIndex (no-op move)", () => {
  // 同位置への挿入は実質 no-op として元の index をそのまま返すこと
  for (let i = 0; i < 5; i += 1) {
    assert.equal(remapReorderIndex(2, 2, i, 5), i);
  }
});

test("remapReorderIndex is identity when target is just after source (no-op move)", () => {
  // source=2 を target=3 (= source の直後) に動かしても同位置となる
  for (let i = 0; i < 5; i += 1) {
    assert.equal(remapReorderIndex(2, 3, i, 5), i);
  }
});

test("remapSelectionForRowReorder returns null for null selection", () => {
  assert.equal(remapSelectionForRowReorder(null, 1, 4, 5), null);
});

test("remapSelectionForRowReorder remaps row selection directly", () => {
  // 5 body 行で row=2 を選択中、row=1 を row=4 へ動かすと selection は row=1 に詰まる
  assert.deepEqual(remapSelectionForRowReorder({ kind: "row", row: 2 }, 1, 4, 5), {
    kind: "row",
    row: 1,
  });
});

test("remapSelectionForRowReorder leaves header cell unchanged", () => {
  // row=0 (header) は body reorder の影響を受けない
  const sel = { kind: "cell" as const, row: 0, col: 1 };
  assert.deepEqual(remapSelectionForRowReorder(sel, 1, 4, 5), sel);
});

test("remapSelectionForRowReorder remaps body cell using body index space", () => {
  // 5 body 行で cell row=3 (body index=2) が選択。row 1 を row 4 に動かすと
  // body index 2 -> 1、cell row は +1 して 2
  assert.deepEqual(
    remapSelectionForRowReorder({ kind: "cell", row: 3, col: 1 }, 1, 4, 5),
    { kind: "cell", row: 2, col: 1 }
  );
});

test("remapSelectionForRowReorder ignores column selection", () => {
  const sel = { kind: "column" as const, col: 2 };
  assert.deepEqual(remapSelectionForRowReorder(sel, 1, 4, 5), sel);
});

test("remapSelectionForColReorder remaps column and cell col", () => {
  assert.deepEqual(
    remapSelectionForColReorder({ kind: "column", col: 2 }, 1, 4, 5),
    { kind: "column", col: 1 }
  );
  assert.deepEqual(
    remapSelectionForColReorder({ kind: "cell", row: 3, col: 2 }, 1, 4, 5),
    { kind: "cell", row: 3, col: 1 }
  );
});

test("remapSelectionForColReorder leaves row selection alone", () => {
  const sel = { kind: "row" as const, row: 1 };
  assert.deepEqual(remapSelectionForColReorder(sel, 1, 4, 5), sel);
});

test("remapSelectionForRowReorder is defensive when bodyRowCount is 0", () => {
  // 実コード上は到達しない経路だが、純粋関数として defensive に動く確認。
  // remapReorderIndex は totalCount<=0 のとき 0 を返すため、body cell は row=1 にクランプされる。
  assert.deepEqual(
    remapSelectionForRowReorder({ kind: "cell", row: 1, col: 0 }, 0, 0, 0),
    { kind: "cell", row: 1, col: 0 }
  );
  assert.deepEqual(
    remapSelectionForRowReorder({ kind: "row", row: 0 }, 0, 0, 0),
    { kind: "row", row: 0 }
  );
});

test("remapSelectionForColReorder is defensive when columnCount is 0", () => {
  assert.deepEqual(
    remapSelectionForColReorder({ kind: "cell", row: 1, col: 0 }, 0, 0, 0),
    { kind: "cell", row: 1, col: 0 }
  );
  assert.deepEqual(
    remapSelectionForColReorder({ kind: "column", col: 0 }, 0, 0, 0),
    { kind: "column", col: 0 }
  );
});
