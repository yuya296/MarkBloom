# Feature 010: cm6-table-editor-vanilla (テーブル描画・編集)

## 1. 目的
Markdown テーブルを、CM6 上で **リッチ表示（グリッド）**し、段階的に **編集**できるようにする。
（Live Preview の一部として扱うが、複雑性が高いためパッケージ分離する。）

## 2. スコープ
### In scope
- CM6 Extension（VS Code 非依存）
- テーブルブロック検出
- 表示：Widget 化してグリッド描画
- 編集：段階導入（v1: ソースへ戻す / v2: セル編集）
- 列幅の自動調整（セル内容に応じて）
- セル内改行（表示・編集）

### Out of scope
- すべての Markdown 方言（GFM以外）への完全対応
- 高度な整形（列幅計算や美観最適化）は後回し

## 3. 成果物
- `packages/cm6-table-editor-vanilla`
  - `tableEditor(options?): Extension`
  - テーブル表示 Widget
  - テーブル→AST（内部表現）→Markdown 生成（v2以降）

## 4. 段階仕様
### 4.1 v1: Table Viewer（表示優先）
- テーブル範囲を検出し、Widget でリッチ表示
- Widget 表示を維持しつつ、セル単位の操作へ移行する

### 4.2 v2: Cell Editor（編集）
- セルクリックで編集UI（input/textarea等）を出す
- 編集結果を Markdown の該当範囲に差分適用
- 行/列追加削除は v2 末または v3

## 5. 公開API（案）
```ts
export type TableEditorOptions = {
  enabled?: boolean;
  renderMode?: "widget" | "none";
  // 将来：フォーマッタ差し替えなど
};

export function tableEditor(options?: TableEditorOptions): Extension;
```

## 6. 受け入れ条件（Acceptance Criteria）
- テーブルが Widget で視認性高く表示される
- v1 の動作として「テーブル内にカーソル → ソース表示へ戻る」が安定する
- v2 ではセル編集ができ、編集結果が Markdown として保存可能
- セル内容に応じた列幅に自動調整される
- セル内改行が表示・編集できる

## 7. 依存
- CM6 core
- 依存ゼロで実装し、UIライブラリは持ち込まない
