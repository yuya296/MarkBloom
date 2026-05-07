import test from "node:test";
import assert from "node:assert/strict";
import {
  findHoveredCellInEvent,
  isTableHandleElement,
} from "../src/tableHoverTarget";

// 最小限の DOM mock。`closest` は祖先を辿って match する要素を返す
// 実ブラウザ準拠の挙動を再現する (子→親→...→祖先のいずれかが match すれば返す)。
type FakeElement = {
  parent: FakeElement | null;
  classes: Set<string>;
  classList: { contains: (name: string) => boolean };
  closest: (selector: string) => FakeElement | null;
};

function makeFakeElement(classes: string[], parent: FakeElement | null = null): FakeElement {
  const set = new Set(classes);
  const el: FakeElement = {
    parent,
    classes: set,
    classList: {
      contains: (name: string) => set.has(name),
    },
    closest: (selector: string) => {
      const wanted = selector
        .split(",")
        .map((s) => s.trim().replace(/^\./, ""));
      let cur: FakeElement | null = el;
      while (cur) {
        if (wanted.some((cls) => cur!.classes.has(cls))) {
          return cur;
        }
        cur = cur.parent;
      }
      return null;
    },
  };
  return el;
}

// `instanceof Element` 判定を通すための一時的な Element コンストラクタ差し替え。
// node.js 環境には Element が無いので、テスト中だけ差し替える。
function withFakeElement<T>(run: () => T): T {
  const original = (globalThis as { Element?: unknown }).Element;
  class FakeElementCtor {}
  (globalThis as { Element?: unknown }).Element = FakeElementCtor;
  try {
    return run();
  } finally {
    if (original === undefined) {
      delete (globalThis as { Element?: unknown }).Element;
    } else {
      (globalThis as { Element?: unknown }).Element = original;
    }
  }
}

function makeElementInstance(
  classes: string[],
  parent: FakeElement | null = null
): FakeElement {
  const fake = makeFakeElement(classes, parent);
  const Element = (globalThis as { Element?: { prototype?: object } }).Element;
  if (Element?.prototype) {
    Object.setPrototypeOf(fake, Element.prototype);
  }
  return fake;
}

test("isTableHandleElement returns true for handle elements themselves", () => {
  withFakeElement(() => {
    const colHandle = makeElementInstance(["cm-table-col-handle"]);
    const rowHandle = makeElementInstance(["cm-table-row-handle"]);
    assert.equal(isTableHandleElement(colHandle), true);
    assert.equal(isTableHandleElement(rowHandle), true);
  });
});

test("isTableHandleElement returns true for descendants of a handle", () => {
  withFakeElement(() => {
    const handle = makeElementInstance(["cm-table-col-handle"]);
    const handleIcon = makeElementInstance(["cm-table-handle-icon"], handle);
    const handleIconChild = makeElementInstance([], handleIcon);
    assert.equal(isTableHandleElement(handleIcon), true);
    assert.equal(isTableHandleElement(handleIconChild), true);
  });
});

test("isTableHandleElement returns false for unrelated elements and non-Element values", () => {
  withFakeElement(() => {
    const cell = makeElementInstance(["cm-table-cell"]);
    assert.equal(isTableHandleElement(cell), false);
    assert.equal(isTableHandleElement(null), false);
    assert.equal(isTableHandleElement("string"), false);
    assert.equal(isTableHandleElement({ notAnElement: true }), false);
  });
});

test("findHoveredCellInEvent walks ancestors via closest to find the cell", () => {
  withFakeElement(() => {
    const cellEl = makeElementInstance(["cm-table-cell"]);
    const cellContent = makeElementInstance(["cm-table-cell-content"], cellEl);
    const innerSpan = makeElementInstance(["inner-text"], cellContent);
    // event.target は子孫 (innerSpan) であっても祖先の cell を返す
    const event = {
      composedPath: () => [innerSpan, cellContent, cellEl],
    } as unknown as PointerEvent;
    assert.equal(findHoveredCellInEvent(event), cellEl);
  });
});

test("findHoveredCellInEvent returns null when path includes a handle descendant before any cell", () => {
  withFakeElement(() => {
    // handle の子要素から発火したイベント。cell も path にあるが先に handle が見つかるので null
    const handle = makeElementInstance(["cm-table-col-handle"]);
    const handleIcon = makeElementInstance(["cm-table-handle-icon"], handle);
    const cellEl = makeElementInstance(["cm-table-cell"]);
    const event = {
      composedPath: () => [handleIcon, handle, cellEl],
    } as unknown as PointerEvent;
    assert.equal(findHoveredCellInEvent(event), null);
  });
});

test("findHoveredCellInEvent returns null when no cell is in the path", () => {
  withFakeElement(() => {
    const other = makeElementInstance(["cm-content"]);
    const event = {
      composedPath: () => [other],
    } as unknown as PointerEvent;
    assert.equal(findHoveredCellInEvent(event), null);
  });
});

test("findHoveredCellInEvent skips non-Element entries (e.g. window/document)", () => {
  withFakeElement(() => {
    const cellEl = makeElementInstance(["cm-table-cell"]);
    const event = {
      composedPath: () => [{ notAnElement: true }, cellEl],
    } as unknown as PointerEvent;
    assert.equal(findHoveredCellInEvent(event), cellEl);
  });
});
