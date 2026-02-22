import type { Extension } from "@codemirror/state";
import { livePreview, type LivePreviewOptions } from "@yuya296/cm6-live-preview-core";
import {
  mermaidLivePreview,
  type MermaidLivePreviewPluginOptions,
} from "@yuya296/cm6-live-preview-mermaid";
import { markdownSemantics, type MarkdownSemanticsOptions } from "@yuya296/cm6-markdown-semantics";
import { tableEditor, type TableEditorOptions } from "@yuya296/cm6-table";
import { typographyTheme, type TypographyThemeOptions } from "@yuya296/cm6-typography-theme";

type MermaidPresetOption = boolean | MermaidLivePreviewPluginOptions;
type TablePresetOption = boolean | TableEditorOptions;

export type LivePreviewPresetOptions = {
  livePreview?: false | LivePreviewOptions;
  semantics?: MarkdownSemanticsOptions;
  typography?: TypographyThemeOptions;
  mermaid?: MermaidPresetOption;
  table?: TablePresetOption;
};

export function livePreviewPreset(options: LivePreviewPresetOptions = {}): Extension {
  const {
    livePreview: livePreviewOptions,
    semantics,
    typography,
    mermaid,
    table,
  } = options;

  const resolvedLivePreview =
    livePreviewOptions === false ? null : (livePreviewOptions ?? {});

  const result: Extension[] = [markdownSemantics(semantics), typographyTheme(typography)];

  if (resolvedLivePreview) {
    const mermaidOptions =
      mermaid === true ? {} : mermaid && typeof mermaid === "object" ? mermaid : null;
    if (mermaidOptions) {
      const mermaidBundle = mermaidLivePreview(mermaidOptions);
      result.push(...mermaidBundle.extensions);
      const plugins = [...(resolvedLivePreview.plugins ?? []), mermaidBundle.plugin];
      result.push(livePreview({ ...resolvedLivePreview, plugins }));
    } else {
      result.push(livePreview(resolvedLivePreview));
    }
  }

  const tableOptions =
    table === true ? {} : table && typeof table === "object" ? table : null;
  if (tableOptions) {
    result.push(tableEditor(tableOptions));
  }

  return result;
}
