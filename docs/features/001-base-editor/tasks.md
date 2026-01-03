# Tasks: Feature 001 Base Editor (CM6 Markdown Webapp)

## 実装タスク
- `packages/editor-core` 作成
- 依存追加（CM6一式）
- `index.html` とエントリーファイルを追加
- `createEditor({ parent, initialText, extensions, onChange })` 実装
- `@codemirror/lang-markdown` を組み込み
- `initialText` を反映
- `onChange(fullText)` の呼び出し
- `Compartment` を組み込み、runtime で拡張差し替え
- 簡易 UI（トグル/数値入力など）で拡張切替を検証
- 起動方法と手動検証手順の簡易メモ

## Done（定義）
- ブラウザで Markdown を入力できる
- 初期テキストを渡して表示できる
- 編集すると `onChange(fullText)` が呼ばれる
- 設定変更で extensions を runtime で差し替えできる

## Links
- Spec: ./spec.md
- Plan: ./plan.md
