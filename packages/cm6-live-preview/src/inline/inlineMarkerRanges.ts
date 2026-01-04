import { syntaxTree } from "@codemirror/language";
import type { EditorView } from "@codemirror/view";
import type { Line } from "@codemirror/state";
import type { ExcludeRanges, Range } from "../core/types";
import type { LivePreviewOptions } from "../index";
import { inRangeSegment, selectionOverlapsRange } from "../core/utils";
import {
  INLINE_CONTAINER_NAMES,
  NodeName,
  hasNodeName,
} from "../core/syntaxNodeNames";
import { inlineElementConfigs, type InlineElementConfig } from "../config";

const inlineConfigByNode = new Map(
  inlineElementConfigs.map((config) => [config.node, config])
);

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

function isInlineRaw(
  view: EditorView,
  node: { from: number; to: number },
  options: LivePreviewOptions,
  triggers: InlineElementConfig["triggers"]
): boolean {
  if (triggers.includes("selection")) {
    if (selectionOverlapsRange(view.state.selection.ranges, node.from, node.to)) {
      return true;
    }
  }

  if (triggers.includes("proximity")) {
    const head = view.state.selection.main.head;
    const line = view.state.doc.lineAt(head);
    if (line.number === view.state.doc.lineAt(node.from).number) {
      const radius = options.inlineRadius ?? 1;
      const radiusBefore = options.inlineRadiusBefore ?? radius;
      const radiusAfter = options.inlineRadiusAfter ?? radius;
      if (head >= node.from && head <= node.to) {
        return true;
      }
      if (isCursorAdjacent(line, head, node.from, node.to, radiusBefore, radiusAfter)) {
        return true;
      }
    }
  }

  return false;
}

function collectChildRanges(
  view: EditorView,
  from: number,
  to: number,
  targets: ReadonlySet<NodeName>
): Range[] {
  const ranges: Range[] = [];
  syntaxTree(view.state).iterate({
    from,
    to,
    enter: (node) => {
      if (targets.has(node.name as NodeName)) {
        ranges.push({ from: node.from, to: node.to });
      }
    },
  });
  return ranges;
}

export function collectInlineMarkerRanges(
  view: EditorView,
  options: LivePreviewOptions,
  excluded: ExcludeRanges
): { hidden: Range[]; colored: Range[] } {
  const hidden: Range[] = [];
  const colored: Range[] = [];
  const tree = syntaxTree(view.state);

  tree.iterate({
    enter: (node) => {
      if (!hasNodeName(INLINE_CONTAINER_NAMES, node.name)) {
        return;
      }

      const config = inlineConfigByNode.get(node.name);
      if (!config) {
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

      const raw = isInlineRaw(view, node, options, config.triggers);
      const previewTargets = new Set(config.previewHideNodes);
      const rawTargets = new Set(config.rawColorNodes);

      if (!raw && config.preview === "hide") {
        hidden.push(...collectChildRanges(view, node.from, node.to, previewTargets));
      }

      if (raw && config.raw === "color-secondary") {
        colored.push(...collectChildRanges(view, node.from, node.to, rawTargets));
      }

      if (!raw && config.preview === "color-secondary") {
        colored.push(...collectChildRanges(view, node.from, node.to, previewTargets));
      }
    },
  });

  return { hidden, colored };
}
