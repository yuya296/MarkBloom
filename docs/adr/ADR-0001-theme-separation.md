# ADR-0001: Separate Live Preview Base Theme and Typography Theme

## Status
Accepted

## Context
Live Preview needs minimal styling for dim/hide behavior. At the same time, Markdown typography (headings, bold, links, quotes, etc.) should be customizable per host (editor-core, VS Code webview). Mixing these concerns in a single extension makes it harder to swap themes and align with host color systems.

## Decision
- `cm6-live-preview` will export `livePreview()` and `livePreviewBaseTheme()` for dim/hide styling only.
- `editor-core` will own the Markdown typography theme (`markdownTypographyTheme()`), including heading sizes, emphasis, link/quote styles, and host color strategy.

## Consequences
- Live Preview remains small and reusable, with minimal CSS surface.
- Typography can be swapped without touching Live Preview logic.
- Host-specific theming (VS Code-like, Obsidian-like, simple) stays localized in `editor-core` or future theme packages.

## Alternatives considered
- Single package owning both behavior and typography.
  - Rejected: increases coupling and makes host-specific theming harder.
