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
      backgroundImage:
        "repeating-linear-gradient(to right, var(--mb-quote-border-color, currentColor) 0 var(--mb-quote-border-width, 3px), transparent var(--mb-quote-border-width, 3px) var(--mb-quote-indent, 0.75rem))",
      backgroundSize:
        "calc(var(--mb-blockquote-level, 1) * var(--mb-quote-indent, 0.75rem)) 100%",
      backgroundPosition: "left top",
      backgroundRepeat: "no-repeat",
      paddingLeft:
        "calc(var(--mb-blockquote-level, 1) * var(--mb-quote-indent, 0.75rem) - var(--mb-quote-border-width, 3px))",
      marginLeft: "0",
      opacity: "var(--mb-quote-opacity, 0.85)",
      lineHeight: "inherit",
      fontStyle: "var(--mb-quote-font-style, normal)",
    },
    [`${scope} .${prefix}list-item`]: {
      paddingLeft: "0",
    },
    [`${scope} .${prefix}blockquote.${prefix}list-item`]: {
      paddingLeft:
        "calc(var(--mb-blockquote-level, 1) * var(--mb-quote-indent, 0.75rem) - var(--mb-quote-border-width, 3px))",
    },
    [`${scope} .${prefix}blockquote-level-1`]: { "--mb-blockquote-level": "1" },
    [`${scope} .${prefix}blockquote-level-2`]: { "--mb-blockquote-level": "2" },
    [`${scope} .${prefix}blockquote-level-3`]: { "--mb-blockquote-level": "3" },
    [`${scope} .${prefix}blockquote-level-4`]: { "--mb-blockquote-level": "4" },
    [`${scope} .${prefix}blockquote-level-5`]: { "--mb-blockquote-level": "5" },
    [`${scope} .${prefix}blockquote-level-6`]: { "--mb-blockquote-level": "6" },
    [`${scope} .${prefix}list-item-level-1`]: { "--mb-list-level": "1" },
    [`${scope} .${prefix}list-item-level-2`]: { "--mb-list-level": "2" },
    [`${scope} .${prefix}list-item-level-3`]: { "--mb-list-level": "3" },
    [`${scope} .${prefix}list-item-level-4`]: { "--mb-list-level": "4" },
    [`${scope} .${prefix}list-item-level-5`]: { "--mb-list-level": "5" },
    [`${scope} .${prefix}list-item-level-6`]: { "--mb-list-level": "6" },
  });
}
