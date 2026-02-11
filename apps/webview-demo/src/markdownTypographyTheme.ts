import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";

const highlightStyle = HighlightStyle.define([
  { tag: tags.heading1, class: "cm-heading-1" },
  { tag: tags.heading2, class: "cm-heading-2" },
  { tag: tags.heading3, class: "cm-heading-3" },
  { tag: tags.heading4, class: "cm-heading-4" },
  { tag: tags.heading5, class: "cm-heading-5" },
  { tag: tags.heading6, class: "cm-heading-6" },
  { tag: tags.strong, class: "cm-strong" },
  { tag: tags.emphasis, class: "cm-emphasis" },
  { tag: tags.strikethrough, class: "cm-strikethrough" },
  { tag: tags.link, class: "cm-link" },
  { tag: tags.quote, class: "cm-quote" },
  { tag: tags.monospace, class: "cm-inline-code" },
]);

const typographyTheme = EditorView.theme({
  ".cm-heading-1": {
    fontSize: "1.6em",
    fontWeight: "700",
  },
  ".cm-heading-2": {
    fontSize: "1.4em",
    fontWeight: "700",
  },
  ".cm-heading-3": {
    fontSize: "1.25em",
    fontWeight: "700",
  },
  ".cm-heading-4": {
    fontSize: "1.1em",
    fontWeight: "600",
  },
  ".cm-heading-5": {
    fontSize: "1.05em",
    fontWeight: "600",
  },
  ".cm-heading-6": {
    fontSize: "1em",
    fontWeight: "600",
  },
  ".cm-strong": {
    fontWeight: "700",
  },
  ".cm-emphasis": {
    fontStyle: "italic",
  },
  ".cm-strikethrough": {
    textDecoration: "line-through",
  },
  ".cm-link": {
    color: "var(--editor-primary-color, #0f5b9e)",
    textDecoration: "underline",
  },
  ".cm-quote": {
    color: "#5b4b3c",
    fontStyle: "italic",
  },
  ".cm-inline-code": {
    fontFamily: "\"IBM Plex Mono\", \"SF Mono\", ui-monospace, monospace",
    backgroundColor: "rgba(15, 91, 158, 0.08)",
    borderRadius: "4px",
    padding: "0 4px",
  },
});

export function markdownTypographyTheme(): Extension {
  return [typographyTheme, syntaxHighlighting(highlightStyle)];
}
