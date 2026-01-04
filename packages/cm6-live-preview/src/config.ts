import { NodeName } from "./core/syntaxNodeNames";

export type TriggerId = "selection" | "block" | "proximity" | "none";
export type DisplayStyle = "hide" | "color-secondary" | "widgetLabel" | "none";

export type InlineElementConfig = {
  kind: "inline";
  node: NodeName;
  triggers: TriggerId[];
  preview: DisplayStyle;
  raw: DisplayStyle;
  previewHideNodes: NodeName[];
  rawColorNodes: NodeName[];
};

export type BlockMarkerConfig = {
  kind: "block-marker";
  id: "heading" | "list" | "quote";
  triggers: TriggerId[];
  preview: DisplayStyle;
  raw: DisplayStyle;
};

export type BlockFenceConfig = {
  kind: "block-fence";
  node: NodeName;
  triggers: TriggerId[];
  preview: DisplayStyle;
  raw: DisplayStyle;
};

const inlineTriggers: TriggerId[] = ["selection", "proximity"];

export const inlineElementConfigs: InlineElementConfig[] = [
  {
    kind: "inline",
    node: NodeName.Emphasis,
    triggers: inlineTriggers,
    preview: "hide",
    raw: "color-secondary",
    previewHideNodes: [NodeName.EmphasisMark],
    rawColorNodes: [NodeName.EmphasisMark],
  },
  {
    kind: "inline",
    node: NodeName.StrongEmphasis,
    triggers: inlineTriggers,
    preview: "hide",
    raw: "color-secondary",
    previewHideNodes: [NodeName.EmphasisMark],
    rawColorNodes: [NodeName.EmphasisMark],
  },
  {
    kind: "inline",
    node: NodeName.Strikethrough,
    triggers: inlineTriggers,
    preview: "hide",
    raw: "color-secondary",
    previewHideNodes: [NodeName.StrikethroughMark],
    rawColorNodes: [NodeName.StrikethroughMark],
  },
  {
    kind: "inline",
    node: NodeName.InlineCode,
    triggers: inlineTriggers,
    preview: "hide",
    raw: "color-secondary",
    previewHideNodes: [NodeName.CodeMark],
    rawColorNodes: [NodeName.CodeMark],
  },
  {
    kind: "inline",
    node: NodeName.Link,
    triggers: inlineTriggers,
    preview: "hide",
    raw: "color-secondary",
    previewHideNodes: [NodeName.LinkMark, NodeName.URL],
    rawColorNodes: [NodeName.LinkMark],
  },
  {
    kind: "inline",
    node: NodeName.Image,
    triggers: inlineTriggers,
    preview: "hide",
    raw: "color-secondary",
    previewHideNodes: [NodeName.LinkMark, NodeName.URL],
    rawColorNodes: [NodeName.LinkMark],
  },
];

export const blockMarkerConfigs: BlockMarkerConfig[] = [
  {
    kind: "block-marker",
    id: "heading",
    triggers: ["selection", "block"],
    preview: "hide",
    raw: "color-secondary",
  },
  {
    kind: "block-marker",
    id: "list",
    triggers: ["none"],
    preview: "color-secondary",
    raw: "color-secondary",
  },
  {
    kind: "block-marker",
    id: "quote",
    triggers: ["selection", "block"],
    preview: "hide",
    raw: "color-secondary",
  },
];

export const blockFenceConfig: BlockFenceConfig = {
  kind: "block-fence",
  node: NodeName.FencedCode,
  triggers: ["selection", "block"],
  preview: "widgetLabel",
  raw: "color-secondary",
};

export const blockTriggerNodeNames: ReadonlySet<NodeName> = new Set<NodeName>([
  NodeName.Blockquote,
  NodeName.BulletList,
  NodeName.OrderedList,
  NodeName.ListItem,
  NodeName.ATXHeading1,
  NodeName.ATXHeading2,
  NodeName.ATXHeading3,
  NodeName.ATXHeading4,
  NodeName.ATXHeading5,
  NodeName.ATXHeading6,
  NodeName.SetextHeading1,
  NodeName.SetextHeading2,
  NodeName.FencedCode,
  NodeName.CodeBlock,
]);
