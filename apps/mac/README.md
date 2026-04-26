# mac app (Tauri)

MarkBloom の mac ネイティブアプリ（Tauri 2）です。

## Features

- Markdown のローカルファイルを開く（Open）
- 編集内容をローカルファイルへ保存（Save）
- 新規ファイルを作成（New File）
- 検索/置換パネルを開く（Find / Replace）
- Line Wrap を切り替え（View > Toggle Line Wrap）
- Undo / Redo

ウィンドウ内は本文エディタのみで、操作は macOS のメニューバーに集約しています。
ファイル名と未保存マーク（`•`）はウィンドウタイトルに表示します。
`Cmd+W` でウィンドウを閉じてもアプリは終了せず、Dock アイコンをクリックするとウィンドウが復活します（アプリ終了は `Cmd+Q`）。

## Shortcuts (macOS)

- `Cmd+N`: New file
- `Cmd+O`: Open file
- `Cmd+S`: Save file
- `Cmd+W`: Close window
- `Cmd+F`: Find / Replace
- `Cmd+Alt+W`: Toggle Line Wrap
- `Cmd+Z`: Undo
- `Cmd+Shift+Z`: Redo

## Development

```sh
pnpm -C apps/mac dev
pnpm -C apps/mac tauri:dev
```

## Build

```sh
pnpm -C apps/mac build
pnpm -C apps/mac tauri:build
```

- v1 はローカル配布のみ（署名・Notarizationなし）
- ターゲットは Apple Silicon（`aarch64-apple-darwin`）
