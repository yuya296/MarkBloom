# cm6-live-preview-mermaid

Mermaid plugin for `@yuya296/cm6-live-preview-core`.

## Usage

```ts
import { livePreviewPreset } from "@yuya296/cm6-live-preview";
import { mermaidLivePreview } from "@yuya296/cm6-live-preview-mermaid";

const mermaid = mermaidLivePreview({
  mermaidTheme: "auto",
});

const extensions = [
  ...mermaid.extensions,
  livePreviewPreset({
    livePreview: {
      blockRevealEnabled: true,
      plugins: [mermaid.plugin],
    },
  }),
];
```

## Notes

- This package ships a base theme for Mermaid widgets and fenced-line hiding.
- You can override styles via:
  - `.cm-lp-mermaid`
  - `.cm-lp-mermaid-error`
  - `.cm-lp-mermaid-content`
  - `.cm-lp-mermaid-open-button`
  - `.cm-lp-mermaid-fence-line-hidden`
