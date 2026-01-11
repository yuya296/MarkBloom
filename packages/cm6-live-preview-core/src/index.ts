import { Extension, StateField } from "@codemirror/state";
import { type DecorationSet, EditorView } from "@codemirror/view";
import { buildDecorations } from "./decorations";

export type LivePreviewOptions = {
  blockRevealEnabled?: boolean;
  rawModeKeepsTheme?: boolean;
  exclude?: { code?: boolean };
  imageBasePath?: string;
  imageRawShowsPreview?: boolean;
};

export function livePreviewBaseTheme(): Extension {
  return EditorView.baseTheme({
    ".cm-content .cm-lp-image": {
      display: "inline-block",
      maxWidth: "100%",
    },
    ".cm-content .cm-lp-image img": {
      display: "block",
      maxWidth: "100%",
      height: "auto",
    },
  });
}

const defaultOptions: Required<LivePreviewOptions> = {
  blockRevealEnabled: false,
  rawModeKeepsTheme: true,
  exclude: { code: true },
  imageBasePath: "",
  imageRawShowsPreview: false,
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

  const decorations = StateField.define<DecorationSet>({
    create(state) {
      return buildDecorations(state, resolved);
    },
    update(_decorations, tr) {
      return buildDecorations(tr.state, resolved);
    },
    provide: (field) => EditorView.decorations.from(field),
  });

  return [livePreviewBaseTheme(), decorations];
}
