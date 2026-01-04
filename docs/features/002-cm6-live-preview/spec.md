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
### 4.1 preview → raw のトリガー
| トリガーID | 発火条件 | 対象スコープ | 用途/狙い |
| --- | --- | --- | --- |
| selectionOverlap | 選択範囲がその要素（または要素の範囲）にかかった | inline / block 共通 | コピペ・削除・置換事故を防ぐ（最優先） |
| cursorInside | カーソルが要素の内部に入った | inline / block 共通 | 編集中の要素は raw |
| cursorAdjacent | カーソルが要素の前後 N 文字以内（N=1〜2） | 主に inline | マーカー編集を自然にする |
| lineActive | アクティブ行に要素が含まれる | 主に block/行頭構文 | 行頭記号の編集を安全にする |

基本方針
- inline は `selectionOverlap` / `cursorInside` / `cursorAdjacent` で raw
- block は `selectionOverlap` / `cursorInsideBlock` / `lineActive` で raw
- リストマーカー（箇条書き/番号付き）は常に raw（トリガーなし）

### 4.2 preview の表示形式（表現パターン）
| 表示形式ID | 何をするか | 主な用途 |
| --- | --- | --- |
| none | 通常表示 | ブロック本文/コード本文 |
| replace | 元のテキスト範囲を別 DOM に置換 | inline 記号の非表示 |
| widgetLabel | 置換でラベル表示 | ブロック境界（コードフェンスなど） |

### 4.3 対象（第一段階）
- Block：見出し `#`、引用 `>`、コードフェンス境界
- Inline：強調 `*`/`_`、リンク `[]()`、インラインコード `` ` ``
- 除外：コードブロック/インラインコード内は原則対象外


## 5. 公開API（案）
```ts
export type LivePreviewOptions = {
  inlineRadius?: number;
  inlineRadiusBefore?: number;
  inlineRadiusAfter?: number;
  disableDuringIME?: boolean;
  exclude?: { code?: boolean };
};

export function livePreview(options?: LivePreviewOptions): Extension;
```

## 6. 受け入れ条件（Acceptance Criteria）
- inline 記号が `selectionOverlap` / `cursorInside` / `cursorAdjacent` で raw に戻る
- block 記号が `selectionOverlap` / `cursorInsideBlock` / `lineActive` で raw に戻る
- リストマーカーは常に raw
- コードフェンス境界は raw 以外で `widgetLabel` 表示になる
- IME入力中に致命的なカーソルジャンプ/入力欠落が発生しない

## 7. 依存
- CM6 core + `@codemirror/lang-markdown`（構文木利用）
