---
name: deck-localizer
description: |
  Translates Amaroad MDX slides between Japanese and English while preserving
  MDX/JSX structure, code fences, URLs, and asset paths. Uses Gemini API for
  high-quality batch translation with structural validation.
  Use when user says "localize deck", "translate slides", "ja to en deck",
  "en to ja deck", "translate this deck to English/Japanese".
  Key capabilities: auto language detection, scope control (body/notes/all),
  glob-based file filtering, dry-run preview, placeholder protection for code
  and URLs, and post-localization integration with preflight and overflow checks.
---

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

## Examples

### Example 1: Translate an entire deck from Japanese to English

- User says: "Translate sample-deck to English"
- Actions:
  1. Run dry-run: `npx tsx .claude/skills/deck-localizer/scripts/localize-deck.ts --deck sample-deck --to en`
  2. Review the dry-run output showing proposed translations for each file
  3. Apply with `--write` after user confirms the preview
  4. Run `slide-preflight-auditor` to check for any rule violations introduced by translation
  5. Run `slide-overflow-fixer` if English text is longer than the original Japanese
- Result: All MDX slides in sample-deck are translated to English with structure, code, and asset paths preserved.

### Example 2: Translate only speaker notes for specific slides

- User says: "Translate the speaker notes of slides 01 through 05 to Japanese"
- Actions:
  1. Run with scope and file filter: `npx tsx ... --deck sample-deck --to ja --scope notes --files "0[1-5]*"`
  2. Review dry-run output
  3. Apply with `--write`
- Result: Only the frontmatter `notes` of slides matching the pattern are translated to Japanese. Slide body content remains unchanged.

## Troubleshooting

### Structural validation fails and files are skipped
- **Symptom**: Some files are reported as skipped due to validation failure
- **Fix**: The translation altered the MDX/JSX structure (e.g., broke a JSX tag). Review the skipped file manually. Common causes: translated text inserted inside a JSX attribute, or a closing tag was modified. Re-run on just that file after fixing structure issues.

### GEMINI_API_KEY not set
- **Symptom**: Script exits with an API key error
- **Fix**: Add `GEMINI_API_KEY=your-key-here` to `.env.local` at the project root.

### Translated text overflows slide boundaries
- **Symptom**: English translations are longer than Japanese originals and spill outside the slide area
- **Fix**: Run `slide-overflow-fixer` after localization. English text is typically 1.5-2x longer than Japanese for the same content, so overflow is expected and handled by the overflow fixer.
