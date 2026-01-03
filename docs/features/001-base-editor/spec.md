# Feature 001: Base Editor (CM6 Markdown Webapp)

プロダクト名: `editor-core`

## 1. 目的
CodeMirror 6 を用いて、Markdown を編集できる **Webapp の最小実装（実装ベース）**を作る。
以降の `cm6-live-preview` / `cm6-table-editor` / VS Code Webview 統合の土台とする。

## 2. スコープ
### In scope
- CM6 による Markdown 編集（`@codemirror/lang-markdown`）
- 初期テキスト投入・編集・取得（全文）
- 拡張（Extension）の合成ポイントを明確化
- 実行時に設定を差し替え可能（Compartment 前提）
- 最低限の UI（textarea 的でよいが、状態が分かる）

### Out of scope
- VS Code との連携（Webview messaging / bridge）
- Live Preview（記号の露出制御）
- テーブルのリッチ表示・編集

## 3. 成果物
- `packages/editor-core`（名称は任意）
  - ブラウザで動く最小アプリ
  - `createEditor({ parent, initialText, extensions, onChange })` のような薄いラッパ
- 簡単な設定 UI（例：トグル/数値入力）※将来の差し替え確認用

## 4. 設計方針
- Editor は「コア + extensions 合成」で構築する
- 実行時設定変更を見据えて `Compartment` を用いる
- 変更通知は当面 **全文**で良い（差分は後続で検討）

## 5. 受け入れ条件（Acceptance Criteria）
- ブラウザ上で Markdown を入力できる
- 初期テキストを渡して表示できる
- 編集すると `onChange(fullText)` が呼ばれる
- 設定変更で extensions（例：テーマ）を runtime で差し替えできる

## 6. 依存
- `@codemirror/state`, `@codemirror/view`, `@codemirror/commands`
- `@codemirror/lang-markdown`, `@codemirror/language`

## 7. 留意事項
- ここでは “編集できる” を最優先。UXの作り込みは次フェーズで実施。
