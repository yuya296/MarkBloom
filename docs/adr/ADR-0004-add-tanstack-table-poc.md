## Context
現状のtable-editor系は機能が豊富で依存も大きく、より軽量な編集UIを試したい。TanStack Tableを使ったシンプルなUIをPoCとして追加し、既存実装を維持したまま比較検証したい。一方で、live-previewの中核ロジックにReact依存を持ち込むのは避けたい。

## Options considered
- 既存のtable-editor群を継続利用のみ - 追加コストなしだが、軽量UIの検証ができない
- 既存を置き換えてTanStack Tableへ移行 - UIの自由度は高いが、置き換えと互換性のコストが大きい
- 既存は残し、TanStack TableのPoCモジュールを追加 - 並列評価ができ、段階的に検証可能

## Decision
既存のtable-editor群は残したまま、TanStack Tableを使ったPoC用モジュールを追加する。React導入はwebview-demo側で許容し、live-previewの中核にはReact依存を持ち込まない方針とする。

## Consequences
PoCの実装/評価コストは発生するが、既存機能を維持したまま軽量UIの可能性を検証できる。React UIはwebview-demo側に寄せるため、live-previewの依存関係は増やさない。将来的に移行可否の判断材料になる。

## References
- N/A
