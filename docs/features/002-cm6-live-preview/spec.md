# Feature 002: cm6-live-preview (Live Preview)

## 1. Purpose
CM6（CodeMirror 6）上で Markdown を **source of truth（docは常にMarkdownソース）**のまま保持しつつ、表示を "プレビュー寄り" に変換する **Live Preview（WYSIWYG風）**を提供する。

- doc（文字列）を HTML にレンダリングする “別プレビューペイン” は本機能の対象外
- 表示変換は CM6 の Decoration（mark/replace）および Widget を用いて view を加工する

## 2. Definitions

### 2.1 Document / State / View
- **doc**: Markdown ソース文字列（真実）
- **state**: doc + 設定 + 解析結果（EditorState）
- **view**: state を DOM として描画したもの（EditorView）

Live Preview は **docを変更せず view を変える**。

### 2.2 Render State (per element)
Markdownの構文要素（inline/block）単位で、表示状態 `renderState` を持つ。

- `preview`: 記号（syntax）非表示やリッチ表示を適用
- `edit`: 生Markdown（または編集向けカスタム表示）を適用

注: UI上の呼称として Preview/Edit を用いてよいが、仕様上は **グローバルモードではなく「要素ごとの状態」**とする。

## 3. User-facing Behaviors

### 3.1 Source of truth / Undo
- Live Preview 有効時でも、doc は常に Markdown ソースである
- Undo/Redo は doc への transaction を基準に動作する
- View-only の差し替え（Decoration/Widgetの変更）は Undo 対象外

### 3.2 Theme compatibility
- 既存の theme（別Plugin等）が提供する見た目は、可能な限り維持されること
- Widget を用いる場合、必要に応じて class を付与し、全体テーマと整合する見た目を実現すること
  - cm6-live-preview は色を定義せず、class を付与するだけに留める

## 4. Configuration API

`buildExtensions(options)` は以下のオプションを受ける。

- `livePreviewEnabled: boolean`
- `blockRevealEnabled: boolean`
- （既存）`showLineNumbers`, `wrapLines`, `tabSize`, etc.

### 4.1 Semantic definition of `livePreviewEnabled`
- `false`: Source Mode（通常のMarkdown編集表示。syntaxは表示される）
- `true`: Live Preview Mode（以下の Preview/Edit 切替規則・表示規則が有効）

## 5. Live Preview Mode Requirements

### 5.1 Preview display (default behavior)
Live Preview Mode では、対象要素に対して次を適用できること。

- **syntax token の非表示（hide）**が基本
  - 例: `**`, `#`, `` ` ``, `[]()`, list marker など
- 表示変換は view-only（Decoration.mark / Decoration.replace / Widget）で行う

#### Preview renderer levels
- Inline要素:
  - 既定は syntax token を hide し、内容（content）を装飾して表示
- Block要素:
  - 既定は syntax token を hide し、blockとしてのスタイルを適用
  - 任意で block 全体を Widget によりリッチ表示へ置換できる（opt-in）

### 5.2 Edit display (default behavior)
- `edit` 状態の要素は、原則 **生Markdown（source）表示**に戻ること
- 要素ごとに `EditRenderer` を定義できる拡張点を持つこと（将来要件）

## 6. Reveal / Switching Rules (Preview ⇄ Edit)

### 6.1 Transition triggers
要素が `edit` に切り替わる条件は以下。

- **Selection reveal**: 選択範囲に交差する要素は `edit`
- **Block reveal**（`blockRevealEnabled=true`）: カーソルが属する block は `edit`
- **Proximity reveal**: カーソル近傍（N文字以内）の inline は `edit`

### 6.2 Priority
競合時の優先順位は次で固定する。

`Selection` > `Block` > `Proximity`

### 6.3 Scope of switching
- 切替は **要素単位（inline/block）**で行い、ドキュメント全体を一律に切り替えない
- 同一要素内でも必要に応じて「syntax token のみ edit」など細粒度を許容する（実装裁量）

## 7. Element-specific Requirements (initial)
PH1 の対象要素は少なく定義し、順次追加可能とする（この一覧は feature spec で確定する）。

候補（例）:
- Headings
- Bold / Italic
- Inline code
- Links
- List markers / checkboxes（将来）
- Code blocks（将来）

### 7.1 Mermaid code block (recommended future behavior)
- Preview:
  - code block 全体を Widget により mermaid 図として表示可能
- Edit:
  - 既定はソース表示へ戻す
  - 将来的に code + preview を同時表示する EditRenderer を提供可能

## 8. Non-goals
以下は `livePreviewEnabled` の範囲外とする（別機能/別PBI）。

- 別ペインの HTML プレビューの提供
- プレビューDOM（contentEditable等）での直接編集
- Markdown 方言（GFM等）の完全対応
- “完全WYSIWYG” を保証する高度な編集体験（Google Docs同等）

## 9. Implementation constraints (informative)
- Live Preview は CM6 の `Decoration`（mark/replace）と `Widget` を用いて実現する
- 切替のために extensions は compartment により再構成可能な設計を推奨する

## 10. Live Preview Configuration (implementation)
`packages/cm6-live-preview/src/config.ts` で要素ごとの `renderState` を定義する。

| 要素 | Trigger | Preview | Edit |
| --- | --- | --- | --- |
| 見出し | selection / block | hide | color-secondary |
| 太字 | selection / proximity | hide | color-secondary |
| 箇条書き/番号付き | always | color-secondary | color-secondary |
