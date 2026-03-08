# mac app (Tauri)

MarkBloom の mac ネイティブアプリ（Tauri 2）です。

## Features

- Markdown のローカルファイルを開く（Open）
- 編集内容をローカルファイルへ保存（Save）

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
