# Plan: Feature003 cm6-markdown-semantics

## 方針
- Markdown 構文を解析して semantic class を付与する
- block は `Decoration.line`、inline は `Decoration.mark`
- class prefix は `mb-` をデフォルトにし、options で上書き可能
- semantics と typography は同じ prefix を共有する

## 対象
- packages/core/cm6-markdown-semantics

## 実装ポイント
- syntaxTree から対象ノードを抽出
- line クラスは `line.from` ごとにクラス集合をまとめて 1 回で付与
- mark クラスは node 範囲に付与

## 影響範囲
- docs/features/003-cm6-markdown-semantics/*
- docs/domain/glossary.md（用語追加済み）
