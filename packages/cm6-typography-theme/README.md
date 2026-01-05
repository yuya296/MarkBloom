# cm6-typography-theme

CodeMirror 6 theme for semantic Markdown classes (provided by cm6-markdown-semantics).

## Usage

```ts
import { typographyTheme } from "cm6-typography-theme";

const extension = typographyTheme({ classPrefix: "mb-" });
```

## Notes

- This package only defines styling; it does not parse Markdown.
- Colors are intentionally minimal so host themes can override as needed.
