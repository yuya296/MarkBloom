import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

export type TypographyThemeOptions = {
  classPrefix?: string;
};

export function typographyTheme(options: TypographyThemeOptions = {}): Extension {
  const prefix = options.classPrefix ?? "mb-";
  const scope = ".cm-content";

  return EditorView.theme({
    [`${scope} .${prefix}heading-1`]: {
      fontSize: "1.6em",
      fontWeight: "700",
      lineHeight: "1.2",
    },
    [`${scope} .${prefix}heading-2`]: {
      fontSize: "1.4em",
      fontWeight: "700",
      lineHeight: "1.25",
    },
    [`${scope} .${prefix}heading-3`]: {
      fontSize: "1.25em",
      fontWeight: "650",
      lineHeight: "1.3",
    },
    [`${scope} .${prefix}heading-4`]: {
      fontSize: "1.15em",
      fontWeight: "650",
      lineHeight: "1.35",
    },
    [`${scope} .${prefix}heading-5`]: {
      fontSize: "1.05em",
      fontWeight: "600",
    },
    [`${scope} .${prefix}heading-6`]: {
      fontSize: "1em",
      fontWeight: "600",
      opacity: "0.9",
    },
    [`${scope} .${prefix}strong`]: {
      fontWeight: "700",
    },
    [`${scope} .${prefix}em`]: {
      fontStyle: "italic",
    },
    [`${scope} .${prefix}link`]: {
      textDecoration: "underline",
    },
    [`${scope} .${prefix}code`]: {
      fontFamily:
        "var(--mb-font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace)",
      fontSize: "var(--mb-inline-code-size, 0.95em)",
    },
    [`${scope} .${prefix}blockquote`]: {
      borderLeft: "3px solid var(--mb-quote-border-color, currentColor)",
      paddingLeft: "0.75rem",
      marginLeft: "0",
      opacity: "var(--mb-quote-opacity, 0.85)",
      lineHeight: "inherit",
      fontStyle: "var(--mb-quote-font-style, normal)",
    },
    [`${scope} .${prefix}list-item`]: {
      paddingLeft: "0.1rem",
    },
  });
}
