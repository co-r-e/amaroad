---
name: deck-scaffold-from-brief
description: |
  Create a new DexCode deck scaffold from a user brief. Generate deck.config.ts
  and numbered MDX slides including cover, section/content, and ending. Use
  when starting a new deck quickly from rough requirements.
---

# Deck Scaffold From Brief

Create a new DexCode deck skeleton from a short brief with minimal setup time.

## Use When

- Starting a new presentation under `decks/<deck>/`
- Creating a first-pass slide flow before detailed writing
- Turning a rough brief into a consistent slide file structure

## Outputs

- `decks/<deck>/deck.config.ts`
- Numbered `.mdx` slides
- At minimum: `cover`, `section`, `content`, and `ending`

## Workflow

1. Confirm deck name, title, brief, language, and target slide count
2. If needed, inspect `references/outline-patterns.md` for a suitable outline
3. Generate the scaffold
```bash
npx tsx .codex/skills/deck-scaffold-from-brief/scripts/scaffold-deck.ts \
  --deck <deck-name> \
  --title "<deck title>" \
  --brief "<short brief>" \
  [--slides 10] \
  [--lang ja|en] \
  [--overwrite] \
  [--copyright "© 2026 Example Inc."]
```
Default language is `en` unless you pass `--lang ja`.
4. Verify the generated files in stdout and on disk
5. Fill real content, then preview with `npm run dev`

## Failure Behavior

- Existing `decks/<deck>` without `--overwrite` causes an error
- Missing required arguments causes an error
- `--slides < 4` causes an error

## Notes

- Treat generated copy as draft text.
- Fact-check, polish narrative flow, and refine slide types after generation.
