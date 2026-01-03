# ADR-0001: Source of TruthはMarkdown、WebViewは表示・操作

- Status: Proposed
- Date: 2025-01-03

## Context
- この拡張はMarkdown Documentを直接編集するVS Code体験を拡張することが目的。
- テーブルをリッチ表示するためWebViewを導入するが、編集や整形を考えると状態の正をどこに置くかが重要。
- WebView側で状態を保持するとUndo/Redoや複数エディタ間同期が困難になる。

## Decision
- Markdownテキスト（VS Code Document）を唯一のSource of Truthとする。
- WebViewはDocumentの投影としてレンダリングと操作UI（将来的に）を担当し、編集結果は常にDocumentへのパッチとして適用する。
- Extension HostはWebViewとDocument間の仲介・正規化・差分適用を担う。

## Consequences
- Undo/Redo・保存・Git差分はVS Codeが提供するDocument機能をそのまま利用できる。
- WebViewでの編集は即時にDocumentへ反映（またはパッチ生成→適用）する必要があるため、メッセージ契約とフォーマット規約を明確にしておく。
- WebViewを閉じても状態は失われないが、Document外の状態が必要な場合は明示的にStorageへ保存する。
- DocumentとViewの整合が崩れた場合はDocumentを再送してViewを再構築する復帰手段を持つ。
