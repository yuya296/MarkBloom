# Plan: Feature 002 cm6-live-preview-core

## 方針
- CM6 Extension として提供し、VS Code 非依存で完結させる
- 可視化ゾーン（Block/Inline）を `selection.head` と `visibleRanges` から算出
- 装飾は dim を基本にし、必要なら hide を追加できる設計にする
- IME 中は装飾更新を抑制し、入力安定性を優先する

## 構成案
- `packages/core/cm6-live-preview-core/src/index.ts`
  - `livePreview(options?): Extension`
  - `LivePreviewOptions`
- `packages/core/cm6-live-preview-core/src/decorations.ts`
  - `visibleRanges` に限定した装飾生成
  - Block/Inline の対象判定
- `packages/core/cm6-live-preview-core/src/theme.css`（または `theme.ts`）
  - dim/hide の最小テーマ

## 変更点（想定）
- 新規パッケージ `packages/core/cm6-live-preview-core` 追加
- `@codemirror/state/view/language` への依存追加
- `@codemirror/lang-markdown` の構文木を利用

## 受け入れ条件への対応
- ブロック記号の露出制御: カーソル行のみ表示
- インライン記号の露出制御: `inlineRadius` 近傍のみ表示
- IME 安定性: `view.composing` 中は装飾抑制
- 性能: `visibleRanges` 範囲でのみ計算

## テスト戦略
- 手動: 大きめ文書でスクロールし、露出制御が追従することを確認
- 手動: IME 入力中にカーソルジャンプや入力欠落がないことを確認
- 自動: なし（必要に応じて後続で `ViewPlugin` のユニットテスト追加）

## ADR
- 不要（影響範囲が限定的で、トレードオフが小さいため）

## Links
- Spec: ./spec.md
- Tasks: ./tasks.md
