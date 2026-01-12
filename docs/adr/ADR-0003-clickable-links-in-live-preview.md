## Context
live preview 上のリンクをクリック可能にしたいが、CodeMirror のイベント処理が強く、単に <a> を出力してもクリックが通らない問題がある。

## Options considered
- CodeMirror のクリックハンドラで data-href を拾って開く - 実装が簡潔で既存構成に合わせやすいが、カスタム実装になる
- 既存のリンク系プラグインを導入する - 実装は楽だが依存と挙動の制約が増える
- 装飾レイヤで <a> を出力しブラウザのデフォルトに任せる - CodeMirror にクリックが阻害される可能性が高い

## Decision
semantics 側で data-href を付与し、editor 側で domEventHandlers を使ってリンクを開く方式にする。

## Consequences
リンククリックの挙動は独自実装になるが、Live preview の表示層を崩さずに確実にクリックできる。今後の挙動変更は webview-demo 側のハンドラ調整で対応する。

## References
- N/A
