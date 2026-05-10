---
name: speaker-notes-polisher
description: |
  Refine Amaroad slide frontmatter notes by extracting key points from headings
  and lists, then standardize them into Purpose, Talking Points, and Estimated
  Time. Supports fill mode and full rewrite mode.
---

# Speaker Notes Polisher

Improve `.mdx` frontmatter `notes` for presentation-ready delivery.

## Use When

- Speaker notes are missing or uneven across a deck
- Existing notes should be normalized into a consistent structure
- Notes need a fast first pass before manual polishing

## Workflow

1. Confirm the target deck
2. Choose execution mode
   - `fill` keeps existing notes and fills missing sections
   - `rewrite` replaces notes for consistency
3. Start with dry-run
```bash
npx tsx .codex/skills/speaker-notes-polisher/scripts/polish-notes.ts \
  --deck <deck-name> \
  --mode fill
```
4. Apply with `--write` after reviewing the summary
5. Verify each slide note includes:
   - `Purpose`
   - `Talking Points`
   - `Estimated Time`

## Script Spec

- `--deck <name>` required
- `--mode fill|rewrite` optional
- `--write` optional

## Notes

- Extraction prioritizes headings, markdown lists, and `<li>` content.
- Use `references/notes-style.md` if note formatting guidance is needed.
