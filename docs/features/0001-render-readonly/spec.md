# Feature 0001: Open Markdown & Render Tables (Read-only)

## 背景 / Why
- テーブルを含むMarkdownをVS Code拡張で開いても、標準エディタでは可読性が低い。
- まずは開発回路を確立する目的で、WebViewでのリッチ表示に集中し、編集は行わない。
- Source of TruthはMarkdownテキストであることを守り、Viewは常に読み取り専用の投影とする。

## ユーザーストーリー
- VS Codeユーザーとして、Markdownファイルを開いたときにテーブルを整形されたUIで確認できる。
- 表示に遅延がなく、エディタでの通常のテキスト編集を邪魔しない。
- 将来的にElectron版アプリでも同じリッチビューを再利用できるよう、UIコアはホスト非依存で動作する。

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

## アーキテクチャ指針
- `core`: React + CodeMirror 6を用いたホスト非依存ビュー。Markdownのレンダリングとread-only UIのみを担当し、将来的な編集機能追加にも流用できる構造を保つ。
- `bridge`: ホストごとの通信・ライフサイクルを吸収する層。Feature 0001ではVS Code WebView向け(`bridge-vscode`)を実装し、Electron向け(`bridge-electron`)は将来同じAPIで追加できるようにする。
- `extension`: VS Code拡張本体。Document管理、ファイルシステムアクセス、Bridgeへのメッセージ送信をまとめる。

## 技術制約
- コアビューはCodeMirror 6のread-only構成を採用し、bridgeから渡されるMarkdown文字列だけで描画できるようにする。
- WebView内では`bridge-vscode`がcoreをマウントし、VS CodeのpostMessageチャネル以外の依存を持たない。
- `codemirror-rich-markdoc` などのMarkdoc特化プラグインには依存しない（柔軟なテーブル拡張と将来の編集機能に備える）。

## テスト戦略
- Large: VS Code拡張を手動でE2E確認する。Markdownファイルを開いてWebView表示・再描画・エラーハンドリングをチェックし、受け入れ基準を満たすことを確認する（自動化対象外）。
- Medium: coreの自動UIテストを含む。Playwright/React Testing LibraryでMarkdownサンプルを読み込み、CodeMirrorレンダリングやread-only属性、スクロール挙動を検証する。bridge-vscodeとextension間のメッセージ通信をモックして、`renderDocument`の受信からcore再描画までの結合テストを行う。
- Small: CodeMirror状態の生成やbridge-vscodeのメッセージハンドラ等をJestで単体テストする。Electron bridgeは今回のスコープ外なのでテスト対象から除外し、その旨をREADME/planへ記載しておく。

## リスク・懸念
- Largeファイルのレンダリングに時間がかかる可能性。初期フェーズでは簡易実装でも可。
- Markdown→HTML変換をWebView内で行うかExtension側で行うかの判断は別Featureで検討。

## 関連リンク
- `docs/domain/glossary.md`
- `docs/architecture/overview.md`
- （今後追加予定）ADR: WebViewは表示・操作、Source of TruthはMarkdown
