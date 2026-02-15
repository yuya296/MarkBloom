import type { Extension } from "@codemirror/state";
import type { LivePreviewPlugin } from "@yuya296/cm6-live-preview-core";
import {
  mermaidLivePreviewPlugin,
  type MermaidLivePreviewPluginOptions,
} from "./mermaidPlugin";
import { mermaidLivePreviewTheme } from "./theme";

export type { MermaidLivePreviewPluginOptions } from "./mermaidPlugin";
export { mermaidLivePreviewTheme } from "./theme";

export type MermaidLivePreviewBundle = {
  extensions: readonly Extension[];
  plugin: LivePreviewPlugin;
};

export function mermaidLivePreview(
  options: MermaidLivePreviewPluginOptions = {}
): MermaidLivePreviewBundle {
  return {
    extensions: [mermaidLivePreviewTheme()],
    plugin: mermaidLivePreviewPlugin(options),
  };
}
