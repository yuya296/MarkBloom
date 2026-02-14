import { Extension, StateField } from "@codemirror/state";
import { type DecorationSet, EditorView } from "@codemirror/view";
import { buildDecorations } from "./decorations";
import { type LivePreviewOptions, resolveLivePreviewOptions } from "./options";

export type {
  LivePreviewOptions,
  ResolvedLivePreviewOptions,
} from "./options";
export type {
  LivePreviewPlugin,
  LivePreviewPluginContext,
  LivePreviewPluginDecoration,
  LivePreviewPluginErrorEvent,
} from "./plugins/types";
export type { Range } from "./core/types";

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

export function livePreview(options: LivePreviewOptions = {}): Extension {
  const resolved = resolveLivePreviewOptions(options);

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
