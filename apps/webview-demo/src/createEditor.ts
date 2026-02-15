import { EditorSelection, EditorState, Compartment, Extension } from "@codemirror/state";
import { EditorView, keymap, type Command } from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
} from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { GFM, Strikethrough } from "@lezer/markdown";
import {
  getRichLineStartOffset,
  richLineStartBinding,
} from "../../shared/src/richLineStartKeymap";

export type CreateEditorOptions = {
  parent: HTMLElement;
  initialText?: string;
  extensions?: Extension[];
  onChange?: (text: string) => void;
};

export type EditorHandle = {
  view: EditorView;
  getText: () => string;
  setExtensions: (nextExtensions?: Extension[]) => void;
  destroy: () => void;
};

function slugifyHeading(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function findHeadingLineForId(view: EditorView, targetId: string) {
  const used = new Map<string, number>();
  for (let i = 1; i <= view.state.doc.lines; i += 1) {
    const line = view.state.doc.line(i);
    const match = line.text.match(/^\s{0,3}#{1,6}\s+(.+)$/);
    if (!match) {
      continue;
    }
    const headingText = match[1].replace(/\s+#*\s*$/, "");
    const base = slugifyHeading(headingText);
    if (!base) {
      continue;
    }
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count}`;
    if (id === targetId) {
      return line;
    }
  }
  return null;
}

function moveToRichLineStart(view: EditorView, extendSelection: boolean): boolean {
  const ranges = view.state.selection.ranges.map((range) => {
    const line = view.state.doc.lineAt(range.head);
    const target = line.from + getRichLineStartOffset(line.text);
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

export function createEditor({
  parent,
  initialText = "",
  extensions = [],
  onChange,
}: CreateEditorOptions): EditorHandle {
  if (!parent) {
    throw new Error("createEditor: parent is required");
  }

  const dynamicExtensions = new Compartment();
  const cursorRichLineStart: Command = (view) => moveToRichLineStart(view, false);
  const selectRichLineStart: Command = (view) => moveToRichLineStart(view, true);
  const richLineStartKeymap = [
    {
      ...richLineStartBinding,
      run: cursorRichLineStart,
      shift: selectRichLineStart,
    },
  ];
  const baseExtensions = [
    EditorView.domEventHandlers({
      click: (event) => {
        if (!(event.target instanceof HTMLElement)) {
          return false;
        }
        const link = event.target.closest(".mb-link[data-href]");
        if (!(link instanceof HTMLElement)) {
          return false;
        }
        const href = link.dataset.href;
        if (!href) {
          return false;
        }
        const view = EditorView.findFromDOM(event.target);
        if (!view) {
          return false;
        }
        if (href.startsWith("#")) {
          event.preventDefault();
          event.stopPropagation();
          const targetId = decodeURIComponent(href.slice(1));
          const targetLine = findHeadingLineForId(view, targetId);
          if (targetLine) {
            view.dispatch({
              selection: { anchor: targetLine.from },
              scrollIntoView: true,
            });
            return true;
          }
          return false;
        }

        event.preventDefault();
        event.stopPropagation();
        window.open(href, "_blank", "noopener,noreferrer");
        return true;
      },
    }),
    history({
      newGroupDelay: 1500,
      joinToEvent: (tr, isAdjacent) => {
        return isAdjacent || tr.docChanged;
      },
    }),
    keymap.of([...richLineStartKeymap, ...historyKeymap, ...defaultKeymap]),
    markdown({
      extensions: [Strikethrough, GFM],
      codeLanguages: languages,
    }),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange?.(update.state.doc.toString());
      }
    }),
    dynamicExtensions.of(extensions),
  ];

  const state = EditorState.create({
    doc: initialText,
    extensions: baseExtensions,
  });

  const view = new EditorView({
    state,
    parent,
  });

  return {
    view,
    getText: () => view.state.doc.toString(),
    setExtensions(nextExtensions: Extension[] = []) {
      view.dispatch({
        effects: dynamicExtensions.reconfigure(nextExtensions),
      });
    },
    destroy() {
      view.destroy();
    },
  };
}
