# cm6-markdown-semantics

CodeMirror 6 extension that assigns semantic classes to Markdown syntax ranges.

## Usage

```ts
import { markdownSemantics } from "cm6-markdown-semantics";

const extension = markdownSemantics({ classPrefix: "mb-" });
```

## Contract

The default class prefix is `mb-`.

Examples:
- `mb-heading-1` .. `mb-heading-6`
- `mb-strong`, `mb-em`
- `mb-link`, `mb-code`, `mb-list-item`, `mb-blockquote`
- `mb-code-block`
