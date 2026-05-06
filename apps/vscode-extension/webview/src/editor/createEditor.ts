import { EditorState, Compartment, Extension, Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { GFM, Strikethrough } from "@lezer/markdown";
import { findHeadingLineForId } from "@yuya296/cm6-live-preview";
import {
  getDefaultSmartBolShortcuts,
  markdownSmartBol,
} from "@yuya296/cm6-markdown-smart-bol";

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
    EditorView.domEventHandlers({
      click: (event) => {
        if (!(event.target instanceof Element)) {
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
          const targetLine = findHeadingLineForId(view.state.doc, targetId);
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
    Prec.high(markdownSmartBol({ shortcuts: getDefaultSmartBolShortcuts() })),
    keymap.of(defaultKeymap),
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
