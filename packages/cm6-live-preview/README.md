# cm6-live-preview

Preset that bundles the Live Preview core with Markdown semantics and typography theme.

## Usage

```ts
import { livePreviewPreset } from "cm6-live-preview";

const extension = livePreviewPreset({
  livePreview: { blockRevealEnabled: true },
  semantics: { classPrefix: "mb-" },
  typography: { classPrefix: "mb-" },
});
```

## Dependencies

- cm6-live-preview-core
- cm6-markdown-semantics
- cm6-typography-theme
