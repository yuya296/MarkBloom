import type { EditorState } from "@codemirror/state";
import type { Decoration } from "@codemirror/view";
import type { Range } from "../core/types";

export type LivePreviewPluginDecoration = {
  from: number;
  to: number;
  decoration: Decoration;
};

export type LivePreviewPluginContext = {
  state: EditorState;
  selectionRanges: readonly Range[];
  blockRevealRange: Range | null;
  isSelectionOverlap: (range: Range) => boolean;
  isBlockRevealOverlap: (range: Range) => boolean;
};

export type LivePreviewPlugin = {
  name: string;
  decorate: (
    ctx: LivePreviewPluginContext
  ) => readonly LivePreviewPluginDecoration[];
};

export type LivePreviewPluginErrorEvent = {
  pluginName: string;
  error: unknown;
};
