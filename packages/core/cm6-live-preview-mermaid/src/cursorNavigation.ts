import { Annotation, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { collectMermaidBlocksFromState } from "./blocks";
import {
  shouldMoveCursorPastMermaidBottom,
  shouldMoveCursorToMermaidTop,
} from "./navigationLogic";

const mermaidCursorAdjusted = Annotation.define<boolean>();

export function mermaidCursorNavigation(): Extension {
  return EditorView.updateListener.of((update) => {
    if (!update.selectionSet) {
      return;
    }
    if (update.transactions.some((tr) => tr.annotation(mermaidCursorAdjusted))) {
      return;
    }

    const prevSelection = update.startState.selection.main;
    const currentSelection = update.state.selection.main;

    if (
      prevSelection.from !== prevSelection.to ||
      currentSelection.from !== currentSelection.to
    ) {
      return;
    }

    const prevHead = prevSelection.head;
    const currentHead = currentSelection.head;
    if (prevHead === currentHead) {
      return;
    }

    const blocks = collectMermaidBlocksFromState(update.state);
    for (const block of blocks) {
      if (shouldMoveCursorToMermaidTop(prevHead, currentHead, block)) {
        update.view.dispatch({
          selection: { anchor: block.replaceRange.from },
          annotations: mermaidCursorAdjusted.of(true),
          scrollIntoView: true,
        });
        return;
      }
      if (shouldMoveCursorPastMermaidBottom(prevHead, currentHead, block)) {
        update.view.dispatch({
          selection: { anchor: block.replaceRange.to + 1 },
          annotations: mermaidCursorAdjusted.of(true),
          scrollIntoView: true,
        });
        return;
      }
    }
  });
}
