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
      display: "block",
      width: "100%",
      borderBottom: "1px solid #d0d0d0",
      paddingBottom: "0.5rem",
      marginBottom: "0",
    },
    [`${scope} .${prefix}heading-2`]: {
      fontSize: "1.4em",
      fontWeight: "700",
      lineHeight: "1.25",
      display: "block",
      width: "100%",
      borderBottom: "1px solid #d0d0d0",
      paddingBottom: "0.5rem",
      marginBottom: "0",
    },
    [`${scope} .${prefix}heading-3`]: {
      fontSize: "1.25em",
      fontWeight: "650",
      lineHeight: "1.3",
      display: "block",
      paddingBottom: "0.5rem",
      marginBottom: "0",
    },
    [`${scope} .${prefix}heading-4`]: {
      fontSize: "1.15em",
      fontWeight: "650",
      lineHeight: "1.35",
      display: "block",
      paddingBottom: "0.5rem",
      marginBottom: "0",
    },
    [`${scope} .${prefix}heading-5`]: {
      fontSize: "1.05em",
      fontWeight: "600",
      display: "block",
      paddingBottom: "0.5rem",
      marginBottom: "0",
    },
    [`${scope} .${prefix}heading-6`]: {
      fontSize: "1em",
      fontWeight: "600",
      opacity: "0.9",
      display: "block",
      paddingBottom: "0.5rem",
      marginBottom: "0",
    },
    [`${scope} .${prefix}heading-1,
      ${scope} .${prefix}heading-2,
      ${scope} .${prefix}heading-3,
      ${scope} .${prefix}heading-4,
      ${scope} .${prefix}heading-5,
      ${scope} .${prefix}heading-6`]: {
      textDecoration: "none",
    },
    [`${scope} .${prefix}heading-1 *,
      ${scope} .${prefix}heading-2 *,
      ${scope} .${prefix}heading-3 *,
      ${scope} .${prefix}heading-4 *,
      ${scope} .${prefix}heading-5 *,
      ${scope} .${prefix}heading-6 *`]: {
      textDecoration: "none",
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
      backgroundColor: "var(--mb-inline-code-bg, rgba(0, 0, 0, 0.05))",
      borderRadius: "var(--mb-inline-code-radius, 4px)",
      padding: "0.05em 0.35em",
    },
    [`${scope} .${prefix}code-block`]: {
      backgroundColor: "var(--mb-code-block-bg, #f2f2f2)",
      fontFamily:
        "var(--mb-font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace)",
      position: "relative",
    },
    [`${scope} .${prefix}code-block-fenced`]: {
      backgroundColor: "var(--mb-code-block-bg, #f2f2f2)",
    },
    [`${scope} .${prefix}code-block-indented`]: {
      backgroundColor: "transparent",
      backgroundImage:
        "linear-gradient(to right, transparent 0 var(--mb-code-block-indent, 4ch), var(--mb-code-block-bg, #f2f2f2) var(--mb-code-block-indent, 4ch))",
      backgroundRepeat: "no-repeat",
      backgroundSize: "100% 100%",
    },
    [`${scope} .${prefix}code-block-first`]: {
      borderTopLeftRadius: "var(--mb-code-block-radius, 8px)",
      borderTopRightRadius: "var(--mb-code-block-radius, 8px)",
    },
    [`${scope} .${prefix}code-block-last`]: {
      borderBottomLeftRadius: "var(--mb-code-block-radius, 8px)",
      borderBottomRightRadius: "var(--mb-code-block-radius, 8px)",
    },
    [`${scope} .${prefix}code-block-indented.${prefix}code-block-first`]: {
      borderTopLeftRadius: "0",
      borderTopRightRadius: "0",
    },
    [`${scope} .${prefix}code-block-indented.${prefix}code-block-last`]: {
      borderBottomLeftRadius: "0",
      borderBottomRightRadius: "0",
    },
    [`${scope} .${prefix}thematic-break`]: {
      position: "relative",
      color: "var(--mb-hr-color, currentColor)",
      opacity: "var(--mb-hr-opacity, 0.3)",
    },
    [`${scope} .${prefix}thematic-break::after`]: {
      content: '""',
      display: "block",
      position: "absolute",
      left: "0",
      right: "0",
      top: "50%",
      transform: "translateY(-50%)",
      borderTop: "1px solid currentColor",
    },
    [`${scope} .${prefix}thematic-break.cm-lp-raw::after`]: {
      display: "none",
    },
    [`${scope} .${prefix}code-block-first, ${scope} .${prefix}code-block-middle, ${scope} .${prefix}code-block-last`]:
      {
        paddingLeft: "var(--mb-code-block-padding-x, 0.75rem)",
        paddingRight: "var(--mb-code-block-padding-x, 0.75rem)",
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
