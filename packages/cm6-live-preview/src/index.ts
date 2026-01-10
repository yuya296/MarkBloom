import type { Extension } from "@codemirror/state";
import { livePreview, type LivePreviewOptions } from "cm6-live-preview-core";
import { markdownSemantics, type MarkdownSemanticsOptions } from "cm6-markdown-semantics";
import { tableEditor, type TableEditorOptions } from "cm6-table-editor";
import { typographyTheme, type TypographyThemeOptions } from "cm6-typography-theme";

export type LivePreviewPresetOptions = {
  livePreview?: LivePreviewOptions;
  tableEditor?: TableEditorOptions;
  semantics?: MarkdownSemanticsOptions;
  typography?: TypographyThemeOptions;
};

export function livePreviewPreset(options: LivePreviewPresetOptions = {}): Extension {
  const { livePreview: livePreviewOptions, tableEditor: tableEditorOptions, semantics, typography } =
    options;

  return [
    markdownSemantics(semantics),
    typographyTheme(typography),
    tableEditor(tableEditorOptions),
    livePreview(livePreviewOptions),
  ];
}
