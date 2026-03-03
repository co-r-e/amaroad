---
name: deck-localizer
description: |
  Localize DexCode deck MDX slides between Japanese and English while preserving
  MDX/JSX structure. Supports dry-run preview and selective file scope.
  Triggers: localize deck, translate slides, ja to en deck, en to ja deck.
---

# deck-localizer Skill

Translate an existing deck to Japanese or English with structure-safe automation.

## When To Use

- You need a bilingual deck (`ja` and `en`) from the same source.
- You want to translate headings, body text, and speaker notes quickly.
- You need batch localization with dry-run before writing files.

## Prerequisites

- `GEMINI_API_KEY` must be set (typically in `.env.local`).
- Target deck exists under `decks/<deck-name>`.

## Workflow

### 1. Pick target language and scope

- `--to en` or `--to ja`
- scope:
  - `all` (default): body + notes
  - `body`: MDX body only
  - `notes`: frontmatter notes only

### 2. Run dry-run first

```bash
npx tsx .claude/skills/deck-localizer/scripts/localize-deck.ts \
  --deck sample-deck \
  --to en
```

### 3. Narrow target files when needed

```bash
npx tsx .claude/skills/deck-localizer/scripts/localize-deck.ts \
  --deck sample-deck \
  --to en \
  --files "0*-*.mdx"
```

### 4. Apply changes

```bash
npx tsx .claude/skills/deck-localizer/scripts/localize-deck.ts \
  --deck sample-deck \
  --to en \
  --write
```

### 5. Post-localization checks

Run these after translation:
- `slide-preflight-auditor`
- `slide-overflow-fixer` (if line length grows)
- `fact-citation-validator` (citations still traceable)

## CLI Spec

- Required:
  - `--deck <name>`
  - `--to ja|en`
- Optional:
  - `--from auto|ja|en` (default: `auto`)
  - `--scope all|body|notes` (default: `all`)
  - `--files <glob-like or substring>`
  - `--model <gemini-model>` (default: `gemini-2.5-flash`)
  - `--write` (default is dry-run)

## Notes

- The script protects code fences, inline code, URLs, and asset paths with placeholders.
- If structural validation fails, the file is skipped and reported.
- Human review is still required for tone and domain-specific terminology.
