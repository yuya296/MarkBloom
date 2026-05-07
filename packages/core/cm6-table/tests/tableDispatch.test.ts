import test from "node:test";
import assert from "node:assert/strict";
import { Annotation } from "@codemirror/state";
import {
  dispatchOutsideSelection,
  dispatchOutsideTransaction,
  dispatchOutsideUpdate,
} from "../src/tableDispatch";

type DispatchedSpec = {
  scrollIntoView?: boolean;
  selection?: { anchor: number };
  changes?: { from: number; to: number; insert: string };
  annotations?: Annotation<unknown>;
};

function makeMockView(
  initialScroll = { top: 17, left: 23 },
  options: { scrollMutationOnDispatch?: { top: number; left: number } } = {}
) {
  const dispatched: DispatchedSpec[] = [];
  let focusCount = 0;
  let raf: (() => void) | null = null;
  const view = {
    scrollDOM: { scrollTop: initialScroll.top, scrollLeft: initialScroll.left },
    dispatch(spec: DispatchedSpec) {
      dispatched.push(spec);
      // 実際の EditorView.dispatch は内部で scrollIntoView 等により scrollDOM を
      // 動かしうる。テストではこのケースを再現するため、明示的に scroll を変動
      // させて RAF 内の復元が効いていることを検出できるようにする。
      if (options.scrollMutationOnDispatch) {
        view.scrollDOM.scrollTop = options.scrollMutationOnDispatch.top;
        view.scrollDOM.scrollLeft = options.scrollMutationOnDispatch.left;
      }
    },
    focus() {
      focusCount += 1;
    },
  };
  // requestAnimationFrame は capture して同期的に呼べるようにする
  const originalRaf = globalThis.requestAnimationFrame;
  (globalThis as unknown as { requestAnimationFrame: (cb: () => void) => number }).requestAnimationFrame = (cb) => {
    raf = cb;
    return 0;
  };
  return {
    view,
    dispatched,
    getFocusCount: () => focusCount,
    flushRaf: () => {
      raf?.();
      raf = null;
    },
    restore: () => {
      globalThis.requestAnimationFrame = originalRaf;
    },
  };
}

test("dispatchOutsideTransaction disables scrollIntoView and restores scroll position via raf", () => {
  // dispatch 中に内部で scroll が動いた状況を再現し、raf 後に元位置に戻ることを検出する。
  const ctx = makeMockView(
    { top: 100, left: 50 },
    { scrollMutationOnDispatch: { top: 999, left: 888 } }
  );
  try {
    const annotations = Annotation.define<boolean>().of(true);
    dispatchOutsideTransaction(
      ctx.view as unknown as Parameters<typeof dispatchOutsideTransaction>[0],
      {
        changes: { from: 0, to: 0, insert: "x" },
        annotations,
      }
    );
    assert.equal(ctx.dispatched.length, 1);
    assert.equal(ctx.dispatched[0].scrollIntoView, false);
    // dispatch 直後: mock 内で scroll が変動した状態
    assert.equal(ctx.view.scrollDOM.scrollTop, 999);
    assert.equal(ctx.view.scrollDOM.scrollLeft, 888);
    // raf 後: 元の scroll 位置に復元される
    ctx.flushRaf();
    assert.equal(ctx.view.scrollDOM.scrollTop, 100);
    assert.equal(ctx.view.scrollDOM.scrollLeft, 50);
  } finally {
    ctx.restore();
  }
});

test("dispatchOutsideTransaction focuses editor when focusEditor is true", () => {
  const ctx = makeMockView();
  try {
    dispatchOutsideTransaction(
      ctx.view as unknown as Parameters<typeof dispatchOutsideTransaction>[0],
      { selection: { anchor: 0 } },
      true
    );
    assert.equal(ctx.getFocusCount(), 1);
    ctx.flushRaf();
  } finally {
    ctx.restore();
  }
});

test("dispatchOutsideUpdate routes through dispatchOutsideTransaction", () => {
  const ctx = makeMockView();
  try {
    const annotations = Annotation.define<boolean>().of(true);
    dispatchOutsideUpdate(
      ctx.view as unknown as Parameters<typeof dispatchOutsideUpdate>[0],
      { changes: { from: 0, to: 0, insert: "y" }, annotations }
    );
    assert.equal(ctx.dispatched.length, 1);
    assert.equal(ctx.dispatched[0].changes?.insert, "y");
    assert.equal(ctx.dispatched[0].scrollIntoView, false);
    ctx.flushRaf();
  } finally {
    ctx.restore();
  }
});

test("dispatchOutsideSelection dispatches selection with scrollIntoView true", () => {
  const ctx = makeMockView();
  try {
    dispatchOutsideSelection(
      ctx.view as unknown as Parameters<typeof dispatchOutsideSelection>[0],
      42
    );
    assert.equal(ctx.dispatched.length, 1);
    assert.deepEqual(ctx.dispatched[0].selection, { anchor: 42 });
    assert.equal(ctx.dispatched[0].scrollIntoView, true);
    assert.equal(ctx.getFocusCount(), 0);
  } finally {
    ctx.restore();
  }
});

test("dispatchOutsideSelection focuses editor when requested", () => {
  const ctx = makeMockView();
  try {
    dispatchOutsideSelection(
      ctx.view as unknown as Parameters<typeof dispatchOutsideSelection>[0],
      7,
      true
    );
    assert.equal(ctx.getFocusCount(), 1);
  } finally {
    ctx.restore();
  }
});
