# Glossary

- Base Editor: CM6 を使った最小の Markdown 編集 Webapp。以降の機能の土台。
- editor-core: Feature 001 のプロダクト名。Base Editor の実装パッケージ名として扱う。
- Live Preview: Markdown を保持したまま記号の露出を抑制する編集体験。
- Reveal Zones: 記号を露出させる範囲（Block/Inline）。
- inlineRadius: インライン記号の露出判定に使うカーソル近傍距離。
- Typography Theme: Markdown の見た目（見出し/強調/引用/リンクなど）を整えるテーマ。
- CodeMirror 6 (CM6): 拡張可能なエディタライブラリ。
- Extension: CM6 の機能単位。配列で合成する。
- Compartment: runtime で extension 構成を差し替えるための CM6 機構。
- onChange(fullText): 編集時に全文を通知するコールバック。
