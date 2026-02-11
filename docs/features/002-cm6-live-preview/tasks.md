# Tasks: Feature 002 cm6-live-preview-core

## 実装タスク
- `packages/core/cm6-live-preview-core` 作成
- `livePreview(options?): Extension` を実装
- `LivePreviewOptions` 型を定義
- Block/Inline の露出ゾーン算出
- Markdown 構文木から対象トークンを抽出
- コードブロック/インラインコードの除外
- `visibleRanges` に限定した装飾生成
- dim/hide の最小テーマを用意
- IME 中の装飾抑制（`view.composing`）
- 簡易デモ/検証手順のメモ

## Done（定義）
- ブロック記号が「カーソル行で露出 / それ以外で抑制」される
- インライン記号が「隣接で露出 / それ以外で抑制」される
- IME 入力中に致命的なカーソルジャンプ/入力欠落が発生しない
- 大きめの文書でも極端に重くならない（visibleRanges限定が効いている）

## Links
- Spec: ./spec.md
- Plan: ./plan.md
