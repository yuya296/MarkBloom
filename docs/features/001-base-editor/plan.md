# Plan: Feature 001 Base Editor (CM6 Markdown Webapp)

## 方針
- `apps/webview-demo` を追加し、ブラウザで動く最小構成にする
- Editor は「core + extensions 合成」で構築し、拡張差し替えは `Compartment` で行う
- 変更通知は全文で `onChange(fullText)` を呼ぶ
- UI は最小限（状態が分かる程度のトグル/数値入力）に留める

## 構成案
- `apps/webview-demo/src/createEditor.ts`
  - `createEditor({ parent, initialText, extensions, onChange })`
  - `Compartment` を内包して runtime で再設定
  - `extensions` の合成ポイントを明示
- `apps/webview-demo/src/app.ts`（または同等）
  - 初期テキストの投入
  - `onChange` で全文取得
  - 簡易 UI で拡張切替を検証
- `apps/webview-demo/index.html`（またはビルド入口）
  - 最小の画面構成

## 前提/未決
- ビルド/起動方法は既存リポジトリの方針に合わせる（詳細は実装時に確定）

## 変更点（想定）
- 新規パッケージ `apps/webview-demo` 追加
- 依存: `@codemirror/state`, `@codemirror/view`, `@codemirror/commands`, `@codemirror/lang-markdown`, `@codemirror/language`
- 将来の拡張に備えた `Compartment` 設計

## 受け入れ条件への対応
- Markdown 入力: CM6 EditorView の設置
- 初期テキスト: `createEditor` 引数で注入
- 変更通知: `onChange(fullText)` 実装
- extensions 差し替え: `Compartment.reconfigure()` で runtime 切替

## 依存/リスク
- CM6 の基本APIを最小限に限定（後続フェーズで拡張）
- UI は検証用途で簡素化

## テスト戦略
- 手動: 起動 → 入力 → onChange → 拡張切替を一通り確認
- 自動: なし（最小実装のため。必要に応じて後続で追加）

## ADR
- 不要（影響範囲が限定的で、トレードオフが小さいため）

## Links
- Spec: ./spec.md
- Tasks: ./tasks.md
