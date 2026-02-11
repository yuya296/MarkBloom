# cm6-typography-theme

CodeMirror 6 theme for semantic Markdown classes (provided by cm6-markdown-semantics).

## Usage

```ts
import { typographyTheme } from "@yuya296/cm6-typography-theme";

const extension = typographyTheme({ classPrefix: "mb-" });
```

## List marker options

```ts
const extension = typographyTheme({
  classPrefix: "mb-",
  listMarkerWidthCh: 1.5,
  listIndentStepCh: 2,
  listBulletColor: "var(--mb-list-marker-bullet-color)",
  listOrderedColor: "var(--mb-list-marker-ordered-color)",
});
```

## Notes

- This package only defines styling; it does not parse Markdown.
- Colors are intentionally minimal so host themes can override as needed.
