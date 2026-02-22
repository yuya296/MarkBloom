# 開発運用ルール (Development Ops)

## ブランチ運用
- `main` のみを使用
- 普段の push では publish しない

## バージョン管理 (SemVer)
- release line ごとに独立 SemVer を採用する
  - `core`（`@yuya296/cm6-*`）: lockstep 運用
  - `vscode`（`markbloom`）: 独立運用
  - `mac`（将来）: 独立運用を想定
- リリース時にのみ `package.json` を更新
- 未デプロイの変更は Git 履歴で管理

## タグ運用
- `core`: `core-vX.Y.Z`
- `vscode`: `vscode-vX.Y.Z`
- tag は publish 後に作成し push

## 共通リリース手順 (手動)
1) 事前確認
   - `pnpm -r lint`
   - `pnpm -r typecheck`
   - `pnpm -r build`
   - `pnpm -r --if-present test`
   - `node scripts/check-compatibility.mjs`
2) バージョン更新
   - 対象 release line の `package.json` `version` を更新
3) Actions で対象 workflow を手動実行
   - core: `.github/workflows/core-release.yml`
   - vscode: `.github/workflows/vscode-release.yml`
4) GitHub Releases を確認
   - core: `core-vX.Y.Z`
   - vscode: `vscode-vX.Y.Z`

## Core release 補足
- `@yuya296/cm6-*` は全パッケージ同時リリース
- lockstep が崩れている場合は workflow が停止する
- 公開前に npm 上の同version重複を検知して停止する

## VS Code release 補足
- `VSCE_PAT` を使って Marketplace へ公開する
- dry-run は `package`（vsix生成）まで実行する

## 互換性契約
- 正本: `releases/compatibility-matrix.json`
- 現在は `vscode -> core` の min/max 範囲を CI / release workflow で検証
- 将来は `mac -> core` の範囲を同ファイルに追加する

## Links
- `docs/runbook/cicd.md`
- `docs/runbook/devsecops.md`
- `docs/runbook/widget-measure-contract.md`
