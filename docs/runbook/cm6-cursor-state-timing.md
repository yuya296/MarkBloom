# CM6 Cursor/State Timing Guide

## 目的
- CodeMirror 6 の `update.startState` / `update.state` の使い分けミスによる、カーソル移動系の不具合を防ぐ。
- 「動いているように見えるが特定条件で破綻する」実装をレビューとテストで早期検出する。

## 前提（用語）
- `update.startState`: トランザクション適用前の state。
- `update.state`: トランザクション適用後の state。
- `prevSelection`: `update.startState.selection.main`
- `currentSelection`: `update.state.selection.main`

## 典型的な失敗パターン
1. 判定をすべて `update.state` で行う
   - 例: 「移動開始時は raw だったか」を移動後の state で判定してしまい、補正が発火しない。
2. イベント方向と補正ロジックの対象方向が一致していない
   - 例: `ArrowUp` でも補正ループを走査してしまい、不要な負荷と意図不明の分岐が残る。
3. 補正ロジックと UI イベント処理が分離されすぎている
   - 方向・開始条件・境界条件が複数箇所で分散し、変更時に片方だけ更新される。

## 実装ルール
1. 「移動開始時の条件」は `update.startState` で判定する
   - 例: raw/rich 判定、複数選択判定、開始カーソル位置。
2. 「移動結果の位置」は `update.state` を基準に確定する
   - 例: `currentHead`、`doc.length` クランプ。
3. 補正対象の入力イベントは最小化する
   - 今回の画像ブロック補正は `ArrowDown` のみ対象。
   - 対象外キーは早期 return して走査しない。
4. 補正決定は pure function に寄せる
   - `prevHead/currentHead/対象範囲/方向/開始時raw` を入力にし、`adjustedHead | null` を返す。
5. updateListener での副作用は dispatch のみに限定する
   - 条件判定・分岐は関数化し、listener は I/O 境界として扱う。

## テストルール
1. ロジック層（pure function）を単体テストする
   - 上から侵入時に上端へ補正される。
   - ブロック内部から下端到達時に下へ抜ける。
   - 開始時 raw なら補正しない。
2. 方向ガードをテストする
   - 対象外キーで補正判定が有効化されない。
3. 既存挙動の回帰を最小ケースで維持する
   - 複数選択時に selection を潰さない。
   - doc 末尾で範囲外に出ない。

## レビュー時チェックリスト
- 開始条件が `startState` になっているか。
- 結果判定が `state` になっているか。
- 対象外イベントで早期 return できているか。
- 補正ループ内で不要な重い処理をしていないか。
- 同じ仕様を説明するテストが追加されているか。

## 変更時の最低確認コマンド
- `pnpm -C packages/core/cm6-live-preview-core test`
- `pnpm -C apps/webview-demo test`
- `VITE_BASE_PATH=/MarkBloom/pr-<number>/ pnpm -C apps/webview-demo build`

## 関連
- `packages/core/cm6-live-preview-core/src/inline/imageBlockCursorNavigation.ts`
- `packages/core/cm6-live-preview-core/src/inline/imageBlockNavigationLogic.ts`
- `packages/core/cm6-live-preview-core/tests/imageBlockNavigation.test.ts`
