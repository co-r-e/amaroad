# Deck Brief: AIエージェント基礎

## Metadata
| Field | Value |
|-------|-------|
| Deck Name | `ai-agent-basics` |
| Title | AIエージェント基礎 |
| Language | ja |
| Slide Count | 24 |
| Duration | 30 min |
| Speaker | Masato Okuwaki / CORe Inc. |
| Copyright | © CORe Inc. |
| Date | TBD |

## Purpose & Audience

### Goal
AIエージェントを触らないとまずいと感じてもらう。エージェントの概念・技術・ツールを理解し、行動の緊急性を認識させる。

### Audience
AIに詳しくないビジネス職。クライアント企業の方々。

### Context
クライアント向けレクチャー。投影のみ（PDF配布なし）。

## Content Outline

### Outline Pattern
Before → After → 危機感

### Key Messages
1. 今のAI（Copilot）は「聞かれたら答える」だけ。エージェントは自律的にタスクを実行する。
2. エージェントを支える技術（プロンプト/コンテキストエンジニアリング、MCP、Skills、スケジュール）が急速に進化している。
3. AIによる人員整理はすでに始まっている。触らないことが最大のリスク。

### Slide-by-Slide Plan
| # | Type | Title/Topic | Notes |
|---|------|-------------|-------|
| 01 | cover | AIエージェント基礎 | |
| 02 | section | 今のAI | パート1 |
| 03 | content | Copilotでできること | Copilotの機能概要を概念図で |
| 04 | content | Copilotの限界 — 「聞かれたら答える」止まり | チャット型AIの制約を明示 |
| 05 | section | これからのAI — エージェントの世界 | パート2 |
| 06 | content | チャット vs エージェント — 何が違うのか | 比較図で対比 |
| 07 | content | エージェントの動き方 — 自律的にタスクを実行する | フロー図：観察→判断→実行ループ |
| 08 | content | 具体例：エージェントが仕事をこなす流れ | 実務シナリオで説明 |
| 09 | section | エージェントを支える技術 | パート3 |
| 10 | content | プロンプトエンジニアリング | 指示の書き方が結果を変える |
| 11 | content | コンテキストエンジニアリング | 必要な情報を適切に渡す技術 |
| 12 | content | コンテキストウィンドウ — AIの「作業記憶」 | 概念図：ウィンドウサイズと性能の関係 |
| 13 | content | MCP — AIとツールをつなぐ標準規格 | アーキテクチャ図 |
| 14 | content | Agent Skills — 専門能力の追加 | スキルの概念と例 |
| 15 | content | スケジュール機能 — 自動で動くエージェント | 定期実行・トリガーベースの自動化 |
| 16 | section | 最前線のツール | パート4 |
| 17 | content | Claude Code & Agent Teams | マルチエージェント協調の概念図 |
| 18 | content | Codex multi-Agents | OpenAI Codexのマルチエージェント |
| 19 | content | Claude Cowork | Coworkの機能概要 |
| 20 | section | 動かないリスク | パート5 |
| 21 | content | AIによる人員整理 — すでに起きていること | 実例・数字で危機感 |
| 22 | content | 「触らない」が最大のリスク | メッセージを強調 |
| 23 | content | 今日からできるファーストステップ | 具体的なアクションを提示 |
| 24 | ending | まとめ | |

## Design

### Theme
- Preset: Corporate Navy (Custom)
- Background: #FFFFFF
- Primary: #02001A
- Secondary: #3B82F6
- Text: #02001A
- Text Muted: #5a6577
- Surface: #F4F6F9
- Border: #E2E6EC
- Heading Font: Source Sans Pro
- Body Font: Noto Sans JP

### Layout
- Logo: CORe Inc. logo at top-right
- Copyright: © CORe Inc. at bottom-left
- Page Number: bottom-right
- Accent Line: no

### Visual Notes
- 概念図ベースで構成。スクリーンショット枠は不要。
- パート5「動かないリスク」はインパクト重視のビジュアル。
- 聴衆はAI初心者のビジネス職なので、技術用語は必ず平易な説明を添える。

## Scaffold Command

```bash
npx tsx .claude/skills/deck-scaffold-from-brief/scripts/scaffold-deck.ts \
  --deck ai-agent-basics \
  --title "AIエージェント基礎" \
  --brief "tasks/deck-brief-ai-agent-basics.md" \
  --slides 24 \
  --lang ja \
  --copyright "© CORe Inc."
```

## Post-Scaffold TODO
- [ ] Fill content into generated MDX stubs
- [ ] Add concept diagrams (svg-diagram skill)
- [ ] Apply theme colors to deck.config.ts
- [ ] Run preflight audit
- [ ] Polish speaker notes
