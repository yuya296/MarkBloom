## Context
MarkBloom は `@yuya296/cm6-*` の npm 公開と `markbloom` VS Code 拡張公開を同一文脈で運用していたが、配布先・認証情報・失敗モードが異なる。今後 mac アプリ配布を予定しており、配布チャネルごとに責務境界を明確化しないと、運用手順の混線や誤公開リスクが上がる。

## Options considered
- 単一リリースラインを継続 - 設計は単純だが、npm と Marketplace の手順/secret が混在し、将来の mac 追加で複雑化する。
- 配布チャネルごとにリリースライン分離 - workflow/tag/secret を分離できる一方、運用ドキュメントと整合ルール（互換性管理）が追加で必要になる。
- 先に mac を含む3系統を全面実装 - 将来準備は厚いが、現時点の実装コストが高く過剰設計になりやすい。

## Decision
配布チャネルごとに release line を分離する。現時点では `core`（npm）と `vscode`（Marketplace）を本実装し、`mac` は compatibility matrix 上の予約スロットとして先行定義する。バージョンは独立 SemVer とし、`core` は lockstep リリース、互換性は min/max 範囲を機械可読ファイルで管理する。

## Consequences
- workflow が `core-release.yml` と `vscode-release.yml` に分離され、誤公開と secret 誤利用のリスクが下がる。
- tag と GitHub Release がチャネル別に管理され、監査と追跡が容易になる。
- `releases/compatibility-matrix.json` と検証スクリプトの維持が追加コストになる。
- 将来 mac 配布を実装する際は、既存の release line へ段階的に追加できる。

## References
- `docs/runbook/cicd.md`
- `docs/runbook/development-ops.md`
- `docs/runbook/devsecops.md`
- `releases/compatibility-matrix.json`
