## Context
Issue #18 で、VS Code の通常編集画面に近い「行頭マーカーのみ」の差分表示が必要になった。  
要件は `added` / `modified` のみを表示し、`deleted` は表示しないこと、さらに table 行は今回対象外にすること。  
`@codemirror/merge` も候補だったが、merge UI（削除チャンク表示など）を前提としており、今回の表示要件に対して余剰機能が多い。

## Options considered
- `@codemirror/merge` を採用して CSS で不要 UI を隠す - 差分計算は再利用できるが、DOM 構造依存の調整が必要で将来の追従コストが上がる。
- baseline 比較専用の薄い拡張を新規追加 - 要件に直接一致し、表示仕様を単純に保てる一方で最小限の実装保守が発生する。

## Decision
`packages/core/cm6-diff-gutter`（`@yuya296/cm6-diff-gutter`）を新規追加し、baseline 比較の結果を行頭ガターに表示する専用拡張を採用する。  
Git 依存は拡張本体に持たせず、baseline は呼び出し側から注入する。  
VS Code Webview では `HEAD` を baseline として供給し、`webview-demo` では起動時テキストを baseline とする。  
初期リリースでは `added` / `modified` のみ描画し、`deleted` と table 行は非表示にする。

## Consequences
- VS Code 風の最小 UI（行頭マーカーのみ）を仕様どおりに実装できる。
- 差分表示ロジックを core package として再利用でき、app 側は baseline 供給責務に分離できる。
- 削除マーカーや table 対応は将来拡張として別途設計が必要。
- 行差分アルゴリズムの保守責務は増えるが、merge UI の内部構造依存は避けられる。

## References
- `packages/core/cm6-diff-gutter/src/index.ts`
- `apps/webview-demo/src/app.ts`
- `apps/vscode-extension/src/extension.ts`
- `apps/vscode-extension/webview/src/main.ts`
