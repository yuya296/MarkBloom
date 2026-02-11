## Context
`apps/webview-demo` は実装検証の中心だが、これまでは常設の公開 URL がなく、`main` の最新断面や PR ごとの差分断面をレビュー時に即時共有しづらかった。  
README から参照できる安定 URL と、PR 単位で更新される preview URL を同一運用で提供し、レビュー導線を単純化する必要がある。  
あわせて workflow 名称を既存方針に揃え、用途が明確な `webview-*` 命名に統一する。

## Options considered
- `main`/PR とも GitHub Pages - 常設 URL で即時ブラウザ確認でき、README と PR コメントの導線を一本化できる。一方で公開 URL になるため機密データ運用に注意が必要。
- `main` は Pages、PR は artifact - `main` の常設公開は満たせるが、PR はダウンロード前提になりレビュー導線が分断される。
- `main`/PR とも artifact - 公開面は狭いが、常設 URL がなく README の最新断面リンク要件を満たしにくい。

## Decision
`main`/PR ともに GitHub Pages を採用する。  
`main` は `https://yuya296.github.io/MarkBloom/`、PR は `https://yuya296.github.io/MarkBloom/pr-<PR番号>/` に公開する。  
PR コメントは marker `<!-- webview-preview -->` 付きの 1 件更新運用とし、workflow・job 命名は `webview-*` で統一する。  
初期実装では fork PR の preview/cleanup はスキップし、PR close 時に `pr-<PR番号>/` を自動削除する。

## Consequences
- `main` と PR の両方で URL が安定し、レビュー時の確認コストが下がる。
- preview の lifecycle（作成/更新/削除）が自動化され、運用負荷と手作業ミスが減る。
- fork PR は初期非対応のため、外部コントリビューション時の preview 体験は制限される。
- Pages は公開 URL であるため、デモデータに機密情報を含めない運用ルールを明文化する必要がある。
- `apps/webview-demo` は base path を環境変数で切り替える前提になる。

## References
- `.github/workflows/webview-pages.yml`
- `apps/webview-demo/vite.config.ts`
- `docs/runbook/cicd.md`
- `README.md`
- `README.ja.md`
