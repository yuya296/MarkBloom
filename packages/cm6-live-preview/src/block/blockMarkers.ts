import { syntaxTree } from "@codemirror/language";
import { Decoration, EditorView } from "@codemirror/view";
import type { Range } from "../core/types";
import { cursorInsideRange, selectionOverlapsRange } from "../core/utils";
import { NodeName, hasNodeName } from "../core/syntaxNodeNames";
import { markerReplace } from "../theme/markerWidgets";

const blockMarkerPattern = {
  heading: /^\s{0,3}(#{1,6})(?=\s|$)/,
  quote: /^\s{0,3}(>)(?=\s?)/,
};

const blockTriggerNames: ReadonlySet<NodeName> = new Set<NodeName>([
  NodeName.Blockquote,
  NodeName.BulletList,
  NodeName.OrderedList,
  NodeName.ListItem,
  NodeName.ATXHeading1,
  NodeName.ATXHeading2,
  NodeName.ATXHeading3,
  NodeName.ATXHeading4,
  NodeName.ATXHeading5,
  NodeName.ATXHeading6,
  NodeName.SetextHeading1,
  NodeName.SetextHeading2,
  NodeName.FencedCode,
  NodeName.CodeBlock,
]);

function fenceLabel(lineText: string): string {
  const match = lineText.match(/^\s*([`~]{3,})\s*(\S+)?/u);
  if (!match) {
    return "</> code";
  }

  const language = match[2];
  return language ? `</> ${language}` : "</> code";
}

export function collectBlockRawRanges(view: EditorView): Range[] {
  const rawRanges: Range[] = [];
  const selection = view.state.selection;

  syntaxTree(view.state).iterate({
    enter: (node) => {
      if (!hasNodeName(blockTriggerNames, node.name)) {
        return;
      }

      if (
        selectionOverlapsRange(selection.ranges, node.from, node.to) ||
        cursorInsideRange(selection.ranges, node.from, node.to)
      ) {
        rawRanges.push({ from: node.from, to: node.to });
      }
    },
  });

  return rawRanges;
}

type PushDecoration = (from: number, to: number, decoration: Decoration) => void;

export function addBlockMarkerDecorations(
  push: PushDecoration,
  lineFrom: number,
  lineText: string,
  hiddenDecoration: Decoration
) {
  const headingMatch = lineText.match(blockMarkerPattern.heading);
  if (headingMatch) {
    const markerIndex = lineText.indexOf(headingMatch[1]);
    const hasSpaceAfter = lineText[markerIndex + headingMatch[1].length] === " ";
    const markerLength = headingMatch[1].length + (hasSpaceAfter ? 1 : 0);
    const from = lineFrom + markerIndex;
    const to = from + markerLength;
    push(from, to, hiddenDecoration);
  }

  const quoteMatch = lineText.match(blockMarkerPattern.quote);
  if (quoteMatch) {
    const markerIndex = lineText.indexOf(quoteMatch[1]);
    const from = lineFrom + markerIndex;
    const to = from + quoteMatch[1].length;
    push(from, to, hiddenDecoration);
  }
}

export function addFencedCodeDecorations(
  push: PushDecoration,
  view: EditorView,
  rawRanges: Range[],
  hiddenDecoration: Decoration
) {
  syntaxTree(view.state).iterate({
    enter: (node) => {
      if (node.name !== NodeName.FencedCode) {
        return;
      }

      if (rawRanges.some((range) => node.from < range.to && node.to > range.from)) {
        return;
      }

      const startLine = view.state.doc.lineAt(node.from);
      const endLine = view.state.doc.lineAt(node.to);

      const label = fenceLabel(startLine.text);
      push(
        startLine.from,
        startLine.to,
        markerReplace(label, "cm-live-preview-block-label", "var(--editor-secondary-color, #8f8a7f)")
      );
      push(endLine.from, endLine.to, hiddenDecoration);
    },
  });
}
