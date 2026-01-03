# Plan: Feature 0001 (Read-only Render)

## 実装方針
1. **Extension Activation**: Markdown Documentを開いたタイミングでWebViewパネルを生成し、Documentテキストを読み込む。複数エディタを開いても1ドキュメント1パネルを基本とする。WebViewへは`bridge-vscode`のエントリを配信する。
2. **Bridge-Messaging Contract**: Bridge層で `ready`, `renderDocument`, `log` を実装し、coreへのpropsとしてMarkdownやメタ情報を渡す。Extension→Bridgeの一方向から始め、Bridge→Extensionへの将来拡張を想定したAPI面を整理する。
3. **Core Markdown Transform**: core内にMarkdown→HTML/CodeMirror state変換を持たせ、bridgeからはMarkdown文字列を渡す。テーブル描画はcoreの責務とし、他ホストでも流用可能にする。
4. **Bridge Rendering Adapter**: `bridge-vscode`ではcoreをReactでマウントし、VS Code messagingとDOMの紐付け・nonce/CSP管理・read-only属性付与を担う。Feature 0001ではElectron向けBridgeのスケルトン(インターフェース)のみ用意する。
5. **Refresh Hooks**: VS Codeの `onDidSaveTextDocument` / `onDidChangeTextDocument` をフックし、Documentが対象なら最新内容をBridgeに送る。Bridgeは受信するとcoreを再描画する。

## 技術メモ
- Markdown変換は既存ライブラリ（例：`marked`）やCodeMirrorプラグインをcore内部で使い、テーブル要素へ専用クラスを付与する。
- Markdown→HTMLは `marked` + DOMPurify でHTML化し、CodeMirrorによる編集系は後続Featureで検討する。
- WebViewは`nonce`を使ってContent Security Policyを満たす。Electron向けBridgeは同じcore APIを呼べるよう、通信I/Fだけ定義する。
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
