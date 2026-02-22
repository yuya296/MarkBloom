import { Annotation, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { collectMermaidBlocksFromState, type MermaidBlockInfo } from "./blocks";
import {
  shouldMoveCursorPastMermaidBottom,
  shouldMoveCursorToMermaidTop,
} from "./navigationLogic";

const mermaidCursorAdjusted = Annotation.define<boolean>();

function nextCaretPositionAfterBlock(view: EditorView, block: MermaidBlockInfo): number {
  const endLine = view.state.doc.lineAt(block.replaceRange.to);
  if (endLine.number < view.state.doc.lines) {
    return view.state.doc.line(endLine.number + 1).from;
  }
  return block.replaceRange.to;
}

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
          selection: { anchor: nextCaretPositionAfterBlock(update.view, block) },
          annotations: mermaidCursorAdjusted.of(true),
          scrollIntoView: true,
        });
        return;
      }
    }
  });
}
