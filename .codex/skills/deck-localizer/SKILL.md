---
name: deck-localizer
description: |
  Localize Amaroad deck MDX slides between Japanese and English while preserving
  MDX and JSX structure. Use for deck translation, bilingual deck generation,
  or notes-only/body-only localization. Supports dry-run review before writing.
---

# Deck Localizer

Translate an existing deck to Japanese or English with structure-safe automation.

## Use When

- A Amaroad deck needs `ja` to `en` or `en` to `ja` localization
- A bilingual version should be produced from the same source deck
- Only slide body or only frontmatter `notes` should be translated

## Prerequisites

- `GEMINI_API_KEY` is set, typically via `.env.local`
- Target deck exists under `decks/<deck-name>`

## Workflow

1. Confirm target deck, target language, and scope
   - `--to ja|en`
   - `--scope all|body|notes`
2. Start with dry-run
```bash
npx tsx .codex/skills/deck-localizer/scripts/localize-deck.ts \
  --deck sample-deck \
  --to en
```
3. Narrow files when needed
```bash
npx tsx .codex/skills/deck-localizer/scripts/localize-deck.ts \
  --deck sample-deck \
  --to en \
  --files "0*-*.mdx"
```
4. Apply changes only after reviewing dry-run output
```bash
npx tsx .codex/skills/deck-localizer/scripts/localize-deck.ts \
  --deck sample-deck \
  --to en \
  --write
```
5. Run follow-up checks when translation expands line length or changes claims
   - `slide-preflight-auditor`
   - `slide-overflow-fixer`
   - `fact-citation-validator`

## CLI Spec

- Required:
  - `--deck <name>`
  - `--to ja|en`
- Optional:
  - `--from auto|ja|en`
  - `--scope all|body|notes`
  - `--files <glob-like or substring>`
  - `--model <gemini-model>`
  - `--write`

## Notes

- The script protects code fences, inline code, URLs, and asset paths with placeholders.
- If structural validation fails, that file is skipped and reported.
- Review terminology and presentation tone manually after the batch run.
