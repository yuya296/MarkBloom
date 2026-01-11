## Context
軽量なテーブル編集UIを試すため、既存のtable-editor群を残しつつ新しい実装を追加したい。TanStack TableベースのReact実装と、依存ゼロのvanilla HTML table実装の両方をPoCとして用意し、比較検証する必要がある。いずれもMarkdownのテーブル構文をソースとして編集内容をCodeMirrorドキュメントへ反映する。

## Options considered
- 既存のtable-editor群のみ継続 - 追加コストなしだが軽量UIの評価ができない
- TanStack Tableのみ追加 - React依存が必須で、非Reactの軽量検証ができない
- vanilla HTML tableのみ追加 - 依存は軽いがReactベースの検証ができない
- TanStack Tableとvanillaの両方を追加 - 比較検証が可能

## Decision
`cm6-table-editor-tanstack` と `cm6-table-editor-vanilla` の2つを追加し、PoCとして並行評価する。両方ともMarkdownのtable構文をソースにし、編集はCodeMirrorドキュメントへ反映する。必須機能は表示/セル編集/ヘッダー編集/行追加/列追加とする。

## Consequences
実装とメンテのコストは増えるが、React依存の有無やUIの自由度を比較できる。将来の標準実装を決めるための判断材料になる。

## References
- N/A
