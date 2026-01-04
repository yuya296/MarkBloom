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
  blockRevealEnabled?: boolean;
  exclude?: { code?: boolean };
};

export function livePreviewBaseTheme(): Extension {
  return EditorView.baseTheme({
    ".cm-live-preview-block-label": {
      fontStyle: "italic",
    },
  });
}

const defaultOptions: Required<LivePreviewOptions> = {
  inlineRadius: 1,
  inlineRadiusBefore: 1,
  inlineRadiusAfter: 1,
  blockRevealEnabled: false,
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

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view, resolved);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet || update.viewportChanged) {
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
