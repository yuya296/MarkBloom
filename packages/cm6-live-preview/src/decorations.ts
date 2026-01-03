import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import type { LivePreviewOptions } from "./index";

type Range = { from: number; to: number };

type ExcludeRanges = {
  block: Range[];
  inline: Range[];
};

const blockMarkerPattern = {
  heading: /^\s{0,3}(#{1,6})(?=\s|$)/,
  list: /^\s{0,3}([*+-]|\d+\.)(?=\s)/,
  quote: /^\s{0,3}(>)(?=\s?)/,
};

const inlineMarkers = new Set(["*", "_", "[", "]", "(", ")", "`"]);

function inRanges(pos: number, ranges: Range[]): boolean {
  for (const range of ranges) {
    if (pos >= range.from && pos < range.to) {
      return true;
    }
  }
  return false;
}

function overlapsRange(from: number, to: number, ranges: Range[]): boolean {
  for (const range of ranges) {
    if (from < range.to && to > range.from) {
      return true;
    }
  }
  return false;
}

function collectExcludedRanges(view: EditorView, options: LivePreviewOptions): ExcludeRanges {
  const block: Range[] = [];
  const inline: Range[] = [];

  if (options.exclude?.code === false) {
    return { block, inline };
  }

  const blockNames = new Set(["FencedCode", "CodeBlock"]);
  const inlineNames = new Set(["InlineCode", "CodeText"]);

  syntaxTree(view.state).iterate({
    enter: (node) => {
      if (blockNames.has(node.name)) {
        block.push({ from: node.from, to: node.to });
      }
      if (inlineNames.has(node.name)) {
        inline.push({ from: node.from, to: node.to });
      }
    },
  });

  return { block, inline };
}

function addBlockMarkerDecorations(
  builder: RangeSetBuilder<Decoration>,
  lineFrom: number,
  lineText: string,
  decoration: Decoration
) {
  const headingMatch = lineText.match(blockMarkerPattern.heading);
  if (headingMatch) {
    const markerIndex = lineText.indexOf(headingMatch[1]);
    const from = lineFrom + markerIndex;
    const to = from + headingMatch[1].length;
    builder.add(from, to, decoration);
  }

  const listMatch = lineText.match(blockMarkerPattern.list);
  if (listMatch) {
    const markerIndex = lineText.indexOf(listMatch[1]);
    const from = lineFrom + markerIndex;
    const to = from + listMatch[1].length;
    builder.add(from, to, decoration);
  }

  const quoteMatch = lineText.match(blockMarkerPattern.quote);
  if (quoteMatch) {
    const markerIndex = lineText.indexOf(quoteMatch[1]);
    const from = lineFrom + markerIndex;
    const to = from + quoteMatch[1].length;
    builder.add(from, to, decoration);
  }
}

function addInlineMarkerDecorations(
  builder: RangeSetBuilder<Decoration>,
  lineFrom: number,
  lineText: string,
  inlineRevealFrom: number,
  inlineRevealTo: number,
  excluded: ExcludeRanges,
  decoration: Decoration
) {
  for (let offset = 0; offset < lineText.length; offset += 1) {
    const ch = lineText[offset];
    if (!inlineMarkers.has(ch)) {
      continue;
    }

    const pos = lineFrom + offset;

    if (pos >= inlineRevealFrom && pos <= inlineRevealTo) {
      continue;
    }

    if (inRanges(pos, excluded.block) || inRanges(pos, excluded.inline)) {
      continue;
    }

    builder.add(pos, pos + 1, decoration);
  }
}

function resolveBlockRevealRange(view: EditorView, options: LivePreviewOptions): Range {
  const line = view.state.doc.lineAt(view.state.selection.main.head);

  if (options.blockRevealMode !== "block") {
    return { from: line.from, to: line.to };
  }

  const blockNodeNames = new Set([
    "Blockquote",
    "BulletList",
    "OrderedList",
    "ListItem",
    "ATXHeading1",
    "ATXHeading2",
    "ATXHeading3",
    "ATXHeading4",
    "ATXHeading5",
    "ATXHeading6",
    "SetextHeading1",
    "SetextHeading2",
  ]);

  const resolved = syntaxTree(view.state).resolve(line.from, -1);
  let current = resolved;
  while (current) {
    if (blockNodeNames.has(current.name)) {
      return { from: current.from, to: current.to };
    }
    current = current.parent;
  }

  return { from: line.from, to: line.to };
}

export function buildDecorations(view: EditorView, options: LivePreviewOptions): DecorationSet {
  if (options.disableDuringIME && view.composing) {
    return Decoration.none;
  }

  const builder = new RangeSetBuilder<Decoration>();
  const blockReveal = resolveBlockRevealRange(view, options);
  const inlineRadius = options.inlineRadius ?? 6;
  const selectionHead = view.state.selection.main.head;
  const inlineRevealFrom = Math.max(0, selectionHead - inlineRadius);
  const inlineRevealTo = Math.min(view.state.doc.length, selectionHead + inlineRadius);
  const excluded = collectExcludedRanges(view, options);

  const blockDecoration = Decoration.mark({
    class:
      options.blockStyle === "hide"
        ? "cm-live-preview-block-hide"
        : "cm-live-preview-block-dim",
  });

  const inlineDecoration = Decoration.mark({
    class:
      options.inlineStyle === "hide"
        ? "cm-live-preview-inline-hide"
        : "cm-live-preview-inline-dim",
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
        addBlockMarkerDecorations(builder, line.from, line.text, blockDecoration);
      }

      addInlineMarkerDecorations(
        builder,
        line.from,
        line.text,
        inlineRevealFrom,
        inlineRevealTo,
        excluded,
        inlineDecoration
      );

      pos = line.to + 1;
    }
  }

  return builder.finish();
}
