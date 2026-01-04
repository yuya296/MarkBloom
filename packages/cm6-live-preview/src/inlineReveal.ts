import { syntaxTree } from "@codemirror/language";
import type { EditorView } from "@codemirror/view";
import type { LivePreviewOptions } from "./index";

export function collectInlineRevealPositions(
  view: EditorView,
  options: LivePreviewOptions
): Set<number> {
  const positions = new Set<number>();
  const selectionHead = view.state.selection.main.head;
  const inlineRadius = options.inlineRadius ?? 1;
  const inlineRadiusBefore = options.inlineRadiusBefore ?? inlineRadius;
  const inlineRadiusAfter = options.inlineRadiusAfter ?? inlineRadius;
  const tree = syntaxTree(view.state);
  const candidates = [tree.resolve(selectionHead, -1), tree.resolve(selectionHead, 1)];
  const inlineContainerNames = new Set([
    "Emphasis",
    "StrongEmphasis",
    "Link",
    "Image",
    "InlineCode",
    "Strikethrough",
  ]);
  const inlineMarkNames = new Set([
    "EmphasisMark",
    "LinkMark",
    "CodeMark",
    "StrikethroughMark",
  ]);

  const selectionLine = view.state.doc.lineAt(selectionHead);

  for (const candidate of candidates) {
    let current: typeof candidate | null = candidate;
    while (current) {
      if (inlineContainerNames.has(current.name)) {
        if (options.exclude?.code !== false && current.name === "InlineCode") {
          // Allow marker visibility but avoid hiding inline code content elsewhere.
        }

        const nodeLine = view.state.doc.lineAt(current.from);
        if (nodeLine.number !== selectionLine.number) {
          break;
        }

        const isWithin = selectionHead >= current.from && selectionHead <= current.to;
        const isBefore =
          selectionHead < current.from &&
          current.from - selectionHead <= inlineRadiusAfter &&
          !selectionLine.text
            .slice(selectionHead - selectionLine.from, current.from - selectionLine.from)
            .match(/\s/u);
        const isAfter =
          selectionHead > current.to &&
          selectionHead - current.to <= inlineRadiusBefore &&
          !selectionLine.text
            .slice(current.to - selectionLine.from, selectionHead - selectionLine.from)
            .match(/\s/u);

        if (isWithin || isBefore || isAfter) {
          tree.iterate({
            from: current.from,
            to: current.to,
            enter: (node) => {
              if (!inlineMarkNames.has(node.name)) {
                return;
              }
              for (let pos = node.from; pos < node.to; pos += 1) {
                positions.add(pos);
              }
            },
          });
        }

        break;
      }
      current = current.parent;
    }
  }

  return positions;
}
