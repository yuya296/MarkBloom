## Context
Issue #19 で ` ```mermaid ` フェンスを Live Preview 上で図表示する要件が出た。  
`cm6-live-preview-core` に Mermaid 実装を直接入れると、core の責務が広がり、将来の block renderer 追加（Mermaid 以外）でも同じ問題が再発する。  
既存の `cm6-table` と同様に、機能を分離しつつ app 側で組み合わせる構成が必要になった。

## Options considered
- core に Mermaid を直接実装 - 導入は最短だが、core が特定 renderer に依存し、拡張時の変更コストが上がる。
- plugin 注入 API を core に追加し、Mermaid を別 package 化 - 初期実装は増えるが、責務分離と再利用性を保てる。

## Decision
`cm6-live-preview-core` に plugin 注入 API（`LivePreviewOptions.plugins`）を追加し、Mermaid は `@yuya296/cm6-live-preview-mermaid` として別 package で提供する。  
plugin 形状は `decorate(ctx) => decorations[]` の pure return 型を採用し、raw 判定 helper は core から context として提供する。  
plugin 例外は `onPluginError` で吸収し、エディタ描画は継続する。

## Consequences
- core は表示合成の責務に集中し、Mermaid 固有実装を分離できる。
- Mermaid 以外の block renderer を同じ API で追加できる。
- app 側は必要な plugin だけ注入できるため配線が明確になる。
- plugin API と error handling の保守責務が増える。

## References
- `packages/core/cm6-live-preview-core/src/index.ts`
- `packages/core/cm6-live-preview-core/src/options.ts`
- `packages/core/cm6-live-preview-core/src/plugins/types.ts`
- `packages/core/cm6-live-preview-mermaid/src/mermaidPlugin.ts`
- `apps/webview-demo/src/app.ts`
- `apps/vscode-extension/webview/src/main.ts`
