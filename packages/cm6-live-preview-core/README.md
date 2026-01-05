# cm6-live-preview-core

Live Preview for CodeMirror 6 that keeps Markdown as the source of truth and transforms only the view using Decorations/Widgets.

## Concepts

- doc: Markdown source string (truth)
- state: doc + configuration + parse results (EditorState)
- view: DOM rendering of state (EditorView)
- renderState (per element): preview or edit

Live Preview never mutates doc; it only changes view.

## Render states

- rich: hide syntax tokens for a richer appearance
- raw: show raw Markdown for safe editing

Render state is evaluated per element (inline/block), not globally.

## Triggers (rich -> raw)

Priority: Nearby > Block

- nearby: selection overlap or cursor near the element (N=1)
- block: block element containing the cursor (requires blockRevealEnabled)
- always: always raw
- never: always rich

## Display styles

- hide: replace tokens to hide them (view-only)
- none: no change

## Configuration

Element rules are defined in `src/config.ts`.

Example (simplified):

| Element | rawModeTrigger | rich | raw |
| --- | --- | --- | --- |
| Headings | nearby / block | hide | none |
| Bold | nearby | hide | none |
| List markers | always | none | none |

## Options

`livePreview(options?: LivePreviewOptions)`

```ts
export type LivePreviewOptions = {
  blockRevealEnabled?: boolean;
  exclude?: { code?: boolean };
};
```

## Notes

- Decorations and Widgets are view-only and do not affect undo/redo.
- cm6-live-preview-core does not define colors; themes should style classes such as `mb-syntax-secondary` and `mb-preview-widget`.
