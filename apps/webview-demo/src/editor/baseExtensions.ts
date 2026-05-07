import { Compartment, Prec, type Extension } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { EditorView, keymap } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { GFM, Strikethrough } from "@lezer/markdown";
import {
  getDefaultSmartBolShortcuts,
  markdownSmartBol,
} from "@yuya296/cm6-markdown-smart-bol";
import { linkClickHandler } from "./linkClickHandler";

export type BaseExtensionsOptions = {
  dynamicCompartment: Compartment;
  dynamicExtensions: Extension[];
  onChange?: (text: string) => void;
};

export function createBaseExtensions(opts: BaseExtensionsOptions): Extension[] {
  return [
    linkClickHandler(),
    history({
      newGroupDelay: 1500,
      joinToEvent: (tr, isAdjacent) => isAdjacent || tr.docChanged,
    }),
    Prec.high(markdownSmartBol({ shortcuts: getDefaultSmartBolShortcuts() })),
    keymap.of([...historyKeymap, ...defaultKeymap]),
    markdown({
      extensions: [Strikethrough, GFM],
      codeLanguages: languages,
    }),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        opts.onChange?.(update.state.doc.toString());
      }
    }),
    opts.dynamicCompartment.of(opts.dynamicExtensions),
  ];
}
