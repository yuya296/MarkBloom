# Feature 004: VS Code Extension (MarkBloom)

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
  - `cm6-live-preview` / `cm6-table-editor` を読み込み
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
- `markbloom.table.editMode`

## 6. 受け入れ条件（Acceptance Criteria）
- VS Code で `.md` を開くと MarkBloom Webview で編集できる
- 編集内容が保存できる
- 設定変更が Webview に反映される（少なくとも再読み込みでOK、できればランタイム反映）
- `cm6-live-preview` を有効化すると露出制御が効く
- `cm6-table-editor` を有効化するとテーブル表示が効く（v1）
