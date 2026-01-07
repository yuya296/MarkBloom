import { RangeSetBuilder } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";
import type { LivePreviewOptions } from "./index";
import {
  addBlockMarkerDecorations,
  collectBlockRevealRange,
  collectFenceMarkersByLine,
} from "./block/blockMarkers";
import { addImageDecorations, addInlineMarkerDecorations } from "./inline/inlineDecorations";
import { collectInlineMarkerRanges } from "./inline/inlineMarkerRanges";
import { collectExcludedRanges } from "./core/excludedRanges";
import { overlapsRange } from "./core/utils";

function addThematicBreakDecorations(
  view: EditorView,
  push: (from: number, to: number, decoration: Decoration) => void,
  hiddenDecoration: Decoration,
  blockRevealRange: { from: number; to: number } | null,
  rawLineDecoration: Decoration
) {
  const revealRanges = blockRevealRange ? [blockRevealRange] : [];

  syntaxTree(view.state).iterate({
    enter: (node) => {
      if (node.name !== "HorizontalRule") {
        return;
      }
      if (blockRevealRange && overlapsRange(node.from, node.to, revealRanges)) {
        const line = view.state.doc.lineAt(node.from);
        push(line.from, line.from, rawLineDecoration);
        return;
      }
      push(node.from, node.to, hiddenDecoration);
    },
  });
}

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
  const rawLineDecoration = Decoration.line({ class: "cm-lp-raw" });

  const pending: Array<{ from: number; to: number; decoration: Decoration }> = [];
  const pushDecoration = (from: number, to: number, decoration: Decoration) => {
    pending.push({ from, to, decoration });
  };

  const fenceMarkersByLine = collectFenceMarkersByLine(
    view,
    selectionRanges,
    blockRevealRange
  );

  for (const range of view.visibleRanges) {
    let pos = range.from;

    while (pos <= range.to) {
      const line = view.state.doc.lineAt(pos);
      if (line.from > range.to) {
        break;
      }

      const isExcluded = overlapsRange(line.from, line.to, excluded.block);
      const hasFenceMarkers = fenceMarkersByLine.has(line.from);
      const isSelectionOverlap = overlapsRange(line.from, line.to, selectionRanges);
      const isBlockReveal = blockRevealRange
        ? overlapsRange(line.from, line.to, [blockRevealRange])
        : false;

      if (!isExcluded || hasFenceMarkers) {
        addBlockMarkerDecorations(
          pushDecoration,
          line.from,
          line.text,
          { isSelectionOverlap, isBlockReveal },
          blockHiddenDecoration,
          fenceMarkersByLine
        );
      }

      pos = line.to + 1;
    }
  }

  addThematicBreakDecorations(
    view,
    pushDecoration,
    blockHiddenDecoration,
    blockRevealRange,
    rawLineDecoration
  );

  addInlineMarkerDecorations(pushDecoration, inlineMarkerRanges.hidden, inlineHiddenDecoration);
  addImageDecorations(
    pushDecoration,
    inlineMarkerRanges.images,
    options.imageRawShowsPreview ?? false
  );

  pending.sort((a, b) => (a.from === b.from ? a.to - b.to : a.from - b.from));
  for (const item of pending) {
    builder.add(item.from, item.to, item.decoration);
  }

  return builder.finish();
}
