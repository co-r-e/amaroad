---
name: slide-preflight-auditor
description: |
  Run preflight audits for DexCode MDX slides before review/export.
  Detect rule violations from CLAUDE.md and output line-numbered findings.
  Triggers: preflight, lint slides, slide audit, safe zone check, font size check.
---

# slide-preflight-auditor Skill

DexCode のスライド品質を、提出前に機械的に監査するためのスキルです。

## 目的

- CLAUDE.md のスライドルール違反を早期検知する
- 修正対象を「ファイル + 行番号」で即座に特定する
- 目視チェックが必要な項目（safe zone など）を監査フローに組み込む

## 監査ルール（CLAUDE.md準拠）

自動検出（`audit-slides.ts`）:
- 最小フォントサイズ: `1.8rem` 未満（`fontSize`）は `error`
- 片側アクセント罫線: `borderLeft` / `border-left` は `error`
- Tailwind 風 `className`: ユーティリティクラス検出で `error`
- ハードコード HEX 色: `#RRGGBB` などは `warning`
- notes 欠落/空: frontmatter `notes` 未設定または空は `warning`

目視検出（手動）:
- safe zone 逸脱（不可侵領域外へのはみ出し、overlay との衝突）
- `no_side_accent_borders` の例外判定（タイムライン軸かどうか）

詳細ルールは `references/rules.md` を参照。

## 実行フロー

### 1. 自動監査を実行

全 deck:

```bash
npx tsx .claude/skills/slide-preflight-auditor/scripts/audit-slides.ts
```

特定 deck のみ:

```bash
npx tsx .claude/skills/slide-preflight-auditor/scripts/audit-slides.ts --deck sample-deck
```

CI 用（error で失敗）:

```bash
npx tsx .claude/skills/slide-preflight-auditor/scripts/audit-slides.ts --fail-on error
```

### 2. 出力を修正優先度順に処理

1. `error` を先にゼロ化
2. `warning` は意図的例外かどうかを確認して修正/記録

### 3. safe zone を目視確認

自動検査だけでは safe zone 逸脱は取りこぼすため、必ず viewer/presenter で最終確認する。

確認観点:
- コンテンツが枠外にはみ出していない
- ロゴ/著作権/ページ番号 overlay と衝突していない
- 過剰余白で情報密度が落ちていない

### 4. レポート共有

報告には以下を含める:
- 実行コマンド
- 監査対象（deck or 全deck）
- `error/warning` 件数
- 残件（例外扱いの理由を含む）

## CLI 仕様（audit-slides.ts）

- `--deck <name>`: 対象 deck を限定（省略時は全 deck）
- `--format md|json`: 出力形式（既定: `md`）
- `--fail-on error`: `error` が1件でもあれば exit code 1

## 注意点

- `borderLeft` はタイムライン軸などの例外があり得るため、最終判断は人間が行う。
- `fontSize` の補助的要素（日時・バッジ等）は文脈で許容されることがあるため、必要に応じてレビューで補正する。
