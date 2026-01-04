import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";
import type { LivePreviewOptions } from "./index";
import {
  addBlockMarkerDecorations,
  addFencedCodeDecorations,
  collectBlockRawRanges,
} from "./block/blockMarkers";
import { addInlineMarkerDecorations } from "./inline/inlineDecorations";
import { collectInlineHiddenRanges } from "./inline/inlineHiddenRanges";
import { collectExcludedRanges } from "./core/excludedRanges";
import { overlapsRange } from "./core/utils";

export function buildDecorations(view: EditorView, options: LivePreviewOptions): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const excluded = collectExcludedRanges(view, options);
  const rawBlockRanges = collectBlockRawRanges(view);
  const inlineHiddenRanges = collectInlineHiddenRanges(view, options, excluded);
  const activeLine = view.state.doc.lineAt(view.state.selection.main.head);

  const blockHiddenDecoration = Decoration.replace({
    inclusive: false,
  });
  const inlineHiddenDecoration = Decoration.replace({
    inclusive: false,
  });

  const pending: Array<{ from: number; to: number; decoration: Decoration }> = [];
  const pushDecoration = (from: number, to: number, decoration: Decoration) => {
    pending.push({ from, to, decoration });
  };

  addFencedCodeDecorations(pushDecoration, view, rawBlockRanges, blockHiddenDecoration);

  for (const range of view.visibleRanges) {
    let pos = range.from;

    while (pos <= range.to) {
      const line = view.state.doc.lineAt(pos);
      if (line.from > range.to) {
        break;
      }

      const isActiveLine = line.number === activeLine.number;
      const isRawBlock = overlapsRange(line.from, line.to, rawBlockRanges);

      if (!isActiveLine && !isRawBlock && !overlapsRange(line.from, line.to, excluded.block)) {
        addBlockMarkerDecorations(
          pushDecoration,
          line.from,
          line.text,
          blockHiddenDecoration
        );
      }

      pos = line.to + 1;
    }
  }

  addInlineMarkerDecorations(pushDecoration, inlineHiddenRanges, inlineHiddenDecoration);

  pending.sort((a, b) => (a.from === b.from ? a.to - b.to : a.from - b.from));
  for (const item of pending) {
    builder.add(item.from, item.to, item.decoration);
  }

  return builder.finish();
}
