# Deck Brief: エンベスト Claude 導入企画

## Metadata
| Field | Value |
|-------|-------|
| Deck Name | `envest-claude-adoption` |
| Title | Claude 導入企画 |
| Subtitle | コアメンバー3名の生産性を最大化する |
| Language | ja |
| Slide Count | 12 |
| Duration | 10 min |
| Speaker | エンベスト企画担当 |
| Copyright | （表示しない） |
| Date | 未定 |

## Purpose & Audience

### Goal
エンベスト経営層・意思決定者に「全社共通の Microsoft Copilot はそのまま継続しつつ、コアメンバー3名（部門長クラス／ディレクタークラス／ライティングクラス）に Claude を追加導入する」ことを承認してもらう。少数精鋭の3名を“最強装備”にすることで、複雑・クリエイティブ業務のパフォーマンスを最大化する。

### Audience
エンベスト（フリーランスエージェント事業）の経営層・意思決定者。事業背景および全社で Copilot を導入済みである前提は理解している。AIツールの細かい技術差分には必ずしも詳しくないため、「何が今できていないか」「Claude で何が変わるか」を業務シーンで具体的に示す必要がある。

### Context
社内提案。10分の短時間プレゼンで「3名への Claude 追加導入」の承認を得ることが目的。スコープが3名と極小なため、コスト・リスクともに小さく、承認ハードルは低い。Copilot を否定せず「役割分担」として提示することで既存投資との整合も取る。

## Content Outline

### Outline Pattern
Problem → Solution

### Key Messages
1. 全社共通の Copilot は MS内・定型オペレーションには有効だが、複数データの複合取得＋柔軟なアウトプット（数万字記事の一発生成、Google Analytics 等の分析データを基にした仮説立案→資料化、クリエイティブ編集）には対応しきれず、結局人力処理が発生している。
2. 競合エージェント（フリーランスエージェント事業の競合）はビジネス職が Claude Code / Codex 等の最先端AIで武装しており、ツール選択の時点で劣位。少人数で戦うエンベストのコアメンバーこそ最先端AIで武装すべき。
3. コアメンバー3名（部門長／ディレクター／ライター）に Claude を追加導入し「少数精鋭を最強装備に」。Copilot は全社継続、3名のみ Claude を併用。極小スコープゆえ低コスト・低リスクで始められる。
4. 期待効果は記事作成スループット10倍を筆頭に、分析資料・クリエイティブ制作の質とスピードを向上。3名パイロット → 効果検証 → 拡大のロードマップで段階的に進める。

### Slide-by-Slide Plan
| # | Type | Title/Topic | Notes |
|---|------|-------------|-------|
| 01 | cover | Claude 導入企画 ─ コアメンバー3名の生産性を最大化する | エンベストロゴを配置。Slate Minimal の冷静なトーン |
| 02 | section | 課題提起（Problem） | section divider |
| 03 | content | 現状：全社で Copilot を導入済み | Copilot の得意領域（MS内・定型オペレーションの順次実行）を Card で整理。否定せずフェアに |
| 04 | content | Copilot の限界 | 複合データ取得＋柔軟アウトプットに非対応 → 人力処理が発生。具体例3つ（数万字記事の一発生成／GA分析→仮説→資料化／クリエイティブ編集）を Card で |
| 05 | content | 危機感：競合との武装格差 | 競合エージェントはビジネス職が Claude Code / Codex で武装。ツール選択時点での劣位を訴求。実名は出さず「競合エージェント」とぼかす |
| 06 | section | 提案（Solution） | section divider |
| 07 | content | 提案サマリー：少数精鋭を最強装備に | 全社 Copilot ＋ 3名 Claude のスコープを一目で。中心メッセージを大きく1枚 |
| 08 | content | 3名 × Claude 活用シーン | 部門長／ディレクター／ライター別のユースケースを Card 3枚で。← 中核ビジュアル |
| 09 | content | Copilot × Claude 役割分担マップ | 定型・MS内業務 ⇔ 複雑・クリエイティブ業務。SVG diagram または2カラム比較で守備範囲を可視化 |
| 10 | content | 期待される効果・アウトプット | 記事作成スループット10倍を目玉数値（stats）に。分析資料／クリエイティブの Before/After 定性も添える |
| 11 | content | 導入プラン・コスト・進め方 | 会社の Team/Enterprise 契約に3名分シート追加（無ければ Max プラン）。3名パイロット → 効果検証 → 拡大のロードマップ（timeline） |
| 12 | ending | ネクストアクション | 承認 → アカウント発行 → 運用開始 → 効果レビュー。締め兼ネクストアクション |

> 注：枚数を12に収めるため、ending スライドをネクストアクション兼締めとする。必要に応じて scaffold 後に調整。

## Design

### Theme
- Preset: Slate Minimal（既存 `envest-event-proposal` デッキと統一）
- Background: #FAFAFA
- Primary: #334155 (slate-700)
- Secondary: #64748B (slate-500)
- Accent: #e7231b（エンベストロゴカラー、アクセントとしてポイント使用）
- Text: #1E293B
- Surface: #F1F5F9
- Heading Font: Inter
- Body Font: Inter（日本語は Noto Sans JP fallback）

### Layout
- Logo: `decks/envest-event-proposal/assets/logo.svg` を `decks/envest-claude-adoption/assets/logo.svg` にコピーして使用。各スライド右上に配置（height: 28px）
- Copyright: 表示しない
- Page Number: 右下に表示（hideOnCover: true）
- Accent Line: なし（Slate Minimal の控えめなトーンを維持）

### Visual Notes
- 経営層向け提案なので「信頼感・冷静・要点が明確」を重視。装飾は最小限。
- ロゴカラーの赤（#e7231b）は強調したい数値（記事作成10倍など）や比較表のハイライトに限定使用（1スライドに1箇所程度）。
- スライド08（3名×活用シーン）とスライド09（役割分担マップ）が中核ビジュアル。Card と SVG diagram で視覚的に伝える。
- 記事作成スループット10倍は stats コンポーネントで大きく見せる目玉数値。
- Copilot は否定せず「定型業務は Copilot、複雑・クリエイティブ業務は Claude」という役割分担として描く（既存投資との整合）。
- アイコンは Card 見出しの分類用途に限定。装飾的なアイコンは使わない。

## Scaffold Command

```bash
pnpm exec tsx .claude/skills/deck-scaffold-from-brief/scripts/scaffold-deck.ts \
  --deck envest-claude-adoption \
  --title "Claude 導入企画" \
  --brief "エンベスト経営層に、全社共通の Microsoft Copilot は継続しつつ、コアメンバー3名（部門長/ディレクター/ライター）に Claude を追加導入し少数精鋭を最強装備にすることを提案する10分間のプレゼン。Copilot は定型・MS内業務に強いが複合データ取得＋柔軟アウトプット（数万字記事の一発生成、GA分析→仮説→資料化、クリエイティブ編集）に非対応で人力処理が発生。競合エージェントは Claude Code/Codex で武装し劣位。記事作成10倍を目玉に効果を訴求。Problem→Solution構成。" \
  --slides 12 \
  --lang ja \
  --copyright ""
```

## Post-Scaffold TODO
- [ ] ロゴを `decks/envest-claude-adoption/assets/logo.svg` にコピー（`envest-event-proposal/assets/logo.svg` を流用）
- [ ] deck.config.ts に Slate Minimal カラーとアクセントカラー（#e7231b）を反映
- [ ] 各スライドのコンテンツを埋める（特に Copilot の限界の具体例3つ、3名×活用シーン、役割分担マップ）
- [ ] 役割分担マップを svg-diagram スキルで作成（定型⇔複雑・クリエイティブの軸）
- [ ] 記事作成10倍の stats スライドを作成（目玉数値）
- [ ] 導入プラン/コストを会社の Team/Enterprise 契約前提で記載（無ければ Max）
- [ ] preflight 監査を実行
- [ ] speaker-notes-polisher で発表ノートを整える
