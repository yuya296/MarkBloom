import { syntaxTree } from "@codemirror/language";
import { type EditorState } from "@codemirror/state";
import { Decoration } from "@codemirror/view";
import type { Range } from "../core/types";
import { hasNodeName } from "../core/syntaxNodeNames";
import { overlapsRange } from "../core/utils";
import {
  blockMarkerConfigs,
  blockTriggerNodeNames,
  type DisplayStyle,
  type RawModeTrigger,
} from "../config";
import type { LivePreviewOptions } from "../index";
import { taskCheckboxReplace } from "../theme/markerWidgets";

const blockMarkerPattern = {
  heading: /^\s{0,3}(#{1,6})(?=\s|$)/,
  list: /^\s{0,3}([*+-]|\d+\.)(?=\s)/,
  quotePrefix: /^\s{0,3}(?:>\s?)*/,
  taskList:
    /^\s{0,3}(?:>\s?)*\s*(?:[*+-]|\d+\.)\s+(\[(?: |x|X)\])(?=\s|$)/,
};

type BlockMarker = {
  id: "heading" | "list" | "quote" | "fence";
  from: number;
  to: number;
};

type PushDecoration = (from: number, to: number, decoration: Decoration) => void;

type BlockRawState = {
  isSelectionOverlap: boolean;
  isBlockReveal: boolean;
};

type TaskCheckbox = {
  from: number;
  to: number;
  checked: boolean;
};

function normalizeTriggers(rawModeTrigger: RawModeTrigger | RawModeTrigger[]): RawModeTrigger[] {
  return Array.isArray(rawModeTrigger) ? rawModeTrigger : [rawModeTrigger];
}

function isRawByTriggers(state: BlockRawState, rawModeTrigger: RawModeTrigger | RawModeTrigger[]): boolean {
  const triggers = normalizeTriggers(rawModeTrigger);

  if (triggers.includes("always")) {
    return true;
  }

  if (triggers.includes("nearby") && state.isSelectionOverlap) {
    return true;
  }

  if (triggers.includes("block") && state.isBlockReveal) {
    return true;
  }

  return false;
}

export function collectBlockRevealRange(
  state: EditorState,
  options: LivePreviewOptions
): Range | null {
  if (!options.blockRevealEnabled) {
    return null;
  }

  const head = state.selection.main.head;
  const tree = syntaxTree(state);
  const candidates = [tree.resolve(head, 1), tree.resolve(head, -1)];

  for (const resolved of candidates) {
    let current: typeof resolved | null = resolved;
    let fallback: Range | null = null;
    while (current) {
      if (hasNodeName(blockTriggerNodeNames, current.name)) {
        if (current.name === "Blockquote") {
          return { from: current.from, to: current.to };
        }
        if (!fallback) {
          fallback = { from: current.from, to: current.to };
        }
      }
      current = current.parent;
    }
    if (fallback) {
      return fallback;
    }
  }

  return null;
}

function collectBlockMarkers(
  lineFrom: number,
  lineText: string,
  fenceMarkersByLine: Map<number, BlockMarker[]>
): BlockMarker[] {
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

  const quotePrefix = lineText.match(blockMarkerPattern.quotePrefix)?.[0] ?? "";
  if (quotePrefix.includes(">")) {
    for (let i = 0; i < quotePrefix.length; i += 1) {
      if (quotePrefix[i] === ">") {
        const from = lineFrom + i;
        const nextChar = quotePrefix[i + 1];
        const to = nextChar === " " ? from + 2 : from + 1;
        markers.push({ id: "quote", from, to });
      }
    }
  }

  const fenceMarkers = fenceMarkersByLine.get(lineFrom);
  if (fenceMarkers) {
    markers.push(...fenceMarkers);
  }

  return markers;
}

function pushBlockMarkerDecoration(
  push: PushDecoration,
  marker: BlockMarker,
  state: BlockRawState,
  hiddenDecoration: Decoration
) {
  const config = blockMarkerConfigs.find((entry) => entry.id === marker.id);
  if (!config) {
    return;
  }

  const isRaw = isRawByTriggers(state, config.rawModeTrigger);
  const style: DisplayStyle = isRaw ? "none" : config.richDisplayStyle;

  if (style === "hide") {
    push(marker.from, marker.to, hiddenDecoration);
    return;
  }
}

export function addBlockMarkerDecorations(
  push: PushDecoration,
  lineFrom: number,
  lineText: string,
  state: BlockRawState,
  hiddenDecoration: Decoration,
  fenceMarkersByLine: Map<number, BlockMarker[]>
) {
  const markers = collectBlockMarkers(lineFrom, lineText, fenceMarkersByLine);
  for (const marker of markers) {
    pushBlockMarkerDecoration(push, marker, state, hiddenDecoration);
  }
}

function collectTaskCheckbox(
  lineFrom: number,
  lineText: string
): TaskCheckbox | null {
  const match = lineText.match(blockMarkerPattern.taskList);
  const token = match?.[1];
  if (!token) {
    return null;
  }

  const tokenIndex = lineText.indexOf(token);
  if (tokenIndex < 0) {
    return null;
  }

  const from = lineFrom + tokenIndex;
  const to = from + token.length;
  return {
    from,
    to,
    checked: token[1].toLowerCase() === "x",
  };
}

function hasCursorInLine(state: EditorState, lineFrom: number): boolean {
  return state.selection.ranges.some(
    (range) => state.doc.lineAt(range.head).from === lineFrom
  );
}

function isCursorNearTaskToken(
  state: EditorState,
  checkbox: TaskCheckbox,
  lineFrom: number
): boolean {
  for (const range of state.selection.ranges) {
    if (range.from !== range.to) {
      continue;
    }

    const head = range.head;
    const line = state.doc.lineAt(head);
    if (line.from !== lineFrom) {
      continue;
    }

    if (head >= checkbox.from && head <= checkbox.to) {
      return true;
    }

    if (head < checkbox.from) {
      if (checkbox.from - head > 1) {
        continue;
      }
      const between = line.text.slice(head - line.from, checkbox.from - line.from);
      if (!/\s/u.test(between)) {
        return true;
      }
      continue;
    }

    if (head > checkbox.to) {
      if (head - checkbox.to > 1) {
        continue;
      }
      const between = line.text.slice(checkbox.to - line.from, head - line.from);
      if (!/\s/u.test(between)) {
        return true;
      }
    }
  }

  return false;
}

function shouldShowTaskCheckboxRaw(
  state: EditorState,
  checkbox: TaskCheckbox,
  lineFrom: number,
  selectionRanges: Range[]
): boolean {
  if (overlapsRange(checkbox.from, checkbox.to, selectionRanges)) {
    return true;
  }
  if (!hasCursorInLine(state, lineFrom)) {
    return false;
  }
  return isCursorNearTaskToken(state, checkbox, lineFrom);
}

export function addTaskCheckboxDecorations(
  state: EditorState,
  push: PushDecoration,
  lineFrom: number,
  lineText: string,
  selectionRanges: Range[]
) {
  const checkbox = collectTaskCheckbox(lineFrom, lineText);
  if (!checkbox) {
    return;
  }
  if (shouldShowTaskCheckboxRaw(state, checkbox, lineFrom, selectionRanges)) {
    return;
  }
  push(
    checkbox.from,
    checkbox.to,
    taskCheckboxReplace(checkbox.checked, checkbox.from, checkbox.to)
  );
}

export function collectFenceMarkersByLine(
  state: EditorState,
  selectionRanges: Range[],
  blockRevealRange: Range | null
): Map<number, BlockMarker[]> {
  const markersByLine = new Map<number, BlockMarker[]>();

  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name !== "FencedCode") {
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
        ["nearby", "block"]
      )
        ? "none"
        : "hide";

      if (style !== "hide") {
        return;
      }

      const startLine = state.doc.lineAt(node.from);
      const endLine = state.doc.lineAt(node.to);

      const startMarkers = markersByLine.get(startLine.from) ?? [];
      startMarkers.push({ id: "fence", from: startLine.from, to: startLine.to });
      markersByLine.set(startLine.from, startMarkers);

      const endMarkers = markersByLine.get(endLine.from) ?? [];
      endMarkers.push({ id: "fence", from: endLine.from, to: endLine.to });
      markersByLine.set(endLine.from, endMarkers);
    },
  });

  return markersByLine;
}
