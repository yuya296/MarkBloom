# Tasks: Feature003 cm6-markdown-semantics

## Done
- `packages/cm6-markdown-semantics` を追加
- Markdown 要素に semantic class を付与
- block は `Decoration.line`、inline は `Decoration.mark`
- line クラスは `line.from` 単位で集約して付与
- `classPrefix` をオプション化（default: `mb-`）
- spec を整理・更新
- list / blockquote のレベル付与
- task list の checked/unchecked 対応
- table / footnote / html block の追加
