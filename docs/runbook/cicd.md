# CI/CD Runbook

## Scope
- 対象: `packages/cm6-*` を中心とした npm パッケージ群
- 目的: main への push ではビルド/検証のみ、デプロイは手動

## CI (自動)
- Trigger: `pull_request`, `push` (main)
- 目的: 破壊的変更や型崩れの早期検知
- 実行内容（最小）
  - `pnpm install --frozen-lockfile`
  - `pnpm -r lint`
  - `pnpm -r typecheck`
  - `pnpm -r build`
  - `pnpm -r test` (ある場合のみ)

## CD (手動)
- Trigger: GitHub Actions `deploy.yml` の `workflow_dispatch`
- 目的: release 断面のみ npm publish
- 実行内容（最小）
  - `pnpm install --frozen-lockfile`
  - `pnpm -r --filter @yuya296/* build`
  - `pnpm -r --filter @yuya296/* publish`

## Notes
- main への push では publish しない
- release は `docs/runbook/development-ops.md` に従う

## Links
- `docs/runbook/development-ops.md`
- `docs/runbook/devsecops.md`
