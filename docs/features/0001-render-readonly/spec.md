# Feature 0001: Open Markdown & Render Tables (Read-only)

## 背景 / Why
- テーブルを含むMarkdownをVS Code拡張で開いても、標準エディタでは可読性が低い。
- まずは開発回路を確立する目的で、WebViewでのリッチ表示に集中し、編集は行わない。
- Source of TruthはMarkdownテキストであることを守り、Viewは常に読み取り専用の投影とする。

## ユーザーストーリー
- VS Codeユーザーとして、Markdownファイルを開いたときにテーブルを整形されたUIで確認できる。
- 表示に遅延がなく、エディタでの通常のテキスト編集を邪魔しない。

## 受け入れ基準
1. Markdownファイル（`.md`）を開くと自動でWebViewパネルが起動し、Documentがレンダリングされる。
2. Markdown本文はViewでHTML化され、表（`|`記法）部分はセル境界・ヘッダーを持つテーブルUIとして表示される。
3. このFeatureではWebView上からDocumentへの編集は行えない（read-only）。
4. VS Code側でDocumentを編集・保存すると、WebViewがリロードされ最新状態を表示する。
5. レンダリング中にエラーが発生した場合はWebViewに簡潔なエラーメッセージが表示され、Extension Hostのログにも出力される。

## スコープ
- ✅ Markdown読み込み、WebView初期化、レンダリングロジック。
- ✅ テーブルの簡易パーサーまたは既存ライブラリを使ったHTML変換。
- ⛔ WebViewからの編集・差分送信。
- ⛔ 表の自動整形やフォーマットの保存。
- ⛔ 設定UIやフォーマットルールのカスタマイズ。

## 技術制約
- WebView内でのMarkdownレンダリングはCodeMirror 6を採用し、read-onlyモードで利用する。
- `codemirror-rich-markdoc` などのMarkdoc特化プラグインには依存しない（柔軟なテーブル拡張と将来の編集機能に備える）。

## リスク・懸念
- Largeファイルのレンダリングに時間がかかる可能性。初期フェーズでは簡易実装でも可。
- Markdown→HTML変換をWebView内で行うかExtension側で行うかの判断は別Featureで検討。

## 関連リンク
- `docs/domain/glossary.md`
- `docs/architecture/overview.md`
- （今後追加予定）ADR: WebViewは表示・操作、Source of TruthはMarkdown
