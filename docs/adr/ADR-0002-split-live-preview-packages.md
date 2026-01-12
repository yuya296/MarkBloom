# ADR-0002: Split Live Preview packages

## Status
Accepted

## Supersedes
- ADR-0001

## Context
Live Preview の機能が拡張され、意味付け（semantic class）やタイポグラフィの責務が混在し始めた。
各責務を分離し、外部テーマとの整合性や再利用性を高める必要がある。

## Decision
Live Preview を以下のパッケージに分割する。

- `cm6-live-preview-core`: 記号の表示切替ロジックのみ
- `cm6-markdown-semantics`: Markdown 構文の意味付け class を付与
- `cm6-typography-theme`: semantic class の見た目を定義
- `cm6-live-preview`: 上記を束ねたプリセット

`webview-demo` は cm6-* への依存を持たず、アプリ側で必要な extension を組み合わせる。

## Consequences
- 役割分担が明確になり、テーマ差し替えが容易になる
- 利用側は用途に応じて core/semantics/theme を選択できる
- パッケージ数が増えるため導入時の選択が必要になる
