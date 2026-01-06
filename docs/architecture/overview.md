# Architecture Overview

## Package map

| package | 役割 |
| --- | --- |
| `editor-core` | CodeMirror6 の土台（EditorState/EditorView/共通設定） |
| `cm6-live-preview-core` | Markdown記号の表示状態を動的に切り替える（syntax hide / secondary / raw） |
| `cm6-markdown-semantics` | Markdown要素を検出して範囲に semantic class を付与する |
| `cm6-typography-theme` | semantic class に対する見た目（CSSテーマ）を提供する |
| `cm6-live-preview` | 上記3つを束ね、プリセットとして配布する |

## Dependency DAG

```
editor-core
  ↑（アプリ/VSCode/webview 等が利用）

cm6-live-preview
  ├─ depends on: cm6-live-preview-core
  ├─ depends on: cm6-markdown-semantics
  └─ depends on: cm6-typography-theme

cm6-typography-theme
  └─ depends on: (CodeMirror view系)

cm6-markdown-semantics
  └─ depends on: (CodeMirror language系 / markdown parser系)

cm6-live-preview-core
  └─ depends on: (CodeMirror state/view系)
```

## Naming contract

- semantic class prefix は `mb-` に統一する
- `cm6-markdown-semantics` が class を付与し、`cm6-typography-theme` が見た目を定義する
