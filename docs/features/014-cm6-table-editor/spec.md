# Feature 014: cm6-table editor

## 1. 目的
シンプルな table editor 体験を、
CM6拡張として `packages/cm6-table` で提供する。

## 2. スコープ
### In scope
- `packages/cm6-table` の新規追加
- 2モード操作（Navigation / Editing）
- 単一オーバーレイ入力でセル編集
- 行/列ハンドル表示（hover時）
- 行/列選択 + 右クリックメニュー（insert/delete）
- Markdownテーブルとの双方向同期
- `webview-demo` への新engine追加

### Out of scope
- 高機能DBテーブル機能（列タイプ、ビュー、フィルタ、ソート、集計）
- 複数レンジ編集
- 行列ドラッグリオーダー

## 3. 要件
- CM6本体へのフォーカス奪取を最小化する
- IME入力中に確定キーが誤動作しない
- 行/列ハンドルから選択し、選択状態で右クリックメニューを開ける
- Markdown本文にUI専用要素（ハンドル/仮想ヘッダ）を混入させない

## 4. 設計
- データモデル: `TableData` (`header`, `rows`, `alignments`)
- 編集UI:
  - Navigation: セル移動・選択
  - Editing: 単一`textarea`を選択セル上に配置
- 同期:
  - 編集コミット時に `buildTableMarkdown` で再構築して `view.dispatch`
  - ドキュメント更新後はWidget再構築

## 5. 受け入れ条件
- `cm6-table` を `webview-demo` で選択して表示可能
- Enter/F2で編集開始、Escで編集キャンセル、Tabでセル移動コミット
- 行/列ハンドルから全行/全列選択できる
- 右クリックメニューで行列の追加/削除が反映される
