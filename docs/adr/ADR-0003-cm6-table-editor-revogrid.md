# ADR-0003: cm6-table-editor uses RevoGrid for v2

## Status
Accepted

## Context
Feature010 (cm6-table-editor) aims to provide a rich table viewer (v1) and inline cell editing (v2),
with a path to range selection and copy/paste in v3+. We need a table UI with editing support that
can be embedded as a CM6 widget without requiring React.

## Decision
Adopt RevoGrid (MIT licensed) as the table UI for v2+.

## Consequences
- We can implement v2 (single cell edit) quickly with a consistent grid UI.
- v3+ features like range selection and copy/paste remain feasible within the same library.
- We must manage Web Components styling (shadow DOM / CSS variables) and lifecycle in the widget.

## Alternatives Considered
- Tabulator: strong editing experience but heavier DOM and bundle size; still a fallback.
- AG Grid Community: high capability but heavier and clearer boundaries with enterprise features.
- No library (contenteditable): too much UX complexity for v2 and v3 features.
