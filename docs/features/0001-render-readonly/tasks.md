# Tasks: Feature 0001

| # | タスク | 詳細 / 出力 | 担当 | 状態 |
| - | --- | --- | --- | --- |
| 1 | Extension & Bridgeスキャフォールド | `activate`/`deactivate`定義、Markdownファイル検出、`bridge-vscode`エントリ提供 | TBD | Todo |
| 2 | Bridge Messaging契約 | `bridge-vscode`とcore間で `ready`/`renderDocument`/`log` を実装し将来の双方向APIを定義 | TBD | Todo |
| 3 | Core Markdownレンダリング | coreパッケージでMarkdown→CodeMirror/HTML変換とテーブル描画を実装 | TBD | Todo |
| 4 | Bridge UIアダプタ | WebViewでcoreをマウントし、CSP/nonceやread-only表示を制御。Electron BridgeのI/Fスケルトンを配置 | TBD | Todo |
| 5 | Document更新フック | 保存/変更イベントで最新MarkdownをBridgeへ送り、coreを再レンダリング | TBD | Todo |
| 6 | 手動確認手順 | VS Code/Electron展開の検証観点を追記し、READMEやdocsへリンク | TBD | Todo |
