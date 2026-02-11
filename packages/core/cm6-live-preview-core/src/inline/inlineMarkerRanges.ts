import { syntaxTree } from "@codemirror/language";
import type { EditorState, Line } from "@codemirror/state";
import type { ExcludeRanges, Range } from "../core/types";
import type { LivePreviewOptions } from "../index";
import { inRangeSegment, selectionOverlapsRange } from "../core/utils";
import {
  INLINE_CONTAINER_NAMES,
  NodeName,
  hasNodeName,
} from "../core/syntaxNodeNames";
import { inlineElementConfigs, type InlineElementConfig, type RawModeTrigger } from "../config";

const inlineConfigByNode = new Map(
  inlineElementConfigs.map((config) => [config.node, config])
);
const inlineHideTargets = new Map<NodeName, NodeName[]>([
  [NodeName.Emphasis, [NodeName.EmphasisMark]],
  [NodeName.StrongEmphasis, [NodeName.EmphasisMark]],
  [NodeName.Strikethrough, [NodeName.StrikethroughMark]],
  [NodeName.InlineCode, [NodeName.CodeMark]],
  [NodeName.Link, [NodeName.LinkMark, NodeName.URL]],
  [NodeName.Image, [NodeName.LinkMark, NodeName.URL]],
]);

const taskTokenPattern = /^\[(?: |x|X)\]$/;
const taskPrefixPattern = /^\s{0,3}(?:>\s?)*\s*(?:[*+-]|\d+\.)\s+$/;

function isTaskTokenLink(state: EditorState, from: number, to: number): boolean {
  const token = state.doc.sliceString(from, to);
  if (!taskTokenPattern.test(token)) {
    return false;
  }
  const line = state.doc.lineAt(from);
  const prefix = line.text.slice(0, from - line.from);
  return taskPrefixPattern.test(prefix);
}

function isCursorAdjacent(
  line: Line,
  head: number,
  from: number,
  to: number,
  radiusBefore: number,
  radiusAfter: number
): boolean {
  if (head < from) {
    if (from - head > radiusAfter) {
      return false;
    }
    const between = line.text.slice(head - line.from, from - line.from);
    return !/\s/u.test(between);
  }

  if (head > to) {
    if (head - to > radiusBefore) {
      return false;
    }
    const between = line.text.slice(to - line.from, head - line.from);
    return !/\s/u.test(between);
  }

  return false;
}

function normalizeTriggers(rawModeTrigger: RawModeTrigger | RawModeTrigger[]): RawModeTrigger[] {
  return Array.isArray(rawModeTrigger) ? rawModeTrigger : [rawModeTrigger];
}

function isInlineRaw(
  state: EditorState,
  node: { from: number; to: number },
  rawModeTrigger: InlineElementConfig["rawModeTrigger"]
): boolean {
  const triggers = normalizeTriggers(rawModeTrigger);

  if (triggers.includes("always")) {
    return true;
  }

  if (triggers.includes("nearby")) {
    if (selectionOverlapsRange(state.selection.ranges, node.from, node.to)) {
      return true;
    }
    const head = state.selection.main.head;
    const line = state.doc.lineAt(head);
    if (line.number === state.doc.lineAt(node.from).number) {
      const radiusBefore = 1;
      const radiusAfter = 1;
      if (head >= node.from && head <= node.to) {
        return true;
      }
      if (isCursorAdjacent(line, head, node.from, node.to, radiusBefore, radiusAfter)) {
        return true;
      }
    }
  }

  return false;
}

function collectChildRanges(
  state: EditorState,
  from: number,
  to: number,
  targets: ReadonlySet<NodeName>
): Range[] {
  const ranges: Range[] = [];
  syntaxTree(state).iterate({
    from,
    to,
    enter: (node) => {
      if (targets.has(node.name as NodeName)) {
        ranges.push({ from: node.from, to: node.to });
      }
    },
  });
  return ranges;
}

type HtmlTagKind = "opening" | "closing" | "self-closing" | "other";

type HtmlTagInfo = {
  from: number;
  to: number;
  kind: HtmlTagKind;
  tagName: string | null;
};

type HtmlTagGroup = {
  from: number;
  to: number;
  tags: Range[];
};

function parseHtmlTagInfo(literal: string, from: number, to: number): HtmlTagInfo {
  const closingMatch = literal.match(/^<\/([A-Za-z][\w:-]*)\s*>$/);
  if (closingMatch) {
    return {
      from,
      to,
      kind: "closing",
      tagName: closingMatch[1].toLowerCase(),
    };
  }

  const selfClosingMatch = literal.match(/^<([A-Za-z][\w:-]*)(?:\s[\s\S]*?)?\/>$/);
  if (selfClosingMatch) {
    return {
      from,
      to,
      kind: "self-closing",
      tagName: selfClosingMatch[1].toLowerCase(),
    };
  }

  const openingMatch = literal.match(/^<([A-Za-z][\w:-]*)(?:\s[\s\S]*?)?>$/);
  if (openingMatch) {
    return {
      from,
      to,
      kind: "opening",
      tagName: openingMatch[1].toLowerCase(),
    };
  }

  return { from, to, kind: "other", tagName: null };
}

function groupInlineHtmlTags(tags: HtmlTagInfo[]): HtmlTagGroup[] {
  const groups: HtmlTagGroup[] = [];
  const openIndices = new Map<string, number[]>();
  const matched = new Set<number>();

  for (let i = 0; i < tags.length; i += 1) {
    const tag = tags[i];
    if (!tag.tagName) {
      continue;
    }

    if (tag.kind === "opening") {
      const stack = openIndices.get(tag.tagName) ?? [];
      stack.push(i);
      openIndices.set(tag.tagName, stack);
      continue;
    }

    if (tag.kind === "closing") {
      const stack = openIndices.get(tag.tagName);
      const openIndex = stack?.pop();
      if (typeof openIndex === "number") {
        matched.add(openIndex);
        matched.add(i);
        const openTag = tags[openIndex];
        groups.push({
          from: openTag.from,
          to: tag.to,
          tags: [
            { from: openTag.from, to: openTag.to },
            { from: tag.from, to: tag.to },
          ],
        });
      }
    }
  }

  for (let i = 0; i < tags.length; i += 1) {
    if (matched.has(i)) {
      continue;
    }
    groups.push({
      from: tags[i].from,
      to: tags[i].to,
      tags: [{ from: tags[i].from, to: tags[i].to }],
    });
  }

  groups.sort((a, b) => (a.from === b.from ? a.to - b.to : a.from - b.from));
  return groups;
}

export function collectInlineMarkerRanges(
  state: EditorState,
  options: LivePreviewOptions,
  excluded: ExcludeRanges
): {
  hidden: Range[];
  images: Array<{ from: number; to: number; src: string; alt: string; raw: boolean }>;
} {
  const hidden: Range[] = [];
  const images: Array<{ from: number; to: number; src: string; alt: string; raw: boolean }> = [];
  const htmlTags: HtmlTagInfo[] = [];
  const tree = syntaxTree(state);
  const basePath = options.imageBasePath?.replace(/\/+$/, "") ?? "";
  const resolvedBase = (() => {
    if (!basePath) {
      return "";
    }
    const normalizedBase = basePath.endsWith("/") ? basePath : `${basePath}/`;
    if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(normalizedBase)) {
      return new URL(normalizedBase).toString();
    }
    const baseURI = typeof document !== "undefined" ? document.baseURI : "";
    if (!baseURI) {
      return "";
    }
    return new URL(normalizedBase, baseURI).toString();
  })();

  tree.iterate({
    enter: (node) => {
      if (!hasNodeName(INLINE_CONTAINER_NAMES, node.name)) {
        return;
      }

      const config = inlineConfigByNode.get(node.name);
      if (!config) {
        return;
      }

      if (node.name === NodeName.Link && isTaskTokenLink(state, node.from, node.to)) {
        return;
      }

      if (
        inRangeSegment(node.from, node.to, excluded.block) ||
        inRangeSegment(node.from, node.to, excluded.inline)
      ) {
        return;
      }

      if (node.name === NodeName.HTMLTag) {
        const literal = state.doc.sliceString(node.from, node.to);
        htmlTags.push(parseHtmlTagInfo(literal, node.from, node.to));
        return;
      }

      const raw = isInlineRaw(state, node, config.rawModeTrigger);
      if (!raw && config.richDisplayStyle === "hide") {
        const targets = inlineHideTargets.get(config.node);
        if (targets) {
          hidden.push(...collectChildRanges(state, node.from, node.to, new Set(targets)));
        }
      }

      if ((!raw || options.imageRawShowsPreview) && node.name === NodeName.Image) {
        const literal = state.doc.sliceString(node.from, node.to);
        const match = literal.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/);
        if (!match) {
          return;
        }
        const alt = match[1] ?? "";
        const rawSrc = match[2] ?? "";
        if (!rawSrc) {
          return;
        }
        const shouldResolve =
          resolvedBase &&
          !/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(rawSrc) &&
          !rawSrc.startsWith("/");
        const src = shouldResolve ? new URL(rawSrc, resolvedBase).toString() : rawSrc;
        if (!src) {
          return;
        }
        images.push({ from: node.from, to: node.to, src, alt, raw });
      }
    },
  });

  const htmlTagConfig = inlineConfigByNode.get(NodeName.HTMLTag);
  if (htmlTagConfig && htmlTagConfig.richDisplayStyle === "hide") {
    const groups = groupInlineHtmlTags(htmlTags);
    for (const group of groups) {
      const raw = isInlineRaw(state, group, htmlTagConfig.rawModeTrigger);
      if (raw) {
        continue;
      }
      hidden.push(...group.tags);
    }
  }

  return { hidden, images };
}
