# Feature 011: Table Editor Enhancements (Context Menu)

## 1. 目的
Markdown テーブルの編集体験を改善し、行/列の追加・削除・整列操作を **コンテキストメニュー**で行えるようにする。
既存の `cm6-table-editor-vanilla` に対する UX 強化として扱う。

## 2. スコープ
### In scope
- `packages/core/cm6-table-editor-vanilla` の UI 強化
- 行/列の追加・削除
- 列単位の align（Left/Center/Right）
- 既存の下部「Add row/column」ボタンの削除
- 既存のセル編集（inline）との統合

### Out of scope
- 高度な表整形（列幅の美観最適化など）
- 複数セル選択 / 範囲選択
- Markdown 方言の拡張対応

## 3. 成果物
- `packages/core/cm6-table-editor-vanilla` の UI/ロジック拡張
- 操作仕様ドキュメント（本資料）

## 4. 仕様（案）
### 4.1 UI 基本方針
- 行/列に対して「三点リーダー」アイコンの **Table Action Menu** を表示
- 既存の下部コントロールは撤去し、操作はメニューに集約
- メニューは **常時薄く表示**し、ホバー時に濃く表示

### 4.2 行操作
- 行ホバー時、左端に行アクションメニューを表示
- メニュー項目
  - Insert row above
  - Insert row below
  - Delete row
- Delete は即時反映（確認/Undo なし）
- 行メニューのドラッグで行順を入れ替え（ドロップ位置をライン表示）

### 4.3 列操作
- ヘッダホバー時、上部に列アクションメニューを表示
- メニュー項目
  - Insert column left
  - Insert column right
  - Delete column
  - Align: Left / Center / Right（列単位、サブメニュー）
- 列ハンドルのドラッグで列順を入れ替え（ドロップ位置をライン表示）

### 4.4 Align の反映
- Markdown の separator 行に `:---`, `---:`, `:---:` を用いて整列を保持
- 既存 `---` のみのテーブルは Left として扱う

### 4.5 表示条件
- 既存の table editor は常に widget 表示を維持する

## 5. 公開API（案）
```ts
export type TableEditorOptions = {
  enabled?: boolean;
  renderMode?: "widget" | "none";
};
```

## 6. 受け入れ条件（Acceptance Criteria）
- 行/列の追加・削除がメニュー操作で可能
- 下部の Add row/column ボタンがなくなる
- 列 align の変更が反映され、Markdown へ保存される
- 既存のセル編集フローを阻害しない

## 7. 依存
- 既存 CM6 / `cm6-table-editor-vanilla` のみ

## 8. 留意事項
- UI のトリガー位置（常時表示 or ホバー表示）は最終調整対象
