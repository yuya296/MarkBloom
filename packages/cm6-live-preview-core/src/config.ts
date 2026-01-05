import { NodeName } from "./core/syntaxNodeNames";

export type RawModeTrigger = "never" | "always" | "block" | "nearby";
export type DisplayStyle = "hide" | "none";

export type InlineElementConfig = {
  kind: "inline";
  node: NodeName;
  rawModeTrigger: RawModeTrigger | RawModeTrigger[];
  richDisplayStyle: DisplayStyle;
};

export type BlockMarkerConfig = {
  kind: "block-marker";
  id: "heading" | "list" | "quote" | "fence";
  rawModeTrigger: RawModeTrigger | RawModeTrigger[];
  richDisplayStyle: DisplayStyle;
};

const inlineTrigger: RawModeTrigger = "nearby";

export const inlineElementConfigs: InlineElementConfig[] = [
  {
    kind: "inline",
    node: NodeName.Emphasis,
    rawModeTrigger: inlineTrigger,
    richDisplayStyle: "hide",
  },
  {
    kind: "inline",
    node: NodeName.StrongEmphasis,
    rawModeTrigger: inlineTrigger,
    richDisplayStyle: "hide",
  },
  {
    kind: "inline",
    node: NodeName.Strikethrough,
    rawModeTrigger: inlineTrigger,
    richDisplayStyle: "hide",
  },
  {
    kind: "inline",
    node: NodeName.InlineCode,
    rawModeTrigger: inlineTrigger,
    richDisplayStyle: "hide",
  },
  {
    kind: "inline",
    node: NodeName.Link,
    rawModeTrigger: inlineTrigger,
    richDisplayStyle: "hide",
  },
  {
    kind: "inline",
    node: NodeName.Image,
    rawModeTrigger: inlineTrigger,
    richDisplayStyle: "hide",
  },
];

export const blockMarkerConfigs: BlockMarkerConfig[] = [
  {
    kind: "block-marker",
    id: "heading",
    rawModeTrigger: ["nearby", "block"],
    richDisplayStyle: "hide",
  },
  {
    kind: "block-marker",
    id: "list",
    rawModeTrigger: "always",
    richDisplayStyle: "none",
  },
  {
    kind: "block-marker",
    id: "quote",
    rawModeTrigger: ["nearby", "block"],
    richDisplayStyle: "hide",
  },
  {
    kind: "block-marker",
    id: "fence",
    rawModeTrigger: ["nearby", "block"],
    richDisplayStyle: "hide",
  },
];

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
