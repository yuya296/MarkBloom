import type { Decoration } from "@codemirror/view";
import type { ResolvedLivePreviewOptions } from "../options";
import type { LivePreviewPluginContext } from "./types";

type PushDecoration = (from: number, to: number, decoration: Decoration) => void;

export function applyLivePreviewPlugins(
  push: PushDecoration,
  ctx: LivePreviewPluginContext,
  options: ResolvedLivePreviewOptions
) {
  const docLength = ctx.state.doc.length;

  for (const plugin of options.plugins) {
    const pluginName = plugin.name || "unnamed-plugin";
    try {
      const decorations = plugin.decorate(ctx);
      for (const item of decorations) {
        if (
          !item ||
          typeof item.from !== "number" ||
          typeof item.to !== "number" ||
          !item.decoration
        ) {
          continue;
        }
        if (
          item.from > item.to ||
          item.from < 0 ||
          item.to < 0 ||
          item.from > docLength ||
          item.to > docLength
        ) {
          continue;
        }
        push(item.from, item.to, item.decoration);
      }
    } catch (error) {
      options.onPluginError({
        pluginName,
        error,
      });
    }
  }
}
