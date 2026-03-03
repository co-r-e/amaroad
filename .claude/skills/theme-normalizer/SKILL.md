---
name: theme-normalizer
description: |
  deck.config.ts の theme.colors を基準に、decks/{deck}/*.mdx のハードコード HEX 色を
  slide CSS 変数 (var(--slide-*)) に正規化するスキル。
  まず dry-run で候補を確認し、問題なければ --write で反映する。
  Trigger: /theme-normalizer, hardcoded hex, theme color normalize, var(--slide-*)
---

# theme-normalizer Skill

MDX スライド内の色ハードコードを、デッキテーマ準拠の CSS 変数へ統一する。

## 使う場面

- `decks/<deck>/*.mdx` に `#xxxxxx` が残っていてテーマ追従しない
- 複数スライドで同じ色が散在し、保守性が落ちている
- deck のブランドカラー変更に備えて変数化したい

## ワークフロー

### 1. 対象 deck を決める

- 対象: `decks/<deck>/deck.config.ts` と `decks/<deck>/*.mdx`
- 置換元は `theme.colors` の HEX 値のみ（完全一致）

### 2. dry-run で候補確認（必須）

```bash
npx tsx .claude/skills/theme-normalizer/scripts/normalize-theme.ts --deck <deck>
```

- ファイルは更新しない
- 変更候補があるファイルだけ表示
- ファイルごとの置換件数と `HEX -> var(--slide-*)` の内訳を確認

### 3. 必要なら対象ファイルを絞る

```bash
npx tsx .claude/skills/theme-normalizer/scripts/normalize-theme.ts \
  --deck <deck> \
  --files "03-*.mdx"
```

- `--files` は簡易フィルタ
- `*` / `?` を含む場合は glob-like マッチ
- それ以外は部分一致

### 4. 反映

```bash
npx tsx .claude/skills/theme-normalizer/scripts/normalize-theme.ts \
  --deck <deck> \
  --write
```

- 候補があった箇所だけ更新
- 実行後にファイルごとの変更件数を表示

### 5. 仕上げ確認

- 変更差分を確認し、意図しない置換がないか確認
- 必要なら `--files` で再実行して局所修正

## 置換ルール

色キーと CSS 変数の対応は `references/color-mapping.md` を参照。

- 正規化対象: `theme.colors` にある HEX 値（`#RGB` / `#RRGGBB` / `#RGBA` / `#RRGGBBAA`）
- 一致判定: 大文字小文字を無視した HEX 正規化後の完全一致
- 非対象: テーマ未定義の HEX、`rgb(...)`、`hsl(...)`、グラデーション文字列

## コマンド仕様

- 必須: `--deck <deck-name>`
- 任意: `--write`（省略時は dry-run）
- 任意: `--files <glob-like substring>`
