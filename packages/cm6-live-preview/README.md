# cm6-live-preview

Preset that bundles the Live Preview core with Markdown semantics and typography theme.

## Usage

```ts
import { livePreviewPreset } from "@yuya296/cm6-live-preview";

const extension = livePreviewPreset({
  livePreview: { blockRevealEnabled: true },
  semantics: { classPrefix: "mb-" },
  typography: { classPrefix: "mb-" },
});
```

## Dependencies

- @yuya296/cm6-live-preview-core
- @yuya296/cm6-markdown-semantics
- @yuya296/cm6-typography-theme
