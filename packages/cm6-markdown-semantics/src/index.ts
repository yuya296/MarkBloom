import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder, type Extension } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";

export type MarkdownSemanticsOptions = {
  classPrefix?: string;
};

type SemanticRule = {
  nodeNames: readonly string[];
  className: string;
  applyToLine?: boolean;
};

function buildRules(prefix: string): SemanticRule[] {
  return [
    {
      nodeNames: ["ATXHeading1", "SetextHeading1"],
      className: `${prefix}heading-1`,
      applyToLine: true,
    },
    {
      nodeNames: ["ATXHeading2", "SetextHeading2"],
      className: `${prefix}heading-2`,
      applyToLine: true,
    },
    { nodeNames: ["ATXHeading3"], className: `${prefix}heading-3`, applyToLine: true },
    { nodeNames: ["ATXHeading4"], className: `${prefix}heading-4`, applyToLine: true },
    { nodeNames: ["ATXHeading5"], className: `${prefix}heading-5`, applyToLine: true },
    { nodeNames: ["ATXHeading6"], className: `${prefix}heading-6`, applyToLine: true },
    { nodeNames: ["StrongEmphasis"], className: `${prefix}strong` },
    { nodeNames: ["Emphasis"], className: `${prefix}em` },
    { nodeNames: ["Link"], className: `${prefix}link` },
    { nodeNames: ["InlineCode"], className: `${prefix}code` },
    { nodeNames: ["ListItem"], className: `${prefix}list-item`, applyToLine: true },
    { nodeNames: ["Blockquote"], className: `${prefix}blockquote`, applyToLine: true },
    { nodeNames: ["FencedCode", "CodeBlock"], className: `${prefix}code-block`, applyToLine: true },
  ];
}

function buildDecorations(view: EditorView, prefix: string): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const pending: Array<{ from: number; to: number; decoration: Decoration }> = [];
  const rules = buildRules(prefix);
  const rulesByName = new Map<string, SemanticRule>();
  for (const rule of rules) {
    for (const name of rule.nodeNames) {
      rulesByName.set(name, rule);
    }
  }

  syntaxTree(view.state).iterate({
    enter: (node) => {
      const rule = rulesByName.get(node.name);
      if (!rule) {
        return;
      }
      if (node.from >= node.to) {
        return;
      }

      if (rule.applyToLine) {
        const startLine = view.state.doc.lineAt(node.from);
        const endLine = view.state.doc.lineAt(node.to);
        for (let lineNumber = startLine.number; lineNumber <= endLine.number; lineNumber += 1) {
          const line = view.state.doc.line(lineNumber);
          pending.push({
            from: line.from,
            to: line.from,
            decoration: Decoration.line({ class: rule.className }),
          });
        }
        return;
      }

      pending.push({
        from: node.from,
        to: node.to,
        decoration: Decoration.mark({ class: rule.className }),
      });
    },
  });

  pending.sort((a, b) => (a.from === b.from ? a.to - b.to : a.from - b.from));
  for (const item of pending) {
    builder.add(item.from, item.to, item.decoration);
  }

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
      decorations: (plugin) => plugin.decorations,
    }
  );
}
