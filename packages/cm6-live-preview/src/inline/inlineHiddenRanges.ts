import { syntaxTree } from "@codemirror/language";
import type { EditorView } from "@codemirror/view";
import type { Line } from "@codemirror/state";
import type { ExcludeRanges, Range } from "../core/types";
import type { LivePreviewOptions } from "../index";
import { cursorInsideRange, inRangeSegment, selectionOverlapsRange } from "../core/utils";
import {
  INLINE_CONTAINER_NAMES,
  INLINE_MARK_NAMES,
  NodeName,
  hasNodeName,
} from "../core/syntaxNodeNames";

function isCursorAdjacent(
  line: Line,
  head: number,
  from: number,
  to: number,
  radiusBefore: number,
  radiusAfter: number
): boolean {
  if (head < from) {
    if (from - head > radiusAfter) {
      return false;
    }
    const between = line.text.slice(head - line.from, from - line.from);
    return !/\s/u.test(between);
  }

  if (head > to) {
    if (head - to > radiusBefore) {
      return false;
    }
    const between = line.text.slice(to - line.from, head - line.from);
    return !/\s/u.test(between);
  }

  return false;
}

function shouldShowInlineRaw(
  view: EditorView,
  node: { from: number; to: number },
  options: LivePreviewOptions
): boolean {
  const selection = view.state.selection;
  if (selectionOverlapsRange(selection.ranges, node.from, node.to)) {
    return true;
  }

  if (cursorInsideRange(selection.ranges, node.from, node.to)) {
    return true;
  }

  const head = selection.main.head;
  const line = view.state.doc.lineAt(head);
  if (line.number !== view.state.doc.lineAt(node.from).number) {
    return false;
  }

  const radius = options.inlineRadius ?? 1;
  const radiusBefore = options.inlineRadiusBefore ?? radius;
  const radiusAfter = options.inlineRadiusAfter ?? radius;

  return isCursorAdjacent(line, head, node.from, node.to, radiusBefore, radiusAfter);
}

export function collectInlineHiddenRanges(
  view: EditorView,
  options: LivePreviewOptions,
  excluded: ExcludeRanges
): Range[] {
  const hidden: Range[] = [];
  const tree = syntaxTree(view.state);

  tree.iterate({
    enter: (node) => {
      if (!hasNodeName(INLINE_CONTAINER_NAMES, node.name)) {
        return;
      }

      if (options.exclude?.code !== false && node.name === NodeName.InlineCode) {
        return;
      }

      if (
        inRangeSegment(node.from, node.to, excluded.block) ||
        inRangeSegment(node.from, node.to, excluded.inline)
      ) {
        return;
      }

      if (shouldShowInlineRaw(view, node, options)) {
        return;
      }

      tree.iterate({
        from: node.from,
        to: node.to,
        enter: (child) => {
          if (
            hasNodeName(INLINE_MARK_NAMES, child.name) ||
            child.name === NodeName.URL
          ) {
            hidden.push({ from: child.from, to: child.to });
          }
        },
      });
    },
  });

  return hidden;
}
