---
name: deck-scaffold-from-brief
description: |
  Create a new DexCode deck scaffold from a user brief.
  Generates deck.config.ts and numbered MDX slides including cover, section/content, and ending.
  Use when the user asks to start a new deck quickly from rough requirements.
---

# deck-scaffold-from-brief Skill

brief から新規 deck の骨組みを最短で作るためのスキルです。

## 使うタイミング

- 新規プレゼンを `decks/<deck>/` に作りたい
- まずは雛形を自動生成してから中身を埋めたい
- タイトルと brief はあるが、スライド構成が未確定

## 生成物

- `decks/<deck>/deck.config.ts`
- 連番 `.mdx` ファイル一式
- 最低構成に `cover` / `section` / `content` / `ending` を含む

## コマンド

```bash
npx tsx .claude/skills/deck-scaffold-from-brief/scripts/scaffold-deck.ts \
  --deck <deck-name> \
  --title "<deck title>" \
  --brief "<short brief>" \
  [--slides 10] \
  [--lang ja|en] \
  [--overwrite] \
  [--copyright "© 2026 Example Inc."]
```

## 引数仕様

- 必須:
  - `--deck`: 生成先 deck 名（`decks/<deck>`）
  - `--title`: deck タイトル
  - `--brief`: 構成元になる brief テキスト
- 任意:
  - `--slides`: 総スライド枚数（既定 `10`、最小 `4`）
  - `--lang`: `ja` or `en`（既定 `ja`）
  - `--overwrite`: 既存 `decks/<deck>` を上書き
  - `--copyright`: `deck.config.ts` に書く著作権表記

## ワークフロー

1. 入力を確定する
   - deck 名、タイトル、brief、言語、枚数を決める
   - 構成パターンが必要なら `references/outline-patterns.md` を参照
2. スクリプトを実行する
   - 既存ディレクトリがある場合は `--overwrite` を明示する
3. 標準出力の生成一覧を確認する
   - `deck.config.ts` と `.mdx` が揃っていることを確認
4. 中身を実装する
   - 各 content スライドにデータ、図解、事例を追記する
   - 必要に応じて slide type を調整する

## 失敗時の挙動

- `decks/<deck>` が存在し、`--overwrite` なし:
  - エラー終了（既存を保護）
- 必須引数不足:
  - エラー終了
- `--slides < 4`:
  - エラー終了（cover/section/content/ending を満たせないため）

## 運用メモ

- 生成後は `npm run dev` で表示確認し、情報密度を調整する
- 自動生成テキストは下書き扱い。必ず事実確認と言い回しの磨き込みを行う
