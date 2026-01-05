import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

export type TypographyThemeOptions = {
  classPrefix?: string;
};

export function typographyTheme(options: TypographyThemeOptions = {}): Extension {
  const prefix = options.classPrefix ?? "mb-";

  return EditorView.theme({
    [`.${prefix}heading-1`]: {
      fontSize: "1.6em",
      fontWeight: "700",
      lineHeight: "1.2",
    },
    [`.${prefix}heading-2`]: {
      fontSize: "1.4em",
      fontWeight: "700",
      lineHeight: "1.25",
    },
    [`.${prefix}heading-3`]: {
      fontSize: "1.25em",
      fontWeight: "650",
      lineHeight: "1.3",
    },
    [`.${prefix}heading-4`]: {
      fontSize: "1.15em",
      fontWeight: "650",
      lineHeight: "1.35",
    },
    [`.${prefix}heading-5`]: {
      fontSize: "1.05em",
      fontWeight: "600",
    },
    [`.${prefix}heading-6`]: {
      fontSize: "1em",
      fontWeight: "600",
      opacity: "0.9",
    },
    [`.${prefix}strong`]: {
      fontWeight: "700",
    },
    [`.${prefix}em`]: {
      fontStyle: "italic",
    },
    [`.${prefix}link`]: {
      textDecoration: "underline",
    },
    [`.${prefix}code`]: {
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: "0.95em",
    },
    [`.${prefix}blockquote`]: {
      fontStyle: "italic",
    },
    [`.${prefix}list-item`]: {
      paddingLeft: "0.1rem",
    },
  });
}
