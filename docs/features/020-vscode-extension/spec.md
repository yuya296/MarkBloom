# Feature 020: VS Code Extension (MarkBloom)

## 1. 目的
VS Code 拡張として Webview を提供し、CM6 ベースのエディタ（feature/001〜003）を統合する。
初期段階は “動く” を優先し、bridge の高度化（差分同期等）は段階導入する。

## 2. スコープ
### In scope
- VS Code 拡張（起動・Webview表示）
- `.md` を開いて Webview に表示・編集できる
- 設定（settings.json）を Webview に反映
- 保存（最低限）
- bridge（最小）：Host ↔ Webview の messaging 契約と中継

### Out of scope（初期）
- 差分同期（CM6 changeset → WorkspaceEdit）※後続で導入
- VS Code の undo stack への完全統合（まずは簡易）
- 複数ファイル同時編集や高度な競合解決

## 3. 成果物
- `packages/vscode-extension`
  - Webview UI（feature/001 の webapp を組み込み）
  - `cm6-live-preview` / `cm6-table-editor-vanilla` を読み込み
  - bridge 実装（最小）

## 4. Bridge（最小要件）
### 4.1 通信（Phase 1: 全文同期）
- Host → Webview：
  - `initDocument { uri, text, version }`
  - `setConfig { config }`
- Webview → Host：
  - `ready`
  - `didChangeText { uri, text, version }`
  - `requestSave`

### 4.2 保存
- `didChangeText` を受けて VS Code 側に反映（方法は実装都合で選択）
- 保存トリガ（Ctrl+S 等）で現在テキストを確定して保存

> 注：この段階では undo/redo は Webview 内で成立していればよい（VS Code 統合は後続）

## 5. 設定項目（例）
- `markbloom.livePreview.enabled`
- `markbloom.livePreview.inlineRadius`
- `markbloom.table.enabled`
- `markbloom.view.openInMarkBloomByDefault`（boolean）

## 6. 受け入れ条件（Acceptance Criteria）
- VS Code で `.md` を開くと MarkBloom Webview で編集できる
- 編集内容が保存できる
- 設定変更が Webview に反映される（少なくとも再読み込みでOK、できればランタイム反映）
- `cm6-live-preview` を有効化すると露出制御が効く
- `cm6-table-editor-vanilla` を有効化するとテーブル表示が効く（v1）

## 7. 追加仕様（VS Code 拡張 UI/UX）
### 7.1 既定のビュー選択
- 設定 `markbloom.view.openInMarkBloomByDefault` を追加
  - `true`: `.md` を開いたとき MarkBloom を既定ビューにする
  - `false`: `.md` を開いたとき通常のテキストエディタを既定にする
- 既定ビューを切り替えても、ユーザーが明示的に選択した「Open With」は尊重される

### 7.2 右上のビュー切り替えボタン
- MarkBloom 表示時:
  - 右上にソースアイコンを表示（ツールチップ: "Open Source"）
  - クリックで同じファイルを通常のテキストエディタで開く
- 通常のテキスト表示時:
  - 右上に MarkBloom アイコンを表示（ツールチップ: "Open in MarkBloom"）
  - クリックで同じファイルを MarkBloom で開く
- VS Code の editor/title もしくは webview 内ツールバーとして実装

### 7.3 Editable / View トグル
- MarkBloom 内に「Editable / View」トグルを追加
  - Editable: 既存の編集 UI を有効化（入力可）
  - View: 読み取り専用（入力不可）でプレビューに集中
  - UI は鉛筆アイコン ←→ 目アイコンのトグル

### 7.4 Wide / Default トグル
- MarkBloom 内にレイアウト幅を切り替えるトグルを追加
  - Wide: full width
  - Default: `max-width: 600px` 程度
  - 表示状態はセッション内で保持（永続化は不要）
