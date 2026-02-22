# CI/CD Runbook

## Scope
- 対象: `core`（`packages/core/cm6-*`）と `vscode`（`apps/vscode-extension`）
- 目的: 配布チャネルごとに release line を分離し、手動リリースの誤操作を減らす

## Release Lines
- `core`:
  - 配布先: npm (`@yuya296/cm6-*`)
  - workflow: `.github/workflows/core-release.yml`
  - tag: `core-vX.Y.Z`
- `vscode`:
  - 配布先: VS Code Marketplace (`markbloom`)
  - workflow: `.github/workflows/vscode-release.yml`
  - tag: `vscode-vX.Y.Z`
- `mac`:
  - 現時点は reserved（実装なし）。互換性スロットのみ `releases/compatibility-matrix.json` に保持。

## CI (自動)
- Trigger: `pull_request`, `push` (main)
- workflow: `.github/workflows/ci.yml`
- 実行内容（最小）
  - `pnpm install --frozen-lockfile`
  - `node scripts/check-compatibility.mjs`
  - `node scripts/check-widget-measure-contract.mjs`
  - `pnpm -r lint`
  - `pnpm -r typecheck`
  - `pnpm -r build`
  - `pnpm -r --if-present test`

## Webview Pages (自動公開)
- 対象: `apps/webview-demo`
- workflow: `.github/workflows/webview-pages.yml`
- Trigger:
  - `push` (`main`) -> 最新断面を更新
  - `pull_request` (`opened`, `synchronize`, `reopened`) -> PR断面を更新
  - `pull_request` (`closed`) -> PR断面を削除
- URL 規約:
  - main: `https://yuya296.github.io/MarkBloom/`
  - PR: `https://yuya296.github.io/MarkBloom/pr-<PR番号>/`
- PRコメント運用:
  - botコメントを 1 件だけ保持し、最新 preview URL に更新する（marker: `<!-- webview-preview -->`）
- セキュリティ方針:
  - fork PR (`head.repo.full_name != repository`) は preview/cleanup をスキップする
- cleanup 方針:
  - PR close 時に `gh-pages` から `pr-<PR番号>/` を削除する
- 注意:
  - Pages は公開 URL のため、デモには機密情報を含めない

## CD (手動)
- Trigger: 各 workflow の `workflow_dispatch`
- 共通入力:
  - `dry_run` (boolean): 配布を dry-run にする
  - `version` (string, optional): 期待バージョンの一致チェック
  - `create_release` (boolean): GitHub Release を作成する

### Core release
- workflow: `.github/workflows/core-release.yml`
- 実行内容:
  - lockstep version 検証
  - `node scripts/check-compatibility.mjs`
  - `pnpm -r --filter "@yuya296/cm6-*" build`
  - `pnpm -r --filter "@yuya296/cm6-*" publish`
  - tag作成 (`core-vX.Y.Z`)
  - GitHub Release 作成（`release_notes/core.md` ベース）

### VS Code release
- workflow: `.github/workflows/vscode-release.yml`
- 実行内容:
  - extension version 検証
  - `node scripts/check-compatibility.mjs`
  - `pnpm -C apps/vscode-extension build`
  - `pnpm -C apps/vscode-extension package|publish`
  - tag作成 (`vscode-vX.Y.Z`)
  - GitHub Release 作成（`release_notes/vscode.md` ベース）

## Notes
- main への push では publish しない
- 互換性契約は `releases/compatibility-matrix.json` を正本とする
- release 証跡は GitHub Releases を正本とする

## Links
- `docs/runbook/development-ops.md`
- `docs/runbook/devsecops.md`
