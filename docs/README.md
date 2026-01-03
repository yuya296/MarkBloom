# docs/README.md

このディレクトリは「設計・仕様・意思決定・運用」を **Docs-as-Code** として管理します。  
目的は、feature開発を続けても保守可能な状態を維持することです。

---

## 1. 基本方針

### 1.1 Source of Truth
- **契約・スキーマ・設定などの機械可読な成果物**を正とする
  - 例：OpenAPI / JSON Schema / DB migration / IaC
- 文章ドキュメントは「意図・境界・判断理由」を残すために使う

### 1.2 ドキュメントの階層（Tier）
- **Tier 1: 常に最新であるべき**
  - `architecture/overview.md`
  - `domain/glossary.md`
  - `contracts/*` / `data/*`（契約・スキーマ）
  - `runbook/*`（運用）
- **Tier 2: 意思決定の履歴**
  - `adr/*`
- **Tier 3: feature単位の仕様・設計**
  - `features/*`（完成後は必要に応じて要約してTier 1へ昇格）

---

## 2. ディレクトリ構成

推奨構成は以下です（必要に応じて増減可）。

- `docs/README.md`  
  このルールと運用方針
- `docs/architecture/`  
  全体像（薄く、境界を中心に）
- `docs/domain/`  
  用語集・ドメイン概念・状態
- `docs/data/`  
  データモデル、スキーマ説明（DB migration が正の場合は補助）
- `docs/contracts/`  
  API/メッセージ契約（OpenAPI/Schema等）
- `docs/adr/`  
  Architecture Decision Records（重要意思決定）
- `docs/features/`  
  feature単位の spec/plan/tasks（反復開発の単位）
- `docs/runbook/`  
  運用、障害対応、復旧、リリース手順

---

## 3. 更新ルール（Definition of Done）

PRをマージする前に、影響に応じて以下を更新します。

### 3.1 Tier 1 更新が必要な例
- コンポーネント境界や責務が変わった → `architecture/overview.md`
- 用語が増えた・意味が変わった → `domain/glossary.md`
- スキーマ/契約が変わった → `contracts/*` / `data/*`
- 運用手順が増えた → `runbook/*`

### 3.2 ADR が必要な例
次に該当する場合は **ADR を追加**します。
- 後戻りコストが高い（広範囲に影響）
- 代替案が複数あり、トレードオフがある
- 将来蒸し返されそう（判断理由が重要）

---

## 4. ADR 運用ルール

### 4.1 原則
- **1 ADR = 1 意思決定**
- 迷ったら分割し、相互リンクする
- 変更時は既存ADRを編集して書き換えるのではなく、**新ADRで Supersede** する

### 4.2 命名
- `docs/adr/ADR-0001-<slug>.md`
  - 例：`ADR-0003-webview-is-source-of-truth.md`

### 4.3 ステータス
- `Proposed` / `Accepted` / `Superseded` / `Deprecated` を明記

---

## 5. Feature（SDD）運用ルール

featureは `docs/features/<feature>/` に配置します。

推奨ファイル:
- `spec.md`：ユーザー価値・受け入れ基準（What/Why）
- `plan.md`：実装方針・責務・変更点（How）
- `tasks.md`：PR単位の分割、順序、Done条件

### 5.1 完了後の整理
- feature完了時に、必要な要点を Tier 1（overview/glossary/contracts/data）へ反映する
- `features/*` は「履歴」になりやすいので、参照導線（Links）を残す

---

## 6. 記述スタイル

- 可能な限り **短く、検索しやすく**
- 図は `mermaid` を優先（C4/フロー/状態遷移）
- 箇条書きを基本にし、長文で説明しない
- 「決定」や「正」を曖昧にしない（断言する）

---

## 7. リンク指針

各ドキュメントの末尾に関連リンクを置きます。
- Spec → Plan → Tasks → PR
- Plan → ADR（判断理由）
- Overview → 主要ADR（全体の骨格）

---

## 8. 変更提案

このREADME自体の変更はADR不要です。  
ただし、ドキュメント階層（Tier）や運用ルールを大きく変える場合は、変更理由を簡単に残してください（PR説明 or ADR）。
