import { syntaxTree } from "@codemirror/language";
import { Decoration, EditorView } from "@codemirror/view";
import type { Range } from "./types";
import type { LivePreviewOptions } from "./index";
import { BLOCK_NODE_NAMES, hasNodeName } from "./syntaxNodeNames";

const blockMarkerPattern = {
  heading: /^\s{0,3}(#{1,6})(?=\s|$)/,
  list: /^\s{0,3}([*+-]|\d+\.)(?=\s)/,
  quote: /^\s{0,3}(>)(?=\s?)/,
};

export function addBlockMarkerDecorations(
  builder: import("@codemirror/state").RangeSetBuilder<Decoration>,
  lineFrom: number,
  lineText: string,
  blockDecoration: Decoration,
  headingDecoration: Decoration
) {
  const headingMatch = lineText.match(blockMarkerPattern.heading);
  if (headingMatch) {
    const markerIndex = lineText.indexOf(headingMatch[1]);
    const hasSpaceAfter = lineText[markerIndex + headingMatch[1].length] === " ";
    const markerLength = headingMatch[1].length + (hasSpaceAfter ? 1 : 0);
    const from = lineFrom + markerIndex;
    const to = from + markerLength;
    builder.add(from, to, headingDecoration);
  }

  const listMatch = lineText.match(blockMarkerPattern.list);
  if (listMatch) {
    const markerIndex = lineText.indexOf(listMatch[1]);
    const from = lineFrom + markerIndex;
    const to = from + listMatch[1].length;
    builder.add(from, to, blockDecoration);
  }

  const quoteMatch = lineText.match(blockMarkerPattern.quote);
  if (quoteMatch) {
    const markerIndex = lineText.indexOf(quoteMatch[1]);
    const from = lineFrom + markerIndex;
    const to = from + quoteMatch[1].length;
    builder.add(from, to, blockDecoration);
  }
}

export function resolveBlockRevealRange(view: EditorView, options: LivePreviewOptions): Range {
  const line = view.state.doc.lineAt(view.state.selection.main.head);

  if (options.blockRevealMode !== "block") {
    return { from: line.from, to: line.to };
  }

  const resolved = syntaxTree(view.state).resolve(line.from, -1);
  let current: typeof resolved | null = resolved;
  while (current) {
    if (hasNodeName(BLOCK_NODE_NAMES, current.name)) {
      return { from: current.from, to: current.to };
    }
    current = current.parent;
  }

  return { from: line.from, to: line.to };
}
