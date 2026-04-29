## Context

ADR-0018 で `Cmd+N` を「現在のウィンドウを untitled に置換 + dirty 確認」とした暫定挙動にしていた（PR #89）。一方 macOS のドキュメント編集アプリ（TextEdit, Xcode, VS Code 等）の慣例は `Cmd+N` で **独立した新規ウィンドウを開く**。複数ファイルを並行編集したいというユーザ要望もあり、native multi-window 体験へ拡張する（issue #104）。

## Options considered

- (i) 現状維持（暫定）: macOS 体験から遠い。
- (ii) フロント主導 `WebviewWindow` 動的生成: 既存 `setupApp()` をウィンドウ毎に走らせるだけで済む。各 webview は独立した JS context を持つので状態は自然にウィンドウローカル。
- (iii) Rust 側 command で `WebviewWindowBuilder` を呼ぶ: 追加の往復配線が増えるが、将来的なライフサイクル管理に強い。

## Decision

- **(ii) フロント主導の `WebviewWindow` 動的生成** を採用。
- `Cmd+N` のハンドラで `new WebviewWindow(label, opts)` を呼び、新規ウィンドウは `index.html` を再ロード。各ウィンドウで `setupApp()` が独立に走る。ラベルは `untitled-${timestamp}-${rand}` で衝突回避、初期位置は呼び出し元ウィンドウから +28px のカスケードオフセット。
- **アプリメニューはフォーカス変更ごとに再構築する**。`Menu.setAsAppMenu()` はアプリ全体に1つしか存在せず、handler 内のクロージャは「メニューを最後に build した webview」を指す。各ウィンドウの `setupApp()` で `getCurrentWindow().onFocusChanged({focused})` を購読し、focused 時に当該ウィンドウローカルな state（`wrapLines` 等）でメニューを再構築。これにより View > Toggle Line Wrap のチェック状態と各 action handler が常にアクティブウィンドウと一致する。
- **CloseRequested の挙動**: Rust 側で `window.label() == "main"` の場合のみ `prevent_close()` + `hide()`、それ以外（動的に作った `untitled-*` ウィンドウ）は default の destroy。これにより main は Dock reopen の戻り先として温存しつつ、ユーザは `Cmd+W` で個別ドキュメントを閉じられる。
- **状態管理**: `currentFilePath` / `currentFileLabel` / `baselineText` / `wrapLines` は全てウィンドウローカル（webview ごとに JS context 分離されているため自動的にそうなる）。`wrapLines` の永続化やウィンドウ間共有は本 PR スコープ外、別 issue で再検討。
- **ファイル open の挙動**: 本 PR ではアクティブウィンドウで dirty 確認の上 open する現状を維持。「同一ファイル既開なら focus、無ければ新規ウィンドウで open」は別 issue で扱う。
- **Capabilities**: `windows: ["main"]` から `["main", "untitled-*"]` に拡張し、動的に作った editor ウィンドウからも `dialog` 等の plugin を使えるようにする。さらに `core:default` には webview 動的生成系の permission が含まれていないため、`core:webview:allow-create-webview-window` と、新ウィンドウから呼ぶ `core:window:allow-{outer-position,set-title,set-focus,show,hide}` を明示的に追加する（dev で `Cmd+N` 発火時に "webview.create_webview_window not allowed. Permission denied" で失敗したため）。

## Consequences

- macOS の native multi-window 体験を提供できる。
- `setAsAppMenu()` 再構築のコストはフォーカス変更時のみ発生。実機で UI ちらつきが気になる場合は将来 `CheckMenuItem.setChecked()` のみで同期する設計へ切り替え可能（その場合は action handler を `WebviewWindow.getFocusedWindow()` で動的解決する形になる）。
- main ウィンドウは `Cmd+W` で hide される（destroy されない）暫定挙動を継続。Dock reopen で復帰すると、閉じたつもりのドキュメントが復活して見える可能性は残る。気になれば「main も destroy できる設定」を別 issue で検討。
- 動的ウィンドウは destroy されるため、Cmd+W で閉じた直後に `File > Reopen Closed Window` 的な復元 UI は持たない。これも別 issue 候補。
- capabilities をワイルドカード化したため、将来的に新しい permission を追加する際は label 単位での切り分け設計を検討する。

## Follow-ups (別 issue 候補)

- ファイル open の挙動を「同一ファイル既開ならフォーカス、無ければ新規ウィンドウ」に変更
- `File > Reopen Closed Window` (`Cmd+Shift+T`) で閉じたウィンドウを復元
- `wrapLines` 等のユーザ設定の永続化（localStorage / Tauri Store）

## References

- apps/mac/src/app.ts
- apps/mac/src-tauri/src/main.rs
- apps/mac/src-tauri/capabilities/default.json
- ADR-0018
- Issue #104
