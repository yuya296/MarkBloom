import { Decoration, type EditorView } from "@codemirror/view";
import type { Line, RangeSetBuilder } from "@codemirror/state";
import type { ExcludeRanges, InlineMarkRanges } from "../core/types";
import { inRanges } from "../core/utils";
import { markerReplace } from "../theme/markerWidgets";

const inlineMarkers = new Set(["*", "_", "[", "]", "(", ")", "`", "~"]);

function collectMarkPositions(markRanges: InlineMarkRanges): Set<number> {
  const positions = new Set<number>();
  const allRanges = [
    ...markRanges.codeMarks,
    ...markRanges.emphasisMarks,
    ...markRanges.strikethroughMarks,
  ];

  for (const range of allRanges) {
    for (let pos = range.from; pos < range.to; pos += 1) {
      positions.add(pos);
    }
  }

  return positions;
}

export function addInlineMarkerDecorations(
  builder: RangeSetBuilder<Decoration>,
  view: EditorView,
  line: Line,
  revealPositions: Set<number>,
  excluded: ExcludeRanges,
  decoration: Decoration,
  emphasisHiddenDecoration: Decoration,
  markRanges: InlineMarkRanges
) {
  const markPositions = collectMarkPositions(markRanges);

  for (let pos = line.from; pos <= line.to; pos += 1) {
    const ch = view.state.doc.sliceString(pos, pos + 1);
    if (!inlineMarkers.has(ch)) {
      continue;
    }

    const inExcluded = inRanges(pos, excluded.block) || inRanges(pos, excluded.inline);

    if (inExcluded) {
      continue;
    }

    if (ch === "*" || ch === "_" || ch === "~" || ch === "`") {
      if (!markPositions.has(pos)) {
        continue;
      }
      if (revealPositions.has(pos)) {
        builder.add(
          pos,
          pos + 1,
          markerReplace(
            ch,
            "cm-live-preview-inline-visible",
            "var(--editor-secondary-color, #8f8a7f)"
          )
        );
      } else {
        builder.add(pos, pos + 1, emphasisHiddenDecoration);
      }
      continue;
    }

    if (revealPositions.has(pos)) {
      continue;
    }

    builder.add(pos, pos + 1, decoration);
  }
}
