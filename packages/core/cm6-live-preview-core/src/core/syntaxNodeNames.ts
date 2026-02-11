export const NodeName = {
  Blockquote: "Blockquote",
  BulletList: "BulletList",
  OrderedList: "OrderedList",
  ListItem: "ListItem",
  ATXHeading1: "ATXHeading1",
  ATXHeading2: "ATXHeading2",
  ATXHeading3: "ATXHeading3",
  ATXHeading4: "ATXHeading4",
  ATXHeading5: "ATXHeading5",
  ATXHeading6: "ATXHeading6",
  SetextHeading1: "SetextHeading1",
  SetextHeading2: "SetextHeading2",
  Emphasis: "Emphasis",
  StrongEmphasis: "StrongEmphasis",
  Link: "Link",
  Image: "Image",
  HTMLTag: "HTMLTag",
  InlineCode: "InlineCode",
  Strikethrough: "Strikethrough",
  HorizontalRule: "HorizontalRule",
  FencedCode: "FencedCode",
  CodeBlock: "CodeBlock",
  CodeMark: "CodeMark",
  EmphasisMark: "EmphasisMark",
  LinkMark: "LinkMark",
  StrikethroughMark: "StrikethroughMark",
  URL: "URL",
} as const;

export type NodeName = (typeof NodeName)[keyof typeof NodeName];

export const BLOCK_NODE_NAMES: ReadonlySet<NodeName> = new Set<NodeName>([
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
]);

export const INLINE_CONTAINER_NAMES: ReadonlySet<NodeName> = new Set<NodeName>([
  NodeName.Emphasis,
  NodeName.StrongEmphasis,
  NodeName.Link,
  NodeName.Image,
  NodeName.HTMLTag,
  NodeName.InlineCode,
  NodeName.Strikethrough,
]);

export const INLINE_MARK_NAMES: ReadonlySet<NodeName> = new Set<NodeName>([
  NodeName.EmphasisMark,
  NodeName.LinkMark,
  NodeName.CodeMark,
  NodeName.StrikethroughMark,
]);

export function hasNodeName(
  set: ReadonlySet<NodeName>,
  name: string
): name is NodeName {
  return set.has(name as NodeName);
}
