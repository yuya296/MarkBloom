## Context
既存のテーブル編集では、
- vanilla実装: CM6とのフォーカス競合やIME境界で操作感が不安定になりやすい
- ライブラリ実装(tabulator/jspreadsheet): 基本機能は高いが、Notionライクな軽量UIへ寄せる際に内部DOM/CSS依存が増えやすい
という課題があった。

今回の狙いは「NotionのDBではない、ライトなテーブル体験」を
長期保守性を保ちながら実現すること。

## Options considered
- 既存ライブラリ実装を主軸に継続: 初速は高いがUI再現の上限と依存リスクが残る
- 完全独自実装(ゼロから): 自由度は高いが工期・品質リスクが高い
- 新規 `cm6-table` を追加し、データ同期ロジックは再利用しつつUI層を独自実装: バランスが良い

## Decision
`packages/cm6-table` を新規追加する。

方針:
- 公開APIは `tableEditor()` を維持
- Markdown同期/テーブルデータモデルは既存方針を踏襲
- UIは Notionライクなライトテーブルとして独自実装
- 入力モデルは 2モード（Navigation / Editing）+ 単一オーバーレイエディタで、
  フォーカス競合とIMEリスクを下げる

## Consequences
- 新パッケージの追加で保守対象は増える
- ただし、ライブラリ内部DOMへの依存を減らし、UI制御の自由度を確保できる
- 既存 engine を残した比較運用が可能になり、移行判断を段階的に実施できる

## References
- docs/features/014-cm6-table-notion-lite/spec.md
- docs/features/014-cm6-table-notion-lite/tasks.md
