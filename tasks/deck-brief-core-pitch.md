# Deck Brief: コーレ株式会社ピッチ資料

## Metadata
| Field | Value |
|-------|-------|
| Deck Name | `core-pitch` |
| Title | コーレ株式会社 |
| Language | ja |
| Slide Count | 8 |
| Duration | 5 min |
| Speaker | 奥脇真人 / コーレ株式会社 |
| Copyright | © 2026 CORe Inc. |
| Date | TBD |

## Purpose & Audience

### Goal
VCに投資検討してもらう（シードラウンド）

### Audience
VC（ベンチャーキャピタル）。AI・テック領域の投資判断ができる層。

### Context
ピッチイベント登壇（5分）

## Content Outline

### Outline Pattern
Vision → Products → Traction → Ask

### Key Messages
1. バーティカルAIはいずれ汎用AIに飲まれる。概念を生み出す側にならないと勝てない。
2. コーレはバイブコーディングやOpenClawのように、概念を創出して市場そのものを作る会社。
3. AI領域でメイン3プロダクト + OSS 5プロジェクトをマルチ展開。シードで売上2億円弱。

### Slide-by-Slide Plan
| # | Type | Title/Topic | Notes |
|---|------|-------------|-------|
| 01 | cover | コーレ株式会社 | ロゴ + タグライン |
| 02 | content | 課題：バーティカルAIの限界 | 汎用AIに飲まれる構造問題。概念を生み出す側にならないと勝てない |
| 03 | content | ビジョン：概念を創出し、時代をリードする | バイブコーディング/OpenClawのように市場を創出する |
| 04 | content | メインプロダクト | IrukaDark / Copelf / Nefia の概要 |
| 05 | content | オープンソース | Zassha / Amaroad / Starweft / Cerememory / Rollberry |
| 06 | content | トラクション | 売上2億円弱（シード段階） |
| 07 | content | チーム | 創業メンバー紹介 |
| 08 | ending | Ask / Thank You | シードラウンド調達・連絡先 |

## Design

### Theme
- Preset: Custom
- Background: #FFFFFF
- Primary: #02001A
- Secondary: #2A2850
- Text: #02001A
- Text Muted: #6B6B7B
- Surface: #F5F5F7
- Border: #E5E5EA
- Heading Font: Inter
- Body Font: Noto Sans JP
- Mono Font: JetBrains Mono

### Layout
- Logo: `decks/core-pitch/assets/logo.png` at top-left
- Copyright: `© 2026 CORe Inc.` at bottom-left
- Page Number: bottom-right
- Accent Line: no

### Visual Notes
- ブランドカラー #02001A は白背景に強いコントラスト
- VCピッチなのでシンプル・インパクト重視
- 数字（売上）は大きく目立たせる
- ロゴ元ファイル: /Users/okuwakimasato/Desktop/コーレ/@プロフィール写真系/CORe_logo_ver2022/logo_blk.png

## Scaffold Command

```bash
npx tsx .claude/skills/deck-scaffold-from-brief/scripts/scaffold-deck.ts \
  --deck core-pitch \
  --title "コーレ株式会社" \
  --brief "AI領域のマルチプロダクト展開。概念を創出し時代をリードする。VCピッチ（シードラウンド）" \
  --slides 8 \
  --lang ja \
  --copyright "© 2026 CORe Inc."
```

## Post-Scaffold TODO
- [ ] Fill content into generated MDX stubs
- [ ] Copy logo to decks/core-pitch/assets/
- [ ] Add product descriptions and visuals
- [ ] Add team member photos/info
- [ ] Apply theme colors to deck.config.ts
- [ ] Run preflight audit
