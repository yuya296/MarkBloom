import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import type { ExcludeRanges } from "./types";
import type { LivePreviewOptions } from "../options";

export function collectExcludedRanges(
  state: EditorState,
  options: LivePreviewOptions
): ExcludeRanges {
  const block: ExcludeRanges["block"] = [];
  const inline: ExcludeRanges["inline"] = [];

  if (options.exclude?.code === false) {
    return { block, inline };
  }

  const blockNames = new Set(["FencedCode", "CodeBlock"]);
  const inlineNames = new Set(["CodeText"]);

  syntaxTree(state).iterate({
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
