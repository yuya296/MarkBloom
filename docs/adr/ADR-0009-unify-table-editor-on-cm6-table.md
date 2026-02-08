## Context
MarkBloom の table editor は `cm6-table` と複数の `cm6-table-editor-*` 実装が混在しており、`webview-demo` と `vscode-extension` でも依存先が分かれていた。  
この状態は、依存ライブラリの増加・ビルド負荷・保守範囲の拡大を招き、今後の table editor 改修時に判断コストを上げる。

## Options considered
- 複数実装を維持する - 比較検証はしやすいが、依存と実装の重複保守が継続する。
- `cm6-table` に統一する - 依存と実装を集約できるが、他実装の互換レイヤは失われる。

## Decision
table editor は `cm6-table` に単一統一し、`cm6-table-editor-*` 実装と関連依存を削除する。  
`webview-demo` / `vscode-extension` の双方で `@yuya296/cm6-table` を利用する。

## Consequences
依存数とメンテナンス対象を削減でき、table editor の改修対象が明確になる。  
一方で、過去に利用していた外部テーブルライブラリベースの実装は再利用できなくなるため、将来再導入する場合は新規判断が必要になる。  
既存ドキュメントは本ADRと architecture/glossary を現行仕様の基準として扱う。

## References
- docs/architecture/overview.md
- docs/domain/glossary.md
- packages/cm6-table/src/index.ts
- packages/webview-demo/src/app.ts
- packages/vscode-extension/webview/src/main.ts
