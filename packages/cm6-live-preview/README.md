# cm6-live-preview

Live Preview for CodeMirror 6 that keeps Markdown as the source of truth and transforms only the view using Decorations/Widgets.

## Concepts

- doc: Markdown source string (truth)
- state: doc + configuration + parse results (EditorState)
- view: DOM rendering of state (EditorView)
- renderState (per element): preview or edit

Live Preview never mutates doc; it only changes view.

## Render states

- preview: hide syntax tokens or render labels for a richer appearance
- edit: show raw Markdown for safe editing

Render state is evaluated per element (inline/block), not globally.

## Triggers (preview -> edit)

Priority: Selection > Block > Proximity

- selection: any element intersecting a selection range
- block: block element containing the cursor (requires blockRevealEnabled)
- proximity: inline element near the cursor (within N characters)
- always: always edit

## Display styles

- hide: replace tokens to hide them (view-only)
- color-secondary: add `mb-syntax-secondary` class for theme styling
- widgetLabel: replace with a label and `mb-preview-widget` class
- none: no change

## Configuration

Element rules are defined in `src/config.ts`.

Example (simplified):

| Element | Trigger | Preview | Edit |
| --- | --- | --- | --- |
| Headings | selection / block | hide | color-secondary |
| Bold | selection / proximity | hide | color-secondary |
| List markers | always | color-secondary | color-secondary |

## Options

`livePreview(options?: LivePreviewOptions)`

```ts
export type LivePreviewOptions = {
  inlineRadius?: number;
  inlineRadiusBefore?: number;
  inlineRadiusAfter?: number;
  blockRevealEnabled?: boolean;
  exclude?: { code?: boolean };
};
```

## Notes

- Decorations and Widgets are view-only and do not affect undo/redo.
- cm6-live-preview does not define colors; themes should style classes such as `mb-syntax-secondary` and `mb-preview-widget`.
