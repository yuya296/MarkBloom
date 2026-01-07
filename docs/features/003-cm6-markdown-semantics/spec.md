# Feature003 - CM6 Markdown Semantics

## 1. 目的

Markdown の構文要素を解析し、**semantic class** を付与することで
タイポグラフィやテーマが安定したクラス契約でスタイルを適用できるようにする。

- doc は SSOT のまま
- view のみに装飾を追加する

## 2. スコープ

### 対象パッケージ

- packages/cm6-markdown-semantics
  - Markdown 構文に対応した semantic class 付与
  - block/inline の区別に応じて line / mark を使い分ける

### 非対象

- Live Preview の記号 hide（cm6-live-preview-core の責務）
- CSS テーマ定義（cm6-typography-theme の責務）
- HTML へのレンダリングや別プレビューペイン

## 3. 付与ルール

### 3.1 line（cm-line / Decoration.line）

- `mb-blockquote`
- `mb-blockquote-level-1..n`
- `mb-code-block`
- `mb-list-item`
- `mb-list-item-level-1..n`
- `mb-task-checked`
- `mb-task-unchecked`
- `mb-heading-1..6`
- `mb-table`
- `mb-html-block`
- `mb-footnote-definition`

### 3.2 mark（span / Decoration.mark）

- `mb-strong`
- `mb-em`
- `mb-link`
- `mb-code`
- `mb-footnote-ref`

## 4. アルゴリズム

- syntaxTree を走査し、対象ノード範囲を判定
- block 要素は **行単位**で class を付与（Decoration.line）
- inline 要素は span に class を付与（Decoration.mark）
- 同一行で複数 class が重なる場合は **集合として合成**して付与

## 5. API

```ts
export type MarkdownSemanticsOptions = {
  classPrefix?: string;
};

export function markdownSemantics(options?: MarkdownSemanticsOptions): Extension;
```

## 6. 受け入れ条件

- 対象 Markdown 要素に対応する class が付与される
- line と mark の付与が意図通りに分離される
- class prefix を変更しても動作する
- typography theme とは同じ class prefix を共有する

## 7. 将来拡張

- （現状なし）
