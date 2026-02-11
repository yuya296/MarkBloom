import { Decoration } from "@codemirror/view";
import type { Range } from "../core/types";
import { imageReplace, imageWidget } from "./imageWidget";

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

export function addImageDecorations(
  push: PushDecoration,
  images: Array<{ from: number; to: number; src: string; alt: string; raw: boolean }>,
  rawShowsPreview: boolean
) {
  for (const image of images) {
    if (image.from < image.to) {
      if (image.raw) {
        if (rawShowsPreview) {
          push(image.to, image.to, imageWidget(image.src, image.alt));
        }
        continue;
      }
      push(image.from, image.to, imageReplace(image.src, image.alt));
    }
  }
}
