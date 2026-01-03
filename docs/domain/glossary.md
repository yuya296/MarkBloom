# Glossary

- Base Editor: CM6 を使った最小の Markdown 編集 Webapp。以降の機能の土台。
- editor-core: Feature 001 のプロダクト名。Base Editor の実装パッケージ名として扱う。
- CodeMirror 6 (CM6): 拡張可能なエディタライブラリ。
- Extension: CM6 の機能単位。配列で合成する。
- Compartment: runtime で extension 構成を差し替えるための CM6 機構。
- onChange(fullText): 編集時に全文を通知するコールバック。
