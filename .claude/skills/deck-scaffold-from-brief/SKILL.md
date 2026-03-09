---
name: deck-scaffold-from-brief
description: |
  Create a new DexCode deck scaffold from a user brief.
  Generate deck.config.ts and numbered MDX slides including cover, section/content, and ending.
  Use when starting a new presentation, turning a rough brief into slide structure,
  or creating a first-pass slide flow before detailed writing.
  Triggers: new deck, scaffold deck, create presentation, デッキを作って.
---

## Outputs

- `decks/<deck>/deck.config.ts`
- A full set of numbered `.mdx` files
- At minimum includes `cover`, `section`, `content`, and `ending`

## Command

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

## Arguments

- Required:
  - `--deck`: target deck name (`decks/<deck>`)
  - `--title`: deck title
  - `--brief`: source brief text
- Optional:
  - `--slides`: total slide count (default `10`, minimum `4`)
  - `--lang`: `ja` or `en` (default `en`)
  - `--overwrite`: replace existing `decks/<deck>`
  - `--copyright`: copyright text written into `deck.config.ts`

## Workflow

1. Confirm inputs
   - Decide deck name, title, brief, language, and slide count.
   - If needed, choose a structure pattern from `references/outline-patterns.md`.
2. Run script
   - If target directory exists, explicitly pass `--overwrite`.
3. Check generated list in stdout
   - Verify `deck.config.ts` and numbered `.mdx` files are all created.
4. Fill real content
   - Add data, diagrams, and examples to content slides.
   - Adjust slide types as needed.

## Failure Behavior

- `decks/<deck>` exists without `--overwrite`:
  - exits with error (protect existing deck)
- Missing required arguments:
  - exits with error
- `--slides < 4`:
  - exits with error (cannot satisfy cover/section/content/ending minimum)

## Operational Notes

- After generation, validate visually with `npm run dev`.
- Treat generated text as draft only; always fact-check and polish narrative tone.
