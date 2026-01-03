# Architecture Overview

この拡張機能は、Markdownテキストを唯一のSource of Truthとして扱いながら、WebViewでテーブルをリッチ表示する構成を採用する。初期フェーズでは表示専用で、編集機能の追加を見据えて責務を分離している。

## コンポーネント境界

| コンポーネント | 役割 | 入出力 |
| --- | --- | --- |
| Extension Host | VS Code上で動作し、Documentの読み書き・差分適用を担う。Source of Truthを保持し、WebViewとの通信口になる。 | FS API、workspace events、postMessage(送信) |
| WebView (View) | MarkdownのレンダリングとUI表示。テーブルをリッチ化し、将来的な編集操作の入口となる。 | postMessage(受信/送信)、DOMイベント |
| Markdown Transform | Markdown → 表示用HTML、将来的には逆変換(パッチ生成)を担う純粋ロジック層。 | Markdown文字列、テーブルモデル、HTML/差分 |
| Storage | VS Code設定や将来的なキャッシュ、フォーマット設定を保持。 | VS Code globalState / workspaceState |

## 通信とメッセージ種別

postMessageでExtension HostとWebViewが疎結合に連携する。初期フェーズでは最低限のメッセージだけを扱う。

- `ready` (WebView → Extension): DOM準備完了通知。ExtensionはDocumentの内容を送る。
- `renderDocument` (Extension → WebView): Markdownテキストとメタ情報を渡し、レンダリングを指示。
- `requestRefresh` (WebView → Extension): VS Code側でDocument更新を検知したいときに発火。初期フェーズでは手動リフレッシュ程度。
- `log` (双方向): デバッグ用。イベントやエラーを表示してトラブルシュートを容易にする。

## データフロー

```
Open → Render → (Inline/Text edits in VS Code) → Apply patch → Save → Notify View
           ↓
        WebView表示 (read-only)
```

1. ユーザーがMarkdown Documentを開くとExtension Hostが内容を読み、WebViewを初期化する。
2. `renderDocument`メッセージでMarkdownがWebViewに渡され、Markdown TransformロジックでHTML化される。テーブルはリッチコンポーネントで表示するが編集はしない。
3. ユーザーがVS Codeテキストエディタで変更した場合、Extension Hostが差分をDocumentへ適用し、保存後に再度WebViewへ通知する。
4. 将来的にWebViewからの編集イベントが追加されても、すべてDocumentを通じて正規化・保存されるため整合性を保てる。
