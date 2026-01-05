import { Decoration } from "@codemirror/view";
import type { Range } from "../core/types";

type PushDecoration = (from: number, to: number, decoration: Decoration) => void;

export function addInlineMarkerDecorations(
  push: PushDecoration,
  hiddenRanges: Range[],
  hiddenDecoration: Decoration
) {
  for (const range of hiddenRanges) {
    if (range.from < range.to) {
      push(range.from, range.to, hiddenDecoration);
    }
  }
}
