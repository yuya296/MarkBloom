## Context
`webview-demo` と `vscode-extension` は `cm6-live-preview` を使いながら、同時に `cm6-live-preview-mermaid` と `cm6-table` を直接配線していた。  
この構成は導線が分散しやすく、依存判断が実装ごとに揺れやすい。

一方で、将来的な依存関係は機械的に禁止するのではなく、意図的な密結合も含めて根拠を持って判断できる運用にしたい。

## Decision
`cm6-live-preview` の `livePreviewPreset` に以下の option を追加し、配線導線を集約する。

- `mermaid?: boolean | MermaidLivePreviewPluginOptions`
- `table?: boolean | TableEditorOptions`
- `livePreview?: false | LivePreviewOptions`（`false` で live preview core を無効化）

App 側は `cm6-live-preview-mermaid` / `cm6-table` を直接 import せず、preset option 経由で有効化する。

また、今後の依存判断基準を次の順で適用する。

1. 機能上の必須依存か（利便性目的のみではないか）
2. 単体利用可能性を壊さないか
3. 変更頻度が連動しているか
4. 障害時の影響範囲が許容できるか
5. 公開APIの約束として妥当か

密結合を意図的に採用する場合は、PR または ADR に理由・期待効果・見直し条件を記録する。

## Consequences
- App の依存導線は `cm6-live-preview` 中心に単純化される。
- `mermaid` / `table` の有効化は preset option で明示できる。
- 依存判断は「全面禁止」ではなく、基準に沿って説明可能になる。
- `cm6-table` は当面 CM6 依存の独立拡張として維持する。

## References
- `packages/core/cm6-live-preview/src/index.ts`
- `apps/webview-demo/src/app.ts`
- `apps/vscode-extension/webview/src/main.ts`
- `docs/architecture/overview.md`
