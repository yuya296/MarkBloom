import { EditorSelection, type Extension } from "@codemirror/state";
import { keymap, type Command } from "@codemirror/view";

export type MarkdownSmartBolOptions = {
  macKey?: string;
};

function getIndentLength(lineText: string): number {
  return lineText.match(/^\s*/u)?.[0].length ?? 0;
}

export function getMarkdownSmartBolOffset(lineText: string): number {
  const headingMatch = lineText.match(/^(\s{0,3})(#{1,6}\s+)/u);
  if (headingMatch) {
    return headingMatch[1].length + headingMatch[2].length;
  }
  return getIndentLength(lineText);
}

function moveToMarkdownSmartBol(view: Parameters<Command>[0], extendSelection: boolean): boolean {
  const ranges = view.state.selection.ranges.map((range) => {
    const line = view.state.doc.lineAt(range.head);
    const target = line.from + getMarkdownSmartBolOffset(line.text);
    const nextHead = range.head === target ? line.from : target;
    return extendSelection
      ? EditorSelection.range(range.anchor, nextHead)
      : EditorSelection.cursor(nextHead);
  });

  view.dispatch({
    selection: EditorSelection.create(ranges, view.state.selection.mainIndex),
    scrollIntoView: true,
  });

  return true;
}

export function markdownSmartBol(options: MarkdownSmartBolOptions = {}): Extension {
  const run: Command = (view) => moveToMarkdownSmartBol(view, false);
  const shift: Command = (view) => moveToMarkdownSmartBol(view, true);

  return keymap.of([
    {
      mac: options.macKey ?? "Ctrl-a",
      run,
      shift,
      preventDefault: true,
    },
  ]);
}
