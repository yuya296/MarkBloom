## Context
Markdown テーブル編集で「ヘッダを特別扱いしない」表示を保ちつつ、
列の追加/削除/移動といった実用操作を最小構成で提供したい。
既存の table editor 群ではヘッダ行が UI 上のヘッダとして扱われるため、
1 行目を通常行として扱う方針と相性が悪い。

## Options considered
- Jspreadsheet CE を採用し、ヘッダ/行番号を非表示にして 1 行目を通常行として表示 - 軽量、UI 拡張がしやすいが CSS/イベント調整が必要
- 既存 cm6-table-editor-vanilla を拡張して独自 UI を実装 - 依存は少ないが列操作 UI の実装コストが高い
- 既存の tabulator/handsontable/ag-grid ベースを流用 - 成熟した機能はあるがヘッダ特別扱いが残りやすい

## Decision
Jspreadsheet CE を採用し、ヘッダ/行番号を非表示、1 行目を通常行として描画し、
列操作 UI は 1 行目セルの装飾として提供する。

## Consequences
- Jspreadsheet CE と jsuites の依存が追加される
- ヘッダ非表示や 1 行目固定は CSS/イベント制御で実現する必要がある
- 列操作 UI はカスタム実装となり、挙動の検証が必要

## References
- docs/features/012-table-editor-jspreadsheet/spec.md
