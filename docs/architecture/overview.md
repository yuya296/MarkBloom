# Architecture Overview

## Package map

| package | 役割 |
| --- | --- |
| `webview-demo` | CodeMirror6 のデモ（EditorState/EditorView/共通設定） |
| `vscode-extension` | VS Code 拡張。Webview で CM6 + MarkBloom 拡張を組み合わせる |
| `cm6-live-preview-core` | Markdown記号の表示状態を動的に切り替える（syntax hide / secondary / raw） |
| `cm6-markdown-semantics` | Markdown要素を検出して範囲に semantic class を付与する |
| `cm6-typography-theme` | semantic class に対する見た目（CSSテーマ）を提供する |
| `cm6-live-preview` | 上記3つを束ね、プリセットとして配布する |
| `cm6-table` | table editor UI（2モード編集 + 行列ハンドル） |

## Dependency DAG

```mermaid
graph TD
  webview-demo --> cm6-live-preview
  webview-demo --> cm6-table

  vscode-extension --> cm6-live-preview
  vscode-extension --> cm6-table

  cm6-live-preview --> cm6-live-preview-core
  cm6-live-preview --> cm6-markdown-semantics
  cm6-live-preview --> cm6-typography-theme
```

## Naming contract

- semantic class prefix は `mb-` に統一する
- `cm6-markdown-semantics` が class を付与し、`cm6-typography-theme` が見た目を定義する
