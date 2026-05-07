import type { Annotation, TransactionSpec } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

// TableWidget が編集をエディタへ反映するときに利用する dispatch ヘルパー群。
// いずれも widget からの操作で発生する余分な再スクロールを抑えつつ
// (scroll 位置を保存→dispatch→次のフレームで復元)、必要に応じて
// エディタにフォーカスを戻す。

export function dispatchOutsideTransaction(
  view: EditorView,
  transaction: TransactionSpec,
  focusEditor = false
): void {
  const scrollTop = view.scrollDOM.scrollTop;
  const scrollLeft = view.scrollDOM.scrollLeft;
  view.dispatch({ ...transaction, scrollIntoView: false });
  if (focusEditor) {
    view.focus();
  }
  requestAnimationFrame(() => {
    view.scrollDOM.scrollTop = scrollTop;
    view.scrollDOM.scrollLeft = scrollLeft;
  });
}

export function dispatchOutsideUpdate(
  view: EditorView,
  transaction: {
    changes: { from: number; to: number; insert: string };
    annotations: Annotation<unknown>;
  }
): void {
  dispatchOutsideTransaction(view, transaction);
}

export function dispatchOutsideSelection(
  view: EditorView,
  anchor: number,
  focusEditor = false
): void {
  if (focusEditor) {
    view.focus();
  }
  view.dispatch({
    selection: { anchor },
    scrollIntoView: true,
  });
}
