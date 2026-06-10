# Deck Brief: エンベストイベント企画

## Metadata
| Field | Value |
|-------|-------|
| Deck Name | `envest-event-proposal` |
| Title | エンベストイベント企画 |
| Language | ja |
| Slide Count | 10 |
| Duration | 10 min |
| Speaker | エンベスト企画担当 |
| Copyright | （表示しない） |
| Date | 未定 |

## Purpose & Audience

### Goal
エンベスト経営層に「外部エンジニアコミュニティと会場提供スポンサーとして連携することで、自社集客工数ゼロでフリーランスエンジニアと接点を持つイベント運営スキーム」を承認してもらう。

### Audience
エンベスト経営層・意思決定者。エンベスト（フリーランスエージェント事業）の事業背景は理解している前提。

### Context
社内提案。10分の短時間プレゼンで企画スキームの承認を得ることが目的。エンベスト＝自社のフリーランスエージェント事業のサービス名。

## Content Outline

### Outline Pattern
Problem → Solution

### Key Messages
1. 自社運営イベントは集客工数・コストが大きく、登録エンジニア獲得効率が悪い
2. 東銀座のエンベスト施設を外部エンジニアコミュニティに無償提供し、その代わりにイベント中のプレゼンタイムを獲得することで、ゼロ予算・ゼロ集客工数でエンジニア接点を作れる
3. Give（場所提供）& Take（プレゼンタイム）の対等な交換スキームのため、外部コミュニティ側もメリットが大きく、継続的な連携が見込める

### Slide-by-Slide Plan
| # | Type | Title/Topic | Notes |
|---|------|-------------|-------|
| 01 | cover | エンベストイベント企画 | エンベストロゴを大きく配置 |
| 02 | section | 課題提起 | section divider |
| 03 | content | 自社運営イベントの課題 | 集客工数・コストの実態を定性的に。Card形式 |
| 04 | section | 提案 | section divider |
| 05 | content | 提案サマリー：会場提供 × プレゼンタイム獲得 | 中心メッセージを大きく1枚で |
| 06 | content | スキーム図 | SVG diagram（エンベスト ⇔ 外部コミュニティの矢印図） |
| 07 | content | Give & Take の整理 | 2カラム比較（提供する場 / もらう機会） |
| 08 | content | 自社運営 vs 外部連携 比較表 | 工数・コスト・効果を定性的に比較 |
| 09 | content | 連携候補コミュニティ | ダミーテキストでカードリスト表示 |
| 10 | content | 実施スケジュール & ネクストアクション | タイムライン + 承認後の動き |

> 注：枚数を10に収めるため、ending スライドは省略し、最終スライドをネクストアクション兼締めとする。必要に応じて scaffold 後に調整。

## Design

### Theme
- Preset: Slate Minimal
- Background: #FAFAFA
- Primary: #334155 (slate-700)
- Secondary: #64748B (slate-500)
- Accent: #e7231b（エンベストロゴカラー、アクセントとしてポイント使用）
- Text: #1E293B
- Surface: #F1F5F9
- Heading Font: Inter
- Body Font: Inter（日本語は Noto Sans JP fallback）

### Layout
- Logo: `/Users/okuwakimasato/Downloads/logo.svg` を `decks/envest-event-proposal/assets/logo.svg` にコピーして使用。各スライド右上に配置
- Copyright: 表示しない
- Page Number: 右下に表示
- Accent Line: なし（Slate Minimal の控えめなトーンを維持）

### Visual Notes
- 経営層向け提案なので「信頼感・冷静・要点が明確」を重視。装飾は最小限。
- ロゴカラーの赤（#e7231b）は強調したい数値や比較表のハイライトに限定使用（1スライドに1箇所程度）。
- スキーム図と比較表が中核ビジュアル。SVG diagram と Card 比較で視覚的に伝える。
- アイコンは Card 見出しの分類用途に限定。装飾的なアイコンは使わない。

## Scaffold Command

```bash
pnpm exec tsx .claude/skills/deck-scaffold-from-brief/scripts/scaffold-deck.ts \
  --deck envest-event-proposal \
  --title "エンベストイベント企画" \
  --brief "エンベスト経営層に、外部エンジニアコミュニティと会場提供スポンサーとして連携し、ゼロ予算でエンジニア接点を作るイベント企画を提案する10分間のプレゼン。Problem→Solution構成。" \
  --slides 10 \
  --lang ja \
  --copyright ""
```

## Post-Scaffold TODO
- [ ] ロゴを `decks/envest-event-proposal/assets/logo.svg` にコピー
- [ ] deck.config.ts に Slate Minimal カラーとアクセントカラー（#e7231b）を反映
- [ ] 各スライドのコンテンツを埋める（特に課題提起と Give & Take の文言）
- [ ] スキーム図を svg-diagram スキルで作成
- [ ] 連携候補コミュニティのダミーカード（タイプ別：言語コミュニティ／勉強会主催／フリーランス窓口など）
- [ ] preflight 監査を実行
- [ ] speaker-notes-polisher で発表ノートを整える
