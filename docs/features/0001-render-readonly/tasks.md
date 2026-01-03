# Tasks: Feature 0001

| #   | タスク                             | 詳細 / 出力                                                                                                                   | 担当 | 状態 |
| --- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 1   | Extension & Bridgeスキャフォールド | `activate`/`deactivate`定義、Markdownファイル検出、`bridge-vscode`エントリ提供                                                | Done | Done |
| 2   | Bridge Messaging契約               | `bridge-vscode`とcore間で `ready`/`renderDocument`/`log` を実装し将来の双方向APIを定義                                        | Done | Done |
| 3   | Core Markdownレンダリング          | coreパッケージでMarkdown→HTML変換とテーブル描画を実装                                                                         | Done | Done |
| 4   | Bridge UIアダプタ                  | WebViewでcoreをマウントし、CSP/nonceやread-only表示を制御。Electron BridgeのI/Fスケルトンを配置                               | Done | Done |
| 5   | Document更新フック                 | 保存/変更イベントで最新MarkdownをBridgeへ送り、coreを再レンダリング                                                           | Done | Done |
| 6   | 手動確認手順                       | VS Codeで`npm run build`→`F5`デバッグ、Markdownを開いてプレビューと差分再描画を確認。Playwrightでcore単体の描画を自動チェック | Done | Done |
