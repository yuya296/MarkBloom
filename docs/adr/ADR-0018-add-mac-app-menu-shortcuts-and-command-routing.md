## Context
`apps/mac` は Open/Save ボタン中心の操作で、macOS ネイティブアプリとして期待されるメニューショートカット（Cmd+O/S/N/W/F/Z/Shift+Z など）が不足していた。
ウィンドウ内に独自のツールバー/フッター/設定パネルを置く構成は macOS のネイティブ体験から乖離するため、操作導線をどこに置くかを決める必要がある。

## Options considered
- WebView の keydown のみで実装する - 実装は軽いが、macOS メニューバー統合ができずネイティブ体験が弱い。
- Tauri Rust 側でメニュー/イベント配線を実装する - ネイティブ性は高いが、Rust とフロントの往復配線が増え変更コストが高い。
- Tauri JS Menu API でアプリメニューを構築し、フロントのコマンド関数へ直接配線する - ネイティブメニューを維持しつつ、既存フロント実装へ最小変更で統合できる。

## Decision
Tauri の JS Menu API（`@tauri-apps/api/menu`）を一次入口として採用し、各メニューアクションを `apps/mac/src/app.ts` のコマンド関数へ直接ルーティングする。
ウィンドウ内 UI は本文エディタのみとし、ツールバー/フッター/設定パネルは持たない。File/Edit/View 操作はすべて macOS のメニューバーから提供する。
- File: New (`Cmd+N`) / Open (`Cmd+O`) / Save (`Cmd+S`) / Close Window (`Cmd+W`, predefined)
  - macOS 慣例に合わせて、`Cmd+W` でウィンドウを閉じてもアプリは終了させない。Rust 側で `WindowEvent::CloseRequested` を捕捉して `prevent_close()` + `hide()` し、`RunEvent::Reopen`（Dock アイコンクリック）で `show()` + `set_focus()` する。アプリ終了は `Cmd+Q` を経路とする。
  - **更新（ADR-0019）**: `Cmd+N` は新規ウィンドウを開く挙動に変更（暫定の「現ウィンドウ untitled 置換」は廃止）。`prevent_close()` + `hide()` は `main` ラベルの初期ウィンドウのみに限定し、動的に作る `untitled-*` ウィンドウは `Cmd+W` で destroy する。
- Edit: Undo (`Cmd+Z`) / Redo (`Cmd+Shift+Z`) / Find / Replace (`Cmd+F`) / Cut/Copy/Paste/SelectAll (predefined)
- View: Toggle Line Wrap (`Cmd+Alt+W`, `CheckMenuItem` で現在状態をチェック表示)
- ファイル名と未保存マーク（`•`）は `getCurrentWindow().setTitle()` でウィンドウタイトルに反映する
- 非 Tauri（Web preview）では当該メニューは構築せず、フォールバック keydown も持たない（ブラウザ操作はビルド検証用のため最小化）

## Consequences
macOS でメニューバーから主要操作を統一実行でき、ショートカット要件を満たせる。ウィンドウ内ノイズが消え、エディタ領域を最大化できる。
入力導線の主軸が `app.ts` のコマンドルーターに集約されるため、今後のショートカット追加も同レイヤーでの管理が前提になる。
Open/New は dirty state 確認を経由する設計に固定される。
View > Toggle Line Wrap のチェック状態は `CheckMenuItem.isChecked()` の結果を真として扱う（ハンドラ側で UI 状態を二重管理しない）。

## References
- `apps/mac/src/app.ts`
- `apps/mac/src/createEditor.ts`
- `apps/mac/src-tauri/src/main.rs`
- `apps/mac/index.html`
- `apps/mac/src/style.scss`
- `apps/mac/README.md`
