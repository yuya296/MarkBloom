## Context
MarkBloom は monorepo で `core`（cm6 ライブラリ群）と `app`（VS Code 拡張・demo）を同居させているが、従来はすべて `packages/` 直下に配置され、実行環境の境界が見えにくかった。  
将来の mac アプリ追加を見据えると、`app` と `core` の責務をディレクトリ構造でも明確にし、CI/CD・運用ドキュメント・開発導線を揃える必要がある。

## Options considered
- `packages/` 直下を維持 - 変更コストは低いが、配布境界（npm/Marketplace/将来mac）が構造に表れず運用が分かりづらい。
- `apps/` と `packages/core/` に分離 - 境界が明確になり将来拡張しやすい一方で、参照パスやworkflow更新が広範囲に必要。
- repository を分割 - 境界は最も明確だが、現時点では同時変更が多く運用負荷（同期PR/互換性管理）が高い。

## Decision
repository は分割せず、monorepo 内を `apps/` と `packages/core/` に再編する。  
`apps/webview-demo` と `apps/vscode-extension` を app 層、`packages/core/cm6-*` を core 層として整理し、workspace・workflow・runbook を新構成に合わせて更新する。

## Consequences
- app と core の責務がディレクトリレベルで明確になり、将来の `apps/mac` 追加が容易になる。
- 既存の import alias / tsconfig / vite / workflow / docs の参照更新が必要になる。
- 一時的に `node_modules` の相対リンク破損が起こり得るため、再インストール手順を運用知識として保持する。
- repository 分割は先送りし、当面は monorepo で原子的変更の利点を維持する。

## References
- `pnpm-workspace.yaml`
- `docs/architecture/overview.md`
- `docs/runbook/cicd.md`
- `.github/workflows/core-release.yml`
- `.github/workflows/vscode-release.yml`
