# Tasks: Feature 013 Tabulator Virtual Header Selection UI

## 実装タスク
- `packages/cm6-table-editor-tabulator` に `rowHeader` を追加
- 列ヘッダハンドル描画（ホバー時のみ表示）
- 行ヘッダハンドル描画（ホバー時のみ表示）
- 列ハンドルクリック時の「列全選択」実装
- 行ハンドルクリック時の「行全選択」実装
- `getRanges()` ベースで「行全体/列全体選択」判定関数を実装
- 右クリックメニューの表示条件を選択状態連動にする
- 列メニュー最小項目（Insert left/right, Delete）を実装
- 行メニュー最小項目（Insert above/below, Delete）を実装
- 行/列メニュー操作後の `commitFromTable` 同期を保証
- 仮想ヘッダ（rowHeader列）を Markdown 同期対象から除外
- 仮想ヘッダの装飾を最小化（背景/罫線なし、ホバー時のみハンドル可視化）
- 既存挙動（Enter編集開始、range clipboard）の回帰確認
- `webview-demo` で手動モンキーテスト手順を記録

## 検証タスク
- 列ホバー時に対象列ハンドルのみ表示されること
- 行ホバー時に対象行ハンドルのみ表示されること
- 列/行ハンドルクリックで全選択レンジになること
- 選択状態と右クリックメニュー表示条件が一致すること
- Markdown 出力に仮想ヘッダが混入しないこと
- `Ctrl/Cmd+C` / `Ctrl/Cmd+V` の range clipboard が維持されること
- `Enter` でセル編集開始できること

## Done（定義）
- Feature 013 の受け入れ条件を満たす
- `pnpm -C packages/cm6-table-editor-tabulator build` が成功
- `pnpm -C packages/webview-demo build` が成功
- `pm2 start ecosystem.config.cjs --update-env` で表示確認できる

## Links
- Spec: ./spec.md

