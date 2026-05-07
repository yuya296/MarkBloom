import type { Extension } from "@codemirror/state";
import { resolveImageBasePath } from "@yuya296/cm6-live-preview";
import type { ExtensionOptions } from "../editorSettings";
import { resolveMermaidPreviewEnabled, resolvePreviewFeatureFlags } from "../featureFlags";
import {
  buildDiffGutterExtension,
  buildLineNumbersExtension,
  buildLivePreviewExtension,
  buildTabSizeExtension,
  buildThemeExtensions,
  buildWrapExtension,
} from "./extensionBuilders";

export function buildExtensions(options: ExtensionOptions): Extension[] {
  const previewFeatureFlags = resolvePreviewFeatureFlags();
  const mermaidEnabled = resolveMermaidPreviewEnabled({
    livePreviewEnabled: options.livePreviewEnabled,
    featureFlags: previewFeatureFlags,
  });

  return [
    buildDiffGutterExtension({ baselineText: options.diffBaselineText }),
    ...buildLineNumbersExtension({ showLineNumbers: options.showLineNumbers }),
    ...buildWrapExtension({ wrapLines: options.wrapLines }),
    ...buildTabSizeExtension({ tabSize: options.tabSize }),
    ...buildThemeExtensions(),
    buildLivePreviewExtension({
      livePreviewEnabled: options.livePreviewEnabled,
      blockRevealEnabled: options.blockRevealEnabled,
      imageBaseUrl: resolveImageBasePath(import.meta.env.BASE_URL),
      mermaidEnabled,
    }),
  ];
}
