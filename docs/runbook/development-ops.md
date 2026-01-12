# 開発運用ルール (Development Ops)

## ブランチ運用
- `main` のみを使用
- 普段の push では publish しない

## バージョン管理 (SemVer)
- リリース時にのみ `package.json` を更新
- 未デプロイの変更は Git 履歴で管理
- デフォルトはロックステップ（全 `@yuya296/cm6-*` を同じ版に揃える）

## タグ運用
- Git tag は `vX.Y.Z` 形式
- tag は publish 後に作成し push

## リリース手順 (手動)
1) 事前確認
   - `pnpm -r lint`
   - `pnpm -r typecheck`
   - `pnpm -r build`
   - `pnpm -r test` (ある場合のみ)
2) バージョン更新
   - 変更対象の `package.json` の `version` を更新
3) Actions で `deploy.yml` を手動実行
4) リリース後に Git tag を作成して push

## Publish されない断面の扱い
- `package.json` は前回リリース版のままでOK
- release 断面だけが npm に反映される

## Links
- `docs/runbook/cicd.md`
- `docs/runbook/devsecops.md`
