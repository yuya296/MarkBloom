# Rules for AI Agents

## Definition of Done

- ADRが必要なら追加/更新
- Domain/Glossaryに用語追加
- Overview図が変わるなら更新

## Repository Overview (Quick Start)

### Purpose
- CodeMirror 6ベースのエディタ関連パッケージ群。実装・検証の中心は`apps/webview-demo`。
- 最新断面（`main`）: `https://yuya296.github.io/MarkBloom/`
- PR断面（`pr-<number>`）: `https://yuya296.github.io/MarkBloom/pr-<number>/`

### Module Map (Where to Change)
- `apps/webview-demo`: デモ/統合アプリ。UI・テーマ・配線の入口。
- `packages/core/cm6-*`: CodeMirror拡張群（機能単位で分割）。
- `packages/core/cm6-live-preview-core`: ライブプレビューの中核ロジック。
- `packages/core/cm6-typography-theme`: タイポグラフィ/Markdown装飾テーマ。

### Fast Reading Path
- `apps/webview-demo/src/main.ts` → `app.ts` → `createEditor.ts`
- 拡張の組み合わせは`app.ts`の`buildExtensions`を見る。
- UI/テーマは`apps/webview-demo/src/style.scss`が入口。

### Theme/Style Guidance
- 色はCSS変数で定義（`style.scss`の`:root`/`[data-theme]`）。
- CodeMirrorの見た目は`EditorView.theme`で定義（`editorTheme.ts`など）。

### Dev Workflow
- 起動: `pnpm -C apps/webview-demo dev`
- PM2起動: `pm2 start ecosystem.config.cjs`
- 主要Lint/型チェック: 各パッケージの`package.json`参照。

### Branch Naming
- `feature/*`: 機能追加
- `fix/*`: 機能修正
- `docs/*`: ドキュメント修正
- `ci/*`: CI修正

### Change Checklist (Keep It Short)
- 機能変更: 影響パッケージの責務を確認し、該当モジュールに最小変更。
- 作業後（毎回）: `pnpm -C apps/webview-demo build` と `pm2 start ecosystem.config.cjs` で確認。
- UI/テーマ変更: `webview-demo`のCSS変数とテーマ拡張の両方を確認。
- 検証: agent-browserで動作確認すること。
