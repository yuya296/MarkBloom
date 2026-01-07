# Feature004 - CM6 Typography Theme

## 1. 目的

CodeMirror 6 (CM6) エディタの見た目を、MarkBloom のデザインガイドラインに沿った
**タイポグラフィテーマ**として提供する。Markdown は SSOT のまま、view 側の見た目のみ整える。

## 2. スコープ

### 対象パッケージ

- packages/cm6-typography-theme
  - CM6 用タイポグラフィテーマ定義（EditorView.theme）
  - cm6-markdown-semantics の class 契約に従ってスタイルを適用

### 非対象
- セマンティッククラス付与ロジック自体（cm6-markdown-semantics の責務）
- Live Preview の記号 hide 制御（cm6-live-preview-core の責務）
- HTML へのレンダリングや別プレビューペイン

## 3. 前提/依存

- `cm6-markdown-semantics` が付与する class を契約として利用する
- class prefix は `mb-` をデフォルトとする（差し替え可能）
- `cm6-markdown-semantics` と **同じ prefix を渡すことが必須**

## 4. 仕様（表示ルール）

### 4.1 付与される class（参照対象）
- line（cm-line / Decoration.line）に付与
  - `mb-blockquote`
  - `mb-code-block`
  - `mb-code-block-fenced`
  - `mb-code-block-indented`
  - `mb-code-block-first`
  - `mb-code-block-middle`
  - `mb-code-block-last`
  - `mb-list-item`
  - `mb-heading-1..6`
- span（Decoration.mark）に付与
  - `mb-strong`
  - `mb-em`
  - `mb-link`
  - `mb-code`

### 4.2 タイポグラフィ指針
- 見出しは行全体の見た目（サイズ/間隔）を調整する
- 引用は左線 + インデントを付ける
- コードは等幅フォントで読みやすくする
- 色は「ホストのカラースキームに追随」し、濃淡は最小限に抑える
- `.cm-content` 配下のみで効くようにスコープする

### 4.3 Markdown 要素ごとの対応

#### block 要素（line）
- Headings:
  - `mb-heading-1`: `font-size: 1.6em`
  - `mb-heading-2`: `font-size: 1.4em`
  - `mb-heading-3`: `font-size: 1.25em`
  - `mb-heading-4`: `font-size: 1.15em`
  - `mb-heading-5`: `font-size: 1.05em`
  - `mb-heading-6`: `font-size: 1em`
- Quote block:
  - `mb-blockquote`: `border-left: 3px solid var(--mb-quote-border-color, currentColor)`
  - `mb-blockquote`: `padding-left: 0.75rem`
  - `mb-blockquote`: `font-style: var(--mb-quote-font-style, normal)`
- Code block:
  - `mb-code-block`: 等幅フォント、背景/余白はテーマ側で定義
- List item:
  - `mb-list-item`: 行全体のインデント/余白を調整（テーマ側で定義）

#### inline 要素（span）
- Strong:
  - `mb-strong`: `font-weight: 700`
- Emphasis:
  - `mb-em`: `font-style: italic`
- Link:
  - `mb-link`: `text-decoration: underline`（色はテーマに委ねる）
- Inline code:
  - `mb-code`: `font-family: var(--mb-font-mono, ...)`
  - `mb-code`: `font-size: var(--mb-inline-code-size, 0.95em)`

## 5. API

```ts
export type TypographyThemeOptions = {
  classPrefix?: string;
};

export function typographyTheme(options?: TypographyThemeOptions): Extension;
```

## 6. 受け入れ条件

- `cm6-markdown-semantics` の class に対してテーマが適用される
- 見出し/引用/コード/強調/リンクの見た目が一貫する
- クラス契約を崩さず、他テーマへの差し替えが可能

## 7. 将来拡張

- list level や blockquote level の段階的な装飾
- task list の checked/unchecked など状態表現
補足（期待する DOM）
- line: `.cm-line` に `mb-xxx` が付与される
- mark: `.cm-line` 内の span に `mb-xxx` が付与される
