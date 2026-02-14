# cm6-live-preview-mermaid

Mermaid plugin for `@yuya296/cm6-live-preview-core`.

## Usage

```ts
import { livePreviewPreset } from "@yuya296/cm6-live-preview";
import { mermaidLivePreviewPlugin } from "@yuya296/cm6-live-preview-mermaid";

const extension = livePreviewPreset({
  livePreview: {
    blockRevealEnabled: true,
    plugins: [mermaidLivePreviewPlugin()],
  },
});
```
