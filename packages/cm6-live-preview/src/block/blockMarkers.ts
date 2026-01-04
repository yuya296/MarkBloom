import { syntaxTree } from "@codemirror/language";
import { Decoration, EditorView } from "@codemirror/view";
import type { Range } from "../core/types";
import { hasNodeName } from "../core/syntaxNodeNames";
import { markerReplace } from "../theme/markerWidgets";
import {
  blockFenceConfig,
  blockMarkerConfigs,
  blockTriggerNodeNames,
  type DisplayStyle,
  type TriggerId,
} from "../config";
import type { LivePreviewOptions } from "../index";

const blockMarkerPattern = {
  heading: /^\s{0,3}(#{1,6})(?=\s|$)/,
  list: /^\s{0,3}([*+-]|\d+\.)(?=\s)/,
  quote: /^\s{0,3}(>)(?=\s?)/,
};

type BlockMarker = {
  id: "heading" | "list" | "quote";
  from: number;
  to: number;
};

type PushDecoration = (from: number, to: number, decoration: Decoration) => void;

type BlockRawState = {
  isSelectionOverlap: boolean;
  isBlockReveal: boolean;
};

function fenceLabel(lineText: string): string {
  const match = lineText.match(/^\s*([`~]{3,})\s*(\S+)?/u);
  if (!match) {
    return "</> code";
  }

  const language = match[2];
  return language ? `</> ${language}` : "</> code";
}

function isRawByTriggers(state: BlockRawState, triggers: TriggerId[]): boolean {
  if (triggers.includes("none")) {
    return false;
  }

  if (triggers.includes("selection") && state.isSelectionOverlap) {
    return true;
  }

  if (triggers.includes("block") && state.isBlockReveal) {
    return true;
  }

  return false;
}

export function collectBlockRevealRange(
  view: EditorView,
  options: LivePreviewOptions
): Range | null {
  if (!options.blockRevealEnabled) {
    return null;
  }

  const head = view.state.selection.main.head;
  const resolved = syntaxTree(view.state).resolve(head, -1);
  let current: typeof resolved | null = resolved;
  while (current) {
    if (hasNodeName(blockTriggerNodeNames, current.name)) {
      return { from: current.from, to: current.to };
    }
    current = current.parent;
  }

  return null;
}

function collectBlockMarkers(lineFrom: number, lineText: string): BlockMarker[] {
  const markers: BlockMarker[] = [];

  const headingMatch = lineText.match(blockMarkerPattern.heading);
  if (headingMatch) {
    const markerIndex = lineText.indexOf(headingMatch[1]);
    const hasSpaceAfter = lineText[markerIndex + headingMatch[1].length] === " ";
    const markerLength = headingMatch[1].length + (hasSpaceAfter ? 1 : 0);
    const from = lineFrom + markerIndex;
    const to = from + markerLength;
    markers.push({ id: "heading", from, to });
  }

  const listMatch = lineText.match(blockMarkerPattern.list);
  if (listMatch) {
    const markerIndex = lineText.indexOf(listMatch[1]);
    const from = lineFrom + markerIndex;
    const to = from + listMatch[1].length;
    markers.push({ id: "list", from, to });
  }

  const quoteMatch = lineText.match(blockMarkerPattern.quote);
  if (quoteMatch) {
    const markerIndex = lineText.indexOf(quoteMatch[1]);
    const from = lineFrom + markerIndex;
    const to = from + quoteMatch[1].length;
    markers.push({ id: "quote", from, to });
  }

  return markers;
}

function pushBlockMarkerDecoration(
  push: PushDecoration,
  marker: BlockMarker,
  state: BlockRawState,
  hiddenDecoration: Decoration,
  colorDecoration: Decoration
) {
  const config = blockMarkerConfigs.find((entry) => entry.id === marker.id);
  if (!config) {
    return;
  }

  const isRaw = isRawByTriggers(state, config.triggers);
  const style: DisplayStyle = isRaw ? config.raw : config.preview;

  if (style === "hide") {
    push(marker.from, marker.to, hiddenDecoration);
    return;
  }

  if (style === "color-secondary") {
    push(marker.from, marker.to, colorDecoration);
  }
}

export function addBlockMarkerDecorations(
  push: PushDecoration,
  lineFrom: number,
  lineText: string,
  state: BlockRawState,
  hiddenDecoration: Decoration,
  colorDecoration: Decoration
) {
  const markers = collectBlockMarkers(lineFrom, lineText);
  for (const marker of markers) {
    pushBlockMarkerDecoration(push, marker, state, hiddenDecoration, colorDecoration);
  }
}

export function addFencedCodeDecorations(
  push: PushDecoration,
  view: EditorView,
  selectionRanges: Range[],
  blockRevealRange: Range | null,
  hiddenDecoration: Decoration,
  colorDecoration: Decoration
) {
  syntaxTree(view.state).iterate({
    enter: (node) => {
      if (node.name !== blockFenceConfig.node) {
        return;
      }

      const isSelectionOverlap = selectionRanges.some(
        (range) => node.from < range.to && node.to > range.from
      );
      const isBlockReveal = blockRevealRange
        ? node.from < blockRevealRange.to && node.to > blockRevealRange.from
        : false;
      const style = isRawByTriggers(
        { isSelectionOverlap, isBlockReveal },
        blockFenceConfig.triggers
      )
        ? blockFenceConfig.raw
        : blockFenceConfig.preview;

      const startLine = view.state.doc.lineAt(node.from);
      const endLine = view.state.doc.lineAt(node.to);

      if (style === "widgetLabel") {
        const label = fenceLabel(startLine.text);
        push(
          startLine.from,
          startLine.to,
          markerReplace(label, "cm-live-preview-block-label", "var(--editor-secondary-color, #8f8a7f)")
        );
        push(endLine.from, endLine.to, hiddenDecoration);
        return;
      }

      if (style === "hide") {
        push(startLine.from, startLine.to, hiddenDecoration);
        push(endLine.from, endLine.to, hiddenDecoration);
        return;
      }

      if (style === "color-secondary") {
        push(startLine.from, startLine.to, colorDecoration);
        push(endLine.from, endLine.to, colorDecoration);
      }
    },
  });
}
