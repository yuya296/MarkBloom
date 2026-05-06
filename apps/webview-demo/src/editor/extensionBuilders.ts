import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";
import { diffGutter } from "@yuya296/cm6-diff-gutter";
import { livePreviewPreset } from "@yuya296/cm6-live-preview";
import { editorHighlightStyle } from "../editorHighlightStyle.ts";
import { editorTheme } from "../editorTheme.ts";
import { isTableLine } from "./tableLineMatcher.ts";

export function buildDiffGutterExtension(opts: { baselineText: string }): Extension {
  return diffGutter({
    baselineText: opts.baselineText,
    ignoreLine: isTableLine,
  });
}

export function buildLineNumbersExtension(opts: { showLineNumbers: boolean }): Extension[] {
  return opts.showLineNumbers ? [lineNumbers()] : [];
}

export function buildWrapExtension(opts: { wrapLines: boolean }): Extension[] {
  return opts.wrapLines ? [EditorView.lineWrapping] : [];
}

export function buildTabSizeExtension(opts: { tabSize: number }): Extension[] {
  return Number.isFinite(opts.tabSize) ? [EditorState.tabSize.of(opts.tabSize)] : [];
}

export function buildThemeExtensions(): Extension[] {
  return [editorHighlightStyle(), editorTheme()];
}

export function buildLivePreviewExtension(opts: {
  livePreviewEnabled: boolean;
  blockRevealEnabled: boolean;
  imageBaseUrl: string;
  mermaidEnabled: boolean;
}): Extension {
  return livePreviewPreset({
    livePreview: opts.livePreviewEnabled
      ? {
          blockRevealEnabled: opts.blockRevealEnabled,
          imageBasePath: opts.imageBaseUrl,
          imageRawShowsPreview: true,
        }
      : false,
    mermaid: opts.mermaidEnabled,
    table: true,
  });
}
