# Feature 013: Tabulator Virtual Header Selection UI

## 1. 目的
Tabulator の `Selectable Cell Range with Clipboard` を維持しつつ、  
行/列に対する選択導線（ヘッダハンドル + 右クリックメニュー）を追加する。  
Markdown 上の実データと UI 用ヘッダは分離し、同期ロジックを単純化する。

## 2. スコープ
### In scope
- 列ヘッダー上部ハンドルの表示と操作
- 行ヘッダー側の同等操作（表示/選択/メニュー）
- ハンドルはホバー対象のみ表示
- ハンドルクリックで対象行/列を全選択
- 選択状態で右クリックしたときのみメニューを表示
- 仮想ヘッダは Markdown データとして扱わない
- 仮想ヘッダ部分の装飾最小化（背景/罫線なし）

### Out of scope
- セル単位メニューの高度化
- 複数レンジ同時編集 UX の最適化
- 並び替え/フィルタと Markdown 行番号の高度な対応
- Jspreadsheet 側への同一UI展開

## 3. 現状整理
- `cm6-table-editor-tabulator` は現在、素の Tabulator + range clipboard 構成
- 行ヘッダ列は独自実装を外しており、セル編集同期は `cellEdited` / `clipboardPasted` ベース
- `Enter` で編集開始できる設定（`editTriggerEvent: "dblclick"`）を採用

## 4. 要件
### 4.1 列ヘッダー
- 列ヘッダー上部にハンドルを表示できる
- 通常時は非表示、列ホバー時に対象列ハンドルのみ表示
- ハンドルクリックでその列全体を選択
- 選択後の右クリックで列メニュー表示

### 4.2 行ヘッダー
- 行ヘッダー（仮想）を表示する
- 通常時は非表示、行ホバー時に対象行ハンドルのみ表示
- ハンドルクリックでその行全体を選択
- 選択後の右クリックで行メニュー表示

### 4.3 データモデル
- Markdown コンテンツに行ヘッダ/列ヘッダ仮想要素を含めない
- 同期対象は「実テーブルセル」のみ

### 4.4 見た目
- 仮想ヘッダ部分に背景色/罫線を持たせない
- ホバー時のみハンドルらしい見た目（3本線など）を表示

## 5. 設計方針
### 5.1 仮想ヘッダ構成
- 列ヘッダ: Tabulator の header を利用（既存）
- 行ヘッダ: `rowHeader` を利用して仮想列として定義
- `rowHeader` は Markdown 変換対象から除外

### 5.2 選択モデル
- 基本は `selectableRange` を利用
- ハンドルクリック時は `addRange` で単一レンジを再構成
  - 列全体: `row 0..lastRow` の対象列
  - 行全体: `col 0..lastCol` の対象行
- 右クリックメニュー表示条件は「現在レンジが行全体/列全体」のときのみ

### 5.3 メニュー表示
- 列: `headerContext` / `headerContextMenu`
- 行: `rowHeader` 側 `cellContext` もしくは `rowContextMenu`
- メニュー項目は初期実装で最小（Insert/Delete中心）

### 5.4 同期
- 編集同期トリガーは継続:
  - `cellEdited`
  - `clipboardPasted`
- 行/列操作をメニューで実装する場合は、操作後に `commitFromTable` を呼ぶ

## 6. 懸念点と対策
- Range API 依存が増える  
  - 対策: 6.3 docs準拠で wrapper 化し、API呼び出し箇所を限定
- 行/列全選択の判定誤り  
  - 対策: `getRanges()` の境界判定ロジックを関数化してテスト
- 並び替え/フィルタ時の行位置ずれ  
  - 対策: まずは並び替え/フィルタ無効の前提で仕様固定
- キーボード競合（Enter/Shift+Arrow）  
  - 対策: `Enter` 編集優先、ヘッダ操作はポインタ中心に限定
- CSS破綻（Tabulator更新時）  
  - 対策: 内部クラス依存を最小化し、テーマを薄く保つ

## 7. 受け入れ条件（Acceptance Criteria）
- 列ヘッダホバー時に対象列ハンドルのみ表示される
- 行ヘッダホバー時に対象行ハンドルのみ表示される
- ハンドルクリックで対象行/列が全選択される
- 選択状態で右クリック時のみ行/列メニューが出る
- Markdown 変換に仮想ヘッダが混入しない
- 既存のセル編集・range clipboard・Enter編集開始が壊れない

## 8. 依存
- `tabulator-tables` 6.3 系
- `packages/cm6-table-editor-tabulator`
- `packages/webview-demo`（動作確認）

