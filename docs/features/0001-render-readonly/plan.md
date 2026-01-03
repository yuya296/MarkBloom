# Plan: Feature 0001 (Read-only Render)

## 実装方針
1. **Extension Activation**: Markdown Documentを開いたタイミングでWebViewパネルを生成し、Documentテキストを読み込む。複数エディタを開いても1ドキュメント1パネルを基本とする。
2. **Messaging Contract**: postMessageで `ready`, `renderDocument`, `log` を実装。初期ロードはExtension→WebViewの一方向。
3. **Markdown Transform**: MVPではExtension側でMarkdown→HTMLを変換し、テーブル部分のみ簡易的に装飾。将来の差分計算を見据えて変換処理を専用モジュールに分離する。
4. **Table Rendering**: WebViewではCSS/軽量JSで整形表示。read-onlyの証拠としてDOM要素に `data-readonly="true"` を付与し、UIから編集操作を受け付けない。
5. **Refresh Hooks**: VS Codeの `onDidSaveTextDocument` / `onDidChangeTextDocument` をフックし、Documentが対象ならWebViewへ最新内容を送り直す。

## 技術メモ
- Markdown変換は既存ライブラリ（例：`marked`）を使い、テーブル要素へ専用クラスを付与する。
- WebViewは`nonce`を使ってContent Security Policyを満たす。
- ロギングはVS Codeの `OutputChannel` とWebView上のconsole表示で最低限。

## 設計上の配慮
- Featureフラグ不要。read-onlyであれば既存Markdown表示への副作用は少ない。
- Source of TruthはVS Code Document。WebViewはDocument更新時のみ刷新し、状態を持たない。
- 後続Feature（テーブル編集）で差し替え可能なようモジュール境界を薄く保つ。

## 依存
- VS Code拡張エントリポイント（未実装ならこのFeatureで同時に用意）
- Markdownテーブルを含むサンプルファイル

## 完了条件
- 受け入れ基準を満たす自動テスト or 手動確認手順が定義されている。
- ドキュメント（glossary/overview/ADR）が更新済み。
