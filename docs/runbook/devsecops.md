# DevSecOps Runbook

## Scope
- 対象:
  - npm 公開する `@yuya296/cm6-*` パッケージ（core line）
  - VS Code Marketplace 公開する `markbloom` 拡張（vscode line）
- 目的: 依存脆弱性・ライセンス・秘密情報のリスク低減

## 必須の準備 (Node/npm 側)
- npm アカウント（public scope で publish 可能）
- npm 2FA (推奨: publish 保護)
- `NPM_TOKEN` を GitHub Secrets に登録
  - scope: publish 可能なトークン
  - name: `NPM_TOKEN`
- VS Code Marketplace 用 PAT を GitHub Secrets に登録
  - scope: extension publish 可能なトークン
  - name: `VSCE_PAT`

## 依存のセキュリティ
- `pnpm audit` を定期実行
- 重大な脆弱性は publish 前に解消

## OSS ライセンス
- 依存ライセンスを定期確認（例: `pnpm licenses list` など）
- ライセンスが未許可の場合は依存更新 or 除外

## 供給元の信頼性
- `package.json` の `repository` / `homepage` / `bugs` を必ず記載
- npm での公開範囲は `publishConfig.access = public`

## シークレット管理
- Actions では release line ごとに secret を分離する
  - `core-release.yml`: `NPM_TOKEN` のみ
  - `vscode-release.yml`: `VSCE_PAT` のみ
- ローカルにトークンを保存する場合は `~/.npmrc` の管理に注意

## 将来の追加候補
- SBOM 生成（CycloneDX など）
- npm provenance（GitHub Actions + OIDC）

## Links
- `docs/runbook/cicd.md`
- `docs/runbook/development-ops.md`
