import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { createBaseExtensions } from "./editor/baseExtensions";

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
  const state = EditorState.create({
    doc: initialText,
    extensions: createBaseExtensions({
      dynamicCompartment: dynamicExtensions,
      dynamicExtensions: extensions,
      onChange,
    }),
  });

  const view = new EditorView({ state, parent });

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
