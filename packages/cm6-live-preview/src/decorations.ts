import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";
import type { LivePreviewOptions } from "./index";
import { addBlockMarkerDecorations, resolveBlockRevealRange } from "./block/blockMarkers";
import { addInlineMarkerDecorations } from "./inline/inlineDecorations";
import { collectInlineRevealPositions } from "./inline/inlineReveal";
import { collectInlineMarkRanges } from "./inline/inlineMarks";
import { collectExcludedRanges } from "./core/excludedRanges";
import { overlapsRange } from "./core/utils";

export function buildDecorations(view: EditorView, options: LivePreviewOptions): DecorationSet {
  if (options.disableDuringIME && view.composing) {
    return Decoration.none;
  }

  const builder = new RangeSetBuilder<Decoration>();
  const blockReveal = resolveBlockRevealRange(view, options);
  const excluded = collectExcludedRanges(view, options);
  const revealPositions = collectInlineRevealPositions(view, options);
  const markRanges = collectInlineMarkRanges(view, excluded);

  const blockDecoration = Decoration.mark({
    class:
      options.blockStyle === "hide"
        ? "cm-live-preview-block-hide"
        : "cm-live-preview-block-dim",
  });

  const headingDecoration = Decoration.replace({
    inclusive: false,
  });

  const headingVisibleDecoration = Decoration.mark({
    class: "cm-live-preview-heading-visible",
    attributes: { style: "color: var(--cm-live-preview-marker-color) !important" },
  });

  const inlineDecoration = Decoration.mark({
    class:
      options.inlineStyle === "hide"
        ? "cm-live-preview-inline-hide"
        : "cm-live-preview-inline-dim",
  });
  const emphasisHiddenDecoration = Decoration.replace({
    inclusive: false,
  });

  for (const range of view.visibleRanges) {
    let pos = range.from;

    while (pos <= range.to) {
      const line = view.state.doc.lineAt(pos);
      if (line.from > range.to) {
        break;
      }

      const lineWithinBlockReveal =
        line.from >= blockReveal.from && line.to <= blockReveal.to;

      if (!lineWithinBlockReveal && !overlapsRange(line.from, line.to, excluded.block)) {
        addBlockMarkerDecorations(
          builder,
          line.from,
          line.text,
          blockDecoration,
          headingDecoration
        );
      } else if (!overlapsRange(line.from, line.to, excluded.block)) {
        addBlockMarkerDecorations(
          builder,
          line.from,
          line.text,
          blockDecoration,
          headingVisibleDecoration
        );
      }

      addInlineMarkerDecorations(
        builder,
        view,
        line,
        revealPositions,
        excluded,
        inlineDecoration,
        emphasisHiddenDecoration,
        markRanges
      );

      pos = line.to + 1;
    }
  }

  return builder.finish();
}
