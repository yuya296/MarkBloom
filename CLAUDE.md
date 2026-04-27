# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

MarkBloom は Markdown を Single Source of Truth として保ったまま、人間にとってレビュー/編集しやすいエディタ体験を提供するためのモノレポ。CodeMirror 6 をベースにした拡張群を `packages/core/cm6-*` に分割し、`apps/*`（webview-demo / VS Code 拡張 / Tauri製macアプリ）から組み合わせて利用する。

## 開発コマンド

前提: Node.js `22+`（推奨は `.nvmrc` の `24.x`）、pnpm `10.27.0`（Corepack 経由）。

ルート（モノレポ全体）:
- `pnpm install` — 依存導入
- `pnpm lint` — eslint + stylelint + widget-measure契約チェック
- `pnpm typecheck` — `pnpm -r typecheck`
- `pnpm build` — `pnpm -r build`
- `pnpm test:core` — `packages/core/*` の test 一括
- `pnpm check:core` — core の typecheck + test
- `pnpm check:compatibility` — `releases/compatibility-matrix.json` に基づく app⇔core 互換性検証
- `pnpm test:e2e` — webview-demoをbuildしてからPlaywright実行

webview-demo（実装/検証の中心）:
- `pnpm -C apps/webview-demo dev` — Vite dev server（Node version を `scripts/ensure-node-version.mjs` で事前チェック）
- `pnpm -C apps/webview-demo build` — 変更後の動作確認用ビルド（毎回実施）
- `pnpm -C apps/webview-demo test:unit` — `node --experimental-transform-types --test tests/*.test.ts`
- 単一テスト: `node --experimental-transform-types --test apps/webview-demo/tests/<file>.test.ts`

core パッケージ単体（例: `cm6-live-preview`）:
- `pnpm -C packages/core/<pkg> build|lint|typecheck|test`
- 単一テスト: `pnpm -C packages/core/<pkg> exec tsx --test tests/<file>.test.ts`

VS Code 拡張 / mac アプリ:
- `pnpm -C apps/vscode-extension build` / `pnpm -C apps/mac tauri:dev` / `pnpm -C apps/mac tauri:build`（`aarch64-apple-darwin` 固定）

PM2（並行 worktree 開発時）:
- `pm2 start ecosystem.config.cjs --update-env`
- プロセス名/ポートは branch 名から決定的に算出（`webview-demo-<slug>-<hash6>`）
- 同一 branch の複数 worktree 同時起動は非サポート
- ポート上書きは `MB_PORT=<port> pm2 start ecosystem.config.cjs --update-env`

## アーキテクチャ

### レイヤ構造
- **app層**（`apps/*`）が **core層**（`@yuya296/cm6-*` 各 workspace パッケージ）に依存する単方向DAG。3つの app（`webview-demo` / `vscode-extension` / `mac`）はいずれも `cm6-live-preview` + `cm6-diff-gutter` + `cm6-markdown-smart-bol` の同じ三点を組み合わせる。
- `cm6-live-preview` は **集約パッケージ**（バレル）であり、`cm6-live-preview-core`（記号の表示状態切替: hide/secondary/raw）+ `cm6-markdown-semantics`（`mb-` prefixのsemantic class付与）+ `cm6-typography-theme`（CSS見た目）を内部合成する。`mermaid` と `table` は `livePreviewPreset` の option としてアプリ側で有効化する（`cm6-live-preview-mermaid` / `cm6-table`）。
- semantic class の付与（`cm6-markdown-semantics`）と見た目の定義（`cm6-typography-theme`）は **責務を分離**。class prefixは `mb-` で統一。

### Fast reading path
- `apps/webview-demo/src/main.ts` → `app.ts` → `createEditor.ts`
- 拡張の組み合わせは `app.ts` の `buildExtensions` を参照。
- UI/テーマは `apps/webview-demo/src/style.scss`（CSS変数 `:root` / `[data-theme]`）と `editorTheme.ts`（`EditorView.theme`）の二箇所。**UI/テーマ変更時は両方を確認**。

### CodeMirror バージョンピン
ルート `package.json` の `pnpm.overrides` で `@codemirror/*` と `@lezer/common` を厳密にピン留めしている。core/app のバージョンずれによる二重ロードを避けるため、これらは個別パッケージ側では更新せずルートで管理する。

### リリーストポロジ（チャネル分離）
- `core`（`packages/core/cm6-*`）: lockstep でまとめて npm publish。tag は `core-vX.Y.Z`、workflow は `.github/workflows/core-release.yml`（`bump` 入力で `package.json` を更新）。
- `vscode`（`apps/vscode-extension`）: 独立 SemVer。Marketplace 公開、tag は `vscode-vX.Y.Z`、workflow は `.github/workflows/vscode-release.yml`。
- `mac`（`apps/mac`）: 現状ローカル配布のみ（署名/Notarizationなし）。`pnpm -C apps/mac tauri:build`。
- 互換性契約の正本は `releases/compatibility-matrix.json`。`vscode → core` と `mac → core` の min/max を CI で検証。

### Webview / Pages
- 最新 `main` 断面: `https://yuya296.github.io/MarkBloom/`
- PR 断面: `https://yuya296.github.io/MarkBloom/pr-<number>/`
- 公開コンテンツのため、デモに機微情報を含めない。

### ドキュメント階層（Docs-as-Code）
`docs/` は Tier で階層化されており変更時の更新ルールがある。
- Tier 1（常に最新）: `docs/architecture/overview.md`、`docs/domain/glossary.md`、`docs/data/*`、`docs/runbook/*`
- Tier 2（意思決定履歴）: `docs/adr/ADR-XXXX-<slug>.md`（1 ADR = 1 意思決定。変更は新ADRで Supersede）
- Tier 3（feature単位）: `docs/features/*`
詳細運用は `docs/README.md` 参照。

## 規約

### コミットメッセージ（`.github/copilot-instructions.md`）
形式: `${prefix}: ${message}`。prefix は `feat`/`fix`/`add`/`update`/`refactor`/`upgrade`/`revert`/`docs`/`style`/`perf`/`test`/`chore` から選択。

### ブランチ命名
`feature/*` / `fix/*` / `docs/*` / `ci/*`。`main` は保護ブランチ。

### PR レビュー
日本語で実施。

### Definition of Done（`AGENTS.md`）
- ADR 必要なら追加/更新、用語追加は `docs/domain/glossary.md`、Overview 図の変更は `docs/architecture/overview.md` に反映
- PR は `update branch` 実施 → ローカルへ `git pull` 同期 → レビュー指摘へ全対応（不要なら理由を残してResolve、対応時は対応内容と commit hash をコメントしてResolve）→ 最新 commit で CI 通過、をすべて確認
- 機能変更後は `pnpm -C apps/webview-demo build` と `pm2 start ecosystem.config.cjs --update-env` で起動確認し、playwright-cli で動作検証

### widget-measure 契約
`scripts/check-widget-measure-contract.mjs` が core のソース内 `requestMeasure` / `requestEditorMeasure` / `ResizeObserver` 使用箇所を契約として検査する。`pnpm lint` の一部として実行されるため、該当APIを触る変更時は contract 更新も検討する（`docs/runbook/widget-measure-contract.md`）。
