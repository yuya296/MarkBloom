# Feature 002: cm6-live-preview (記号の露出制御)

## 1. 目的
Markdown を source-of-truth のまま保持しつつ、**記号の露出制御**により
Obsidian の Live Preview 相当の体験（編集寄り）を提供する。

- ブロック要素：カーソル行（またはブロック）にいる時だけ識別子を可視化
- インライン要素：識別子（`*`, `[`, `]`, `(`, `)` 等）にカーソルが隣接した時だけ可視化

## 2. スコープ
### In scope
- CM6 Extension として提供（VS Code 非依存）
- ブロック/インラインの露出制御（dim/hide）
- IME 安定性を重視（`view.composing` 対応）
- 性能：`visibleRanges` 範囲に限定した計算

### Out of scope
- テーブルのリッチ表示・編集（feature/003）
- 完全な WYSIWYG（内部モデルの置換）
- 100% Obsidian 同等の見た目再現

## 3. 成果物
- `packages/cm6-live-preview`
  - 公開 API：`livePreview(options?): Extension`
  - オプション型：`LivePreviewOptions`
  - 最低限のテーマ（dim用のCSS）を同梱

## 4. 主要要件（仕様）
### 4.1 可視化ゾーン（Reveal Zones）
- Block zone：
  - デフォルトは「カーソルがある行」
  - 将来拡張で「ブロック範囲（同一リスト/引用/フェンス等）」に拡張可能にする
- Inline zone：
  - `selection.head` 前後 ±N（`inlineRadius`）をゾーンとする

### 4.2 対象（第一段階）
- Block（優先）：見出し `#`、リストマーカー（`-` / `*` / `1.`）、引用 `>`
- Inline（優先）：強調 `*`/`_`、リンク `[]()`、インラインコード `` ` ``
- 除外：コードブロック/インラインコード内は原則対象外（少なくともブロックは除外）

### 4.3 表示モード
- 初期推奨：インラインは **dim（薄くする）** 中心（replace/hideは慎重に）
- ブロックは dim から開始し、必要なら hide を追加

### 4.4 IME 方針
- `view.composing` 中は装飾更新を抑制、または露出寄りに倒す（オプション化）

## 5. 公開API（案）
```ts
export type LivePreviewOptions = {
  inlineRadius?: number;
  inlineStyle?: "dim" | "hide";
  blockStyle?: "dim" | "hide";
  blockRevealMode?: "line" | "block";
  disableDuringIME?: boolean;
  exclude?: { code?: boolean };
};

export function livePreview(options?: LivePreviewOptions): Extension;
```

## 6. 受け入れ条件（Acceptance Criteria）
- ブロック記号が「カーソル行で露出 / それ以外で抑制」される
- インライン記号が「隣接で露出 / それ以外で抑制」される
- IME入力中に致命的なカーソルジャンプ/入力欠落が発生しない（少なくとも既知の破綻を回避）
- 大きめの文書でも極端に重くならない（visibleRanges限定が効いている）

## 7. 依存
- CM6 core + `@codemirror/lang-markdown`（構文木利用）
