import { EditorView } from "@codemirror/view";

export function mermaidLivePreviewTheme() {
  return EditorView.baseTheme({
    ".cm-lp-mermaid": {
      display: "block",
      // Keep block widget geometry measurable by CodeMirror (margin is excluded from offsetHeight).
      margin: "0",
      padding: "0.75rem",
      border: "1px solid var(--editor-border, #d1d5db)",
      borderRadius: "8px",
      background: "var(--editor-surface, #ffffff)",
      overflowX: "auto",
      position: "relative",
    },
    ".cm-lp-mermaid-error": {
      borderColor: "var(--editor-diff-modified, #d29922)",
    },
    ".cm-lp-mermaid-content": {
      display: "flex",
      justifyContent: "center",
    },
    ".cm-lp-mermaid-content svg": {
      display: "block",
      maxWidth: "100%",
      height: "auto",
    },
    ".cm-lp-mermaid-open-button": {
      position: "absolute",
      top: "8px",
      right: "8px",
      border: "1px solid var(--editor-border, #d1d5db)",
      background: "var(--app-button-bg, #f3f4f6)",
      color: "var(--app-text, #111827)",
      borderRadius: "6px",
      padding: "2px 8px",
      fontSize: "12px",
      cursor: "pointer",
    },
    ".cm-line.cm-lp-mermaid-fence-line-mask": {
      background: "transparent !important",
      backgroundImage: "none !important",
      borderRadius: "0 !important",
      paddingTop: "0 !important",
      paddingBottom: "0 !important",
    },
  });
}
