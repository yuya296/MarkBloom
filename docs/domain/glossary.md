# 用語集

| 用語 | 定義 | メモ |
| --- | --- | --- |
| Document | VS Code拡張で編集中のMarkdownファイル。保存前・保存後の差分管理やUndoの基準となる。 | 常にUTF-8のテキストファイルで、他のデータソースは持たない。 |
| Source of Truth | 編集状態の正を表すMarkdownテキスト。Extension Host側で保持し、WebView表示よりも常に優先される。 | すべての操作は最終的にDocumentテキストへのパッチとして適用される。 |
| View | WebView内の描画状態。Documentを反映したリッチな表示で、ユーザー操作の入口になる。 | postMessageでExtension Hostと同期し、必要に応じて再レンダーする。 |
| Table | Markdown内のテーブル構造。セル内容・アラインメント・列幅などの整形ルールを持つ。 | ViewではリッチUIで表示し、Source of TruthではMarkdown記法として表現する。 |
| Inline editing | WebViewを介さず通常のテキストエディタでDocumentを編集するモード。 | VS Code標準のテキスト操作・補完をそのまま利用する。 |
| Table editing | WebView上の専用UIでテーブルを編集するモード。セル単位で操作し、結果をMarkdownパッチに変換する。 | read-onlyフェーズでは表示のみ、将来的に編集や整形を提供。 |
| Normalization / Formatting | テーブルやテキストを一定のルールで整形する処理。列幅・アラインメント・末尾空白・区切り線などを揃える。 | 編集結果をSource of Truthへ反映する前後で実行し、差分の見通しを良くする。 |
