---
name: speaker-notes-polisher
description: |
  .mdxスライドのfrontmatter `notes` を補完・整形するスキル。見出し/箇条書きから要点を抽出し、
  `目的` / `話すポイント` / `目安時間` の3セクションに統一する。既存notesの不足項目補完(fill)と
  全面書き換え(rewrite)を切り替え可能。トリガー例: 「ノートを整えて」「speaker notesを補完」
---

# speaker-notes-polisher Skill

`.mdx` の frontmatter `notes` を実運用向けに整える。

## ワークフロー

### 1. 対象デッキを確定

- デッキ名（`decks/<deck-name>`）を確認する。

### 2. 実行モードを選択

- `fill`（既定）: 既存notesを残し、不足セクションのみ補完する。
- `rewrite`: 既存notesを置き換え、トーンと構成を全スライドで統一する。

### 3. スクリプトを実行

まず dry-run で差分を確認する。

```bash
npx tsx .claude/skills/speaker-notes-polisher/scripts/polish-notes.ts \
  --deck <deck-name> \
  --mode fill
```

問題なければ `--write` を付けて反映する。

```bash
npx tsx .claude/skills/speaker-notes-polisher/scripts/polish-notes.ts \
  --deck <deck-name> \
  --mode rewrite \
  --write
```

### 4. 生成内容を確認

- 各 `.mdx` の frontmatter `notes` に次の3セクションがあることを確認する。
  - `目的`
  - `話すポイント`
  - `目安時間`
- 必要に応じて語尾や専門用語だけ手修正する。

## ノート生成ルール

- 本文の `#` 見出し、Markdown箇条書き、`<li>` を優先して要点抽出する。
- 抽出量が少ない場合は本文の主要文から補助抽出する。
- `目安時間` は内容密度（箇条書き数、図表/コード有無、スライド種別）から秒数で推定する。
- 書式は [notes-style.md](./references/notes-style.md) に合わせる。

## スクリプト仕様

| 引数 | 必須 | 既定値 | 説明 |
|---|---|---|---|
| `--deck` | Yes | - | 対象デッキ名（またはデッキディレクトリ） |
| `--mode` | No | `fill` | `fill` または `rewrite` |
| `--write` | No | false | 指定時のみファイルへ書き込み |

## dry-run 出力

- 変更対象ファイル数
- ファイルごとの変更理由（新規生成/不足補完/全面書き換え）
- `notes` の差分サマリ（追加行数/削除行数）

