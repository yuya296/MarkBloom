import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder, type Extension } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";

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
    { nodeNames: ["Table"], className: `${prefix}table`, applyToLine: true },
    { nodeNames: ["HTMLBlock"], className: `${prefix}html-block`, applyToLine: true },
    { nodeNames: ["FootnoteDefinition"], className: `${prefix}footnote-definition`, applyToLine: true },
    { nodeNames: ["FootnoteReference"], className: `${prefix}footnote-ref` },
  ];
}

function addLineClassesForNode(
  view: EditorView,
  from: number,
  to: number,
  classNames: readonly string[],
  lineClasses: Map<number, Set<string>>
) {
  if (from >= to) {
    return;
  }
  const startLine = view.state.doc.lineAt(from);
  const endLine = view.state.doc.lineAt(to);
  for (let lineNumber = startLine.number; lineNumber <= endLine.number; lineNumber += 1) {
    const line = view.state.doc.line(lineNumber);
    let set = lineClasses.get(line.from);
    if (!set) {
      set = new Set<string>();
      lineClasses.set(line.from, set);
    }
    for (const className of classNames) {
      set.add(className);
    }
  }
}

function addLineClass(lineFrom: number, className: string, lineClasses: Map<number, Set<string>>) {
  let set = lineClasses.get(lineFrom);
  if (!set) {
    set = new Set<string>();
    lineClasses.set(lineFrom, set);
  }
  set.add(className);
}

function addCodeBlockClasses(
  view: EditorView,
  from: number,
  to: number,
  prefix: string,
  lineClasses: Map<number, Set<string>>
) {
  if (from >= to) {
    return;
  }
  const startLine = view.state.doc.lineAt(from);
  const endLine = view.state.doc.lineAt(to);
  addLineClass(startLine.from, `${prefix}code-block-first`, lineClasses);
  addLineClass(endLine.from, `${prefix}code-block-last`, lineClasses);
  if (startLine.number === endLine.number) {
    return;
  }
  for (let lineNumber = startLine.number + 1; lineNumber <= endLine.number - 1; lineNumber += 1) {
    const line = view.state.doc.line(lineNumber);
    addLineClass(line.from, `${prefix}code-block-middle`, lineClasses);
  }
}

function addLineLevelForNode(
  view: EditorView,
  from: number,
  to: number,
  level: number,
  lineLevels: Map<number, number>
) {
  if (from >= to) {
    return;
  }
  const startLine = view.state.doc.lineAt(from);
  const endLine = view.state.doc.lineAt(to);
  for (let lineNumber = startLine.number; lineNumber <= endLine.number; lineNumber += 1) {
    const line = view.state.doc.line(lineNumber);
    const current = lineLevels.get(line.from) ?? 0;
    if (level > current) {
      lineLevels.set(line.from, level);
    }
  }
}

function getListLevel(node: SyntaxNode): number {
  let level = 0;
  for (let current = node.parent; current; current = current.parent) {
    if (current.name === "BulletList" || current.name === "OrderedList") {
      level += 1;
    }
  }
  return level;
}

function getBlockquoteLevel(node: SyntaxNode): number {
  let level = 0;
  for (let current: SyntaxNode | null = node; current; current = current.parent) {
    if (current.name === "Blockquote") {
      level += 1;
    }
  }
  return level;
}

function getTaskStateClass(view: EditorView, from: number, to: number, prefix: string): string | null {
  const sample = view.state.doc.sliceString(from, Math.min(to, from + 6));
  const match = sample.match(/^\[( |x|X)\]/);
  if (!match) {
    return null;
  }
  return match[1].toLowerCase() === "x" ? `${prefix}task-checked` : `${prefix}task-unchecked`;
}

function buildDecorations(view: EditorView, prefix: string): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const pending: Array<{ from: number; to: number; decoration: Decoration }> = [];
  const lineClasses = new Map<number, Set<string>>();
  const lineBlockquoteLevels = new Map<number, number>();
  const rules = buildRules(prefix);
  const rulesByName = new Map<string, SemanticRule>();
  for (const rule of rules) {
    for (const name of rule.nodeNames) {
      rulesByName.set(name, rule);
    }
  }

  syntaxTree(view.state).iterate({
    enter: (node) => {
      if (node.from >= node.to) {
        return;
      }

      const lineClassNames: string[] = [];
      const rule = rulesByName.get(node.name);
      if (rule) {
        if (rule.applyToLine) {
          lineClassNames.push(rule.className);
        } else {
          pending.push({
            from: node.from,
            to: node.to,
            decoration: Decoration.mark({ class: rule.className }),
          });
        }
      }

      if (node.name === "ListItem") {
        const level = getListLevel(node.node);
        if (level > 0) {
          lineClassNames.push(`${prefix}list-item-level-${level}`);
        }
      }

      if (node.name === "Blockquote") {
        const level = getBlockquoteLevel(node.node);
        if (level > 0) {
          addLineLevelForNode(view, node.from, node.to, level, lineBlockquoteLevels);
        }
      }

      if (node.name === "Task") {
        const stateClass = getTaskStateClass(view, node.from, node.to, prefix);
        if (stateClass) {
          lineClassNames.push(stateClass);
        }
      }

      if (node.name === "FencedCode" || node.name === "CodeBlock") {
        addCodeBlockClasses(view, node.from, node.to, prefix, lineClasses);
      }

      if (lineClassNames.length > 0) {
        addLineClassesForNode(view, node.from, node.to, lineClassNames, lineClasses);
      }
    },
  });

  for (const [lineFrom, level] of lineBlockquoteLevels) {
    let classSet = lineClasses.get(lineFrom);
    if (!classSet) {
      classSet = new Set<string>();
      lineClasses.set(lineFrom, classSet);
    }
    classSet.add(`${prefix}blockquote-level-${level}`);
  }

  for (const [lineFrom, classSet] of lineClasses) {
    pending.push({
      from: lineFrom,
      to: lineFrom,
      decoration: Decoration.line({ class: Array.from(classSet).join(" ") }),
    });
  }

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
