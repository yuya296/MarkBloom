import { Decoration } from "@codemirror/view";
import type {
  LivePreviewPlugin,
} from "@yuya296/cm6-live-preview-core";
import {
  mermaidBlockReplace,
  mermaidBlockWidget,
  type MermaidThemeMode,
} from "./mermaidWidget";
import { collectMermaidBlocksFromState } from "./blocks";
import { isCursorAtBottomBoundary } from "./navigationLogic";

export type MermaidLivePreviewPluginOptions = {
  className?: string;
  errorClassName?: string;
  mermaidTheme?: MermaidThemeMode;
};

export function mermaidLivePreviewPlugin(
  options: MermaidLivePreviewPluginOptions = {}
): LivePreviewPlugin {
  const className = options.className ?? "cm-lp-mermaid";
  const errorClassName = options.errorClassName ?? "cm-lp-mermaid-error";
  const mermaidTheme = options.mermaidTheme ?? "auto";

  return {
    name: "mermaid-live-preview",
    decorate(ctx) {
      const blocks = collectMermaidBlocksFromState(ctx.state);
      const decorations = [];
      const cursorHeads = ctx.state.selection.ranges
        .filter((range) => range.from === range.to)
        .map((range) => range.head);

      for (const block of blocks) {
        const isRaw =
          ctx.isSelectionOverlap(block.rawJudgeRange) ||
          ctx.isBlockRevealOverlap(block.rawJudgeRange) ||
          cursorHeads.some((head) => isCursorAtBottomBoundary(head, block));
        if (isRaw) {
          decorations.push({
            from: block.replaceRange.to,
            to: block.replaceRange.to,
            decoration: mermaidBlockWidget(block.source, {
              className,
              errorClassName,
              mermaidTheme,
            }),
          });
          continue;
        }

        decorations.push({
          from: block.replaceRange.from,
          to: block.replaceRange.to,
          decoration: mermaidBlockReplace(block.source, {
            className,
            errorClassName,
            mermaidTheme,
          }),
        });
        decorations.push({
          from: block.openingLineFrom,
          to: block.openingLineFrom,
          decoration: Decoration.line({ class: "cm-lp-mermaid-fence-line-mask" }),
        });
      }

      return decorations;
    },
  };
}
