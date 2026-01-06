# Plan: Feature004 cm6-typography-theme

## 方針
- `cm6-markdown-semantics` の class 契約に従ってタイポグラフィを定義
- `.cm-content` 配下にスコープして副作用を避ける
- ホストのカラースキームに追随する（CSS 変数で上書き可能）

## 対象
- packages/cm6-typography-theme

## 実装ポイント
- headings / blockquote / code / list を段階的に整備
- quote / code の色やフォントは CSS 変数経由
- class prefix は options で上書き可能

## 影響範囲
- docs/features/004-cm6-typography-theme/*
