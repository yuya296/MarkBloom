# Widget Measure Contract

## 目的
- CodeMirror `WidgetType` 由来の描画で高さが変動したときに、座標計算ずれ（クリック位置ずれ・カーソルジャンプ）を再発させない。
- widget 追加時に「測定トリガー漏れ」を自動検知する。

## ルール
- `class ... extends WidgetType` には必ず次の宣言コメントを付ける。
  - `// cm-widget-measure: static`
  - `// cm-widget-measure: dynamic`
- `dynamic` を宣言した widget は、同一クラス内で `EditorView.requestMeasure()` を呼ぶトリガーを実装する。
  - 許容例: `requestMeasure(...)`, `requestEditorMeasure(...)`, `ResizeObserver(...)`

## 実装ガイド
- `static`:
  - DOM サイズが初期描画後に変わらない widget（list marker, checkbox, table widget など）
- `dynamic`:
  - 非同期レンダリングや画像読み込みでサイズが変わる widget（Mermaid, image widget など）
  - 典型パターン:
    - 非同期描画後に `requestMeasure()`
    - `ResizeObserver` で高さ変化を監視し `requestMeasure()`

## 自動チェック
- コマンド: `pnpm check:widget-measure`
- 実装: `scripts/check-widget-measure-contract.mjs`
- 検知内容:
  - 宣言コメント欠落
  - `dynamic` 宣言に対する測定トリガー欠落

## CI 連携
- `.github/workflows/ci.yml` で `Widget Measure Contract` ステップとして実行。
- 失敗時は CI を落としてマージをブロックする。

## トラブルシュート
- 症状:
  - 行クリック時に隣接行へキャレットが入る
  - テーブル操作後に上下キーで大きくジャンプする
- 初手確認:
  - `pnpm check:widget-measure`
  - 対象 widget が `dynamic` なのに `requestMeasure` が抜けていないか
  - CSS で `.cm-content` / `.cm-line` に幾何干渉（line-height の上書き等）がないか

## Links
- `docs/runbook/development-ops.md`
- `docs/runbook/cicd.md`
