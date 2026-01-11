## Context
table-editor系の候補を複数維持してきたが、現状はvanilla実装が要件に十分で、他の実装は保守コストに対して価値が薄い。依存を軽量化し、編集体験を安定させるため、vanilla実装に絞る判断が必要になった。

## Options considered
- 複数のtable-editorを維持 - 比較はできるが依存と保守コストが大きい
- vanillaに統一 - 依存を最小化でき、実装の集中が可能

## Decision
table-editorはvanilla実装に統一し、他のtable-editor実装は削除する。

## Consequences
依存とメンテナンスコストが減る。比較検証の余地は減るが、軽量化と安定性の優先度が上がる。

## References
- N/A
