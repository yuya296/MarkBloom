import { EditorState, Compartment, Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { GFM, Strikethrough } from "@lezer/markdown";

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

  const baseExtensions = [
    keymap.of(defaultKeymap),
    markdown({ extensions: [Strikethrough, GFM] }),
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
