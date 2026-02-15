import type { LivePreviewPlugin, LivePreviewPluginErrorEvent } from "./plugins/types";

export type LivePreviewOptions = {
  blockRevealEnabled?: boolean;
  exclude?: { code?: boolean };
  imageBasePath?: string;
  imageRawShowsPreview?: boolean;
  plugins?: readonly LivePreviewPlugin[];
  onPluginError?: (event: LivePreviewPluginErrorEvent) => void;
  /** @deprecated This option is currently a no-op and kept for compatibility. */
  rawModeKeepsTheme?: boolean;
};

export type ResolvedLivePreviewOptions = {
  blockRevealEnabled: boolean;
  exclude: { code: boolean };
  imageBasePath: string;
  imageRawShowsPreview: boolean;
  plugins: readonly LivePreviewPlugin[];
  onPluginError: (event: LivePreviewPluginErrorEvent) => void;
  rawModeKeepsTheme: boolean;
};

const defaultOnPluginError = (event: LivePreviewPluginErrorEvent) => {
  console.error(`[cm6-live-preview-core] plugin "${event.pluginName}" failed`, event.error);
};

export function resolveLivePreviewOptions(
  options: LivePreviewOptions = {}
): ResolvedLivePreviewOptions {
  return {
    blockRevealEnabled: options.blockRevealEnabled ?? false,
    exclude: {
      code: options.exclude?.code ?? true,
    },
    imageBasePath: options.imageBasePath ?? "",
    imageRawShowsPreview: options.imageRawShowsPreview ?? false,
    plugins: options.plugins ?? [],
    onPluginError: options.onPluginError ?? defaultOnPluginError,
    rawModeKeepsTheme: options.rawModeKeepsTheme ?? true,
  };
}
