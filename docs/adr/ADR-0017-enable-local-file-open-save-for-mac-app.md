## Context
`apps/mac` の初期MVPは `sample.md` 固定表示のみで、実ファイルを開いて編集結果を保存できなかった。  
mac ネイティブアプリとして最低限の実用性を満たすため、ローカル Markdown の読み込み/保存機能を追加する必要がある。

## Options considered
- フロントエンドのみで完結させる - Web API 制約があり、ネイティブのファイルダイアログ連携が不十分。
- Tauri の dialog plugin + Rust command で実装する - 最小UIを維持しつつ、ローカルファイル入出力を安全に追加できる。
- fs plugin まで含めて全面的に権限を開放する - 実装は簡単だが、MVP段階では権限範囲が広すぎる。

## Decision
`apps/mac` に Open/Save ボタンを追加し、ファイル選択は `tauri-plugin-dialog` で行う。  
ファイル読み書きは Rust の `#[tauri::command]` を介して実施し、capability は `dialog:default` のみを追加する。  
読み込み/保存後はエディタの baseline を更新し、差分表示とステータス表示を最新状態に同期する。

## Consequences
- `apps/mac` でローカル Markdown の読み込み/保存が可能になる。
- Tauri 側に dialog plugin とファイルI/Oコマンドが追加される。
- 依存として `@tauri-apps/api` / `@tauri-apps/plugin-dialog` / `tauri-plugin-dialog` が増える。

## References
- `apps/mac/src/app.ts`
- `apps/mac/src/createEditor.ts`
- `apps/mac/index.html`
- `apps/mac/src-tauri/src/main.rs`
- `apps/mac/src-tauri/capabilities/default.json`
