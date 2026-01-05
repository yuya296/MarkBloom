import { NodeName } from "./core/syntaxNodeNames";

export type RawModeTrigger = "never" | "always" | "block" | "nearby";
export type DisplayStyle = "hide" | "none";

export type InlineElementConfig = {
  kind: "inline";
  node: NodeName;
  rawModeTrigger: RawModeTrigger | RawModeTrigger[];
  rich: DisplayStyle;
  raw: DisplayStyle;
  richHideNodes: NodeName[];
};

export type BlockMarkerConfig = {
  kind: "block-marker";
  id: "heading" | "list" | "quote";
  rawModeTrigger: RawModeTrigger | RawModeTrigger[];
  rich: DisplayStyle;
  raw: DisplayStyle;
};

export type BlockFenceConfig = {
  kind: "block-fence";
  node: NodeName;
  rawModeTrigger: RawModeTrigger | RawModeTrigger[];
  rich: DisplayStyle;
  raw: DisplayStyle;
};

const inlineTrigger: RawModeTrigger = "nearby";

export const inlineElementConfigs: InlineElementConfig[] = [
  {
    kind: "inline",
    node: NodeName.Emphasis,
    rawModeTrigger: inlineTrigger,
    rich: "hide",
    raw: "none",
    richHideNodes: [NodeName.EmphasisMark],
  },
  {
    kind: "inline",
    node: NodeName.StrongEmphasis,
    rawModeTrigger: inlineTrigger,
    rich: "hide",
    raw: "none",
    richHideNodes: [NodeName.EmphasisMark],
  },
  {
    kind: "inline",
    node: NodeName.Strikethrough,
    rawModeTrigger: inlineTrigger,
    rich: "hide",
    raw: "none",
    richHideNodes: [NodeName.StrikethroughMark],
  },
  {
    kind: "inline",
    node: NodeName.InlineCode,
    rawModeTrigger: inlineTrigger,
    rich: "hide",
    raw: "none",
    richHideNodes: [NodeName.CodeMark],
  },
  {
    kind: "inline",
    node: NodeName.Link,
    rawModeTrigger: inlineTrigger,
    rich: "hide",
    raw: "none",
    richHideNodes: [NodeName.LinkMark, NodeName.URL],
  },
  {
    kind: "inline",
    node: NodeName.Image,
    rawModeTrigger: inlineTrigger,
    rich: "hide",
    raw: "none",
    richHideNodes: [NodeName.LinkMark, NodeName.URL],
  },
];

export const blockMarkerConfigs: BlockMarkerConfig[] = [
  {
    kind: "block-marker",
    id: "heading",
    rawModeTrigger: ["nearby", "block"],
    rich: "hide",
    raw: "none",
  },
  {
    kind: "block-marker",
    id: "list",
    rawModeTrigger: "always",
    rich: "none",
    raw: "none",
  },
  {
    kind: "block-marker",
    id: "quote",
    rawModeTrigger: ["nearby", "block"],
    rich: "hide",
    raw: "none",
  },
];

export const blockFenceConfig: BlockFenceConfig = {
  kind: "block-fence",
  node: NodeName.FencedCode,
  rawModeTrigger: ["nearby", "block"],
  rich: "hide",
  raw: "none",
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
