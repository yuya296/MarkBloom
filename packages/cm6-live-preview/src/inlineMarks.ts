import { syntaxTree } from "@codemirror/language";
import type { EditorView } from "@codemirror/view";
import type { ExcludeRanges, InlineMarkRanges } from "./types";
import { inRangeSegment } from "./utils";
import { NodeName } from "./syntaxNodeNames";

export function collectInlineMarkRanges(
  view: EditorView,
  excluded: ExcludeRanges
): InlineMarkRanges {
  const codeMarks: InlineMarkRanges["codeMarks"] = [];
  const emphasisMarks: InlineMarkRanges["emphasisMarks"] = [];
  const strikethroughMarks: InlineMarkRanges["strikethroughMarks"] = [];

  syntaxTree(view.state).iterate({
    enter: (node) => {
      if (inRangeSegment(node.from, node.to, excluded.block)) {
        return;
      }

      if (node.name === NodeName.CodeMark) {
        codeMarks.push({ from: node.from, to: node.to });
        return;
      }

      if (node.name === NodeName.EmphasisMark) {
        emphasisMarks.push({ from: node.from, to: node.to });
        return;
      }

      if (node.name === NodeName.StrikethroughMark) {
        strikethroughMarks.push({ from: node.from, to: node.to });
      }
    },
  });

  return { codeMarks, emphasisMarks, strikethroughMarks };
}
