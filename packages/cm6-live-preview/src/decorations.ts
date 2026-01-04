import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";
import type { LivePreviewOptions } from "./index";
import {
  addBlockMarkerDecorations,
  addFencedCodeDecorations,
  collectBlockRevealRange,
} from "./block/blockMarkers";
import { addInlineMarkerDecorations } from "./inline/inlineDecorations";
import { collectInlineMarkerRanges } from "./inline/inlineMarkerRanges";
import { collectExcludedRanges } from "./core/excludedRanges";
import { overlapsRange } from "./core/utils";

export function buildDecorations(view: EditorView, options: LivePreviewOptions): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const excluded = collectExcludedRanges(view, options);
  const inlineMarkerRanges = collectInlineMarkerRanges(view, options, excluded);
  const blockRevealRange = collectBlockRevealRange(view, options);
  const selectionRanges = view.state.selection.ranges
    .filter((range) => range.from !== range.to)
    .map((range) => ({ from: range.from, to: range.to }));

  const blockHiddenDecoration = Decoration.replace({
    inclusive: false,
  });
  const inlineHiddenDecoration = Decoration.replace({
    inclusive: false,
  });
  const secondaryColorDecoration = Decoration.mark({
    attributes: { style: "color: var(--editor-secondary-color, #8f8a7f) !important" },
  });

  const pending: Array<{ from: number; to: number; decoration: Decoration }> = [];
  const pushDecoration = (from: number, to: number, decoration: Decoration) => {
    pending.push({ from, to, decoration });
  };

  addFencedCodeDecorations(
    pushDecoration,
    view,
    selectionRanges,
    blockRevealRange,
    blockHiddenDecoration,
    secondaryColorDecoration
  );

  for (const range of view.visibleRanges) {
    let pos = range.from;

    while (pos <= range.to) {
      const line = view.state.doc.lineAt(pos);
      if (line.from > range.to) {
        break;
      }

      const isExcluded = overlapsRange(line.from, line.to, excluded.block);
      const isSelectionOverlap = overlapsRange(line.from, line.to, selectionRanges);
      const isBlockReveal = blockRevealRange
        ? overlapsRange(line.from, line.to, [blockRevealRange])
        : false;

      if (!isExcluded) {
        addBlockMarkerDecorations(
          pushDecoration,
          line.from,
          line.text,
          { isSelectionOverlap, isBlockReveal },
          blockHiddenDecoration,
          secondaryColorDecoration
        );
      }

      pos = line.to + 1;
    }
  }

  addInlineMarkerDecorations(
    pushDecoration,
    inlineMarkerRanges.hidden,
    inlineHiddenDecoration,
    inlineMarkerRanges.colored,
    secondaryColorDecoration
  );

  pending.sort((a, b) => (a.from === b.from ? a.to - b.to : a.from - b.from));
  for (const item of pending) {
    builder.add(item.from, item.to, item.decoration);
  }

  return builder.finish();
}
