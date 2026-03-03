# slide-preflight-auditor Rules

本ドキュメントは `CLAUDE.md` のうち、preflight 監査で使う主要ルールだけを抽出した実務向けメモです。

## 1. Safe Zone（不可侵領域）

- スライド本文は `SlideFrame` の content area 内に収める
- overlay（logo/copyright/page number）と衝突させない
- 負の margin などで領域外へ押し出さない
- これは目視確認が必須（自動検出対象外）

## 2. 最小フォントサイズ

- ルール: 本文テキストは `1.8rem` 以上
- 監査: `fontSize` 指定が `1.8rem` 未満なら `error`
- 補足: 日時・バッジなど補助テキストは文脈例外あり

## 3. 片側アクセント罫線禁止

- ルール: `border-left` 系の強調は原則禁止
- 監査: `borderLeft` / `border-left` を `error` として報告
- 例外: タイムライン軸として意味を持つ線

## 4. Tailwind Utility 禁止（slides）

- ルール: slide MDX と `src/components/mdx` で Tailwind utility class を使わない
- 監査: tailwind-like `className` を `error` 報告

## 5. ハードコード色警告

- ルール: テーマ変数（`var(--slide-*)`）優先
- 監査: HEX 色リテラル（`#RGB`, `#RRGGBB` など）を `warning`

## 6. notes 欠落警告

- ルール: frontmatter `notes` を付与して発表時の文脈を残す
- 監査: `notes` 未定義または空を `warning`
