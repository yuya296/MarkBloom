import { Extension } from "@codemirror/state";
import {
  type DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { buildDecorations } from "./decorations";

export type LivePreviewOptions = {
  inlineRadius?: number;
  inlineRadiusBefore?: number;
  inlineRadiusAfter?: number;
  inlineStyle?: "dim" | "hide";
  blockStyle?: "dim" | "hide";
  blockRevealMode?: "line" | "block";
  disableDuringIME?: boolean;
  exclude?: { code?: boolean };
};

export function livePreviewBaseTheme(): Extension {
  return EditorView.baseTheme({
    ".cm-live-preview-inline-dim, .cm-live-preview-block-dim": {
      opacity: "0.35",
    },
    ".cm-live-preview-inline-hide, .cm-live-preview-block-hide": {
      opacity: "0",
      pointerEvents: "none",
    },
  });
}

const defaultOptions: Required<LivePreviewOptions> = {
  inlineRadius: 1,
  inlineRadiusBefore: 1,
  inlineRadiusAfter: 1,
  inlineStyle: "dim",
  blockStyle: "dim",
  blockRevealMode: "line",
  disableDuringIME: true,
  exclude: { code: true },
};

export function livePreview(options: LivePreviewOptions = {}): Extension {
  const resolved: LivePreviewOptions = {
    ...defaultOptions,
    ...options,
    exclude: {
      ...defaultOptions.exclude,
      ...options.exclude,
    },
  };

  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      private composing: boolean;

      constructor(view: EditorView) {
        this.composing = view.composing;
        this.decorations = buildDecorations(view, resolved);
      }

      update(update: ViewUpdate) {
        const composingChanged = update.view.composing !== this.composing;
        if (composingChanged) {
          this.composing = update.view.composing;
        }

        if (update.docChanged || update.selectionSet || update.viewportChanged || composingChanged) {
          this.decorations = buildDecorations(update.view, resolved);
        }
      }
    },
    {
      decorations: (view) => view.decorations,
    }
  );

  return [livePreviewBaseTheme(), plugin];
}
