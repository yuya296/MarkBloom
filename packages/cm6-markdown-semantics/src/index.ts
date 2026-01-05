import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder, type Extension } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";

export type MarkdownSemanticsOptions = {
  classPrefix?: string;
};

type SemanticRule = {
  nodeNames: readonly string[];
  className: string;
};

function buildRules(prefix: string): SemanticRule[] {
  return [
    { nodeNames: ["ATXHeading1", "SetextHeading1"], className: `${prefix}heading-1` },
    { nodeNames: ["ATXHeading2", "SetextHeading2"], className: `${prefix}heading-2` },
    { nodeNames: ["ATXHeading3"], className: `${prefix}heading-3` },
    { nodeNames: ["ATXHeading4"], className: `${prefix}heading-4` },
    { nodeNames: ["ATXHeading5"], className: `${prefix}heading-5` },
    { nodeNames: ["ATXHeading6"], className: `${prefix}heading-6` },
    { nodeNames: ["StrongEmphasis"], className: `${prefix}strong` },
    { nodeNames: ["Emphasis"], className: `${prefix}em` },
    { nodeNames: ["Link"], className: `${prefix}link` },
    { nodeNames: ["InlineCode"], className: `${prefix}code` },
    { nodeNames: ["ListItem"], className: `${prefix}list-item` },
    { nodeNames: ["Blockquote"], className: `${prefix}blockquote` },
    { nodeNames: ["FencedCode", "CodeBlock"], className: `${prefix}code-block` },
  ];
}

function buildDecorations(view: EditorView, prefix: string): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const rules = buildRules(prefix);
  const rulesByName = new Map<string, string>();
  for (const rule of rules) {
    for (const name of rule.nodeNames) {
      rulesByName.set(name, rule.className);
    }
  }

  syntaxTree(view.state).iterate({
    enter: (node) => {
      const className = rulesByName.get(node.name);
      if (!className) {
        return;
      }
      if (node.from < node.to) {
        builder.add(node.from, node.to, Decoration.mark({ class: className }));
      }
    },
  });

  return builder.finish();
}

export function markdownSemantics(options: MarkdownSemanticsOptions = {}): Extension {
  const prefix = options.classPrefix ?? "mb-";

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view, prefix);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildDecorations(update.view, prefix);
        }
      }
    },
    {
      decorations: (view) => view.decorations,
    }
  );
}
