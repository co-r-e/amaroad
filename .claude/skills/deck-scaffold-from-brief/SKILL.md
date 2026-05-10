---
name: deck-scaffold-from-brief
description: |
  Scaffolds a new Amaroad slide deck from a user brief. Generates deck.config.ts
  and a full set of numbered MDX slide files (cover, section, content, ending).
  Use when user says "new deck", "scaffold deck", "create presentation",
  "make a deck from this brief", or "デッキを作って".
  Key capabilities: configurable slide count, language (ja/en), copyright,
  and outline pattern selection. Outputs ready-to-fill MDX structure.
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

- After generation, validate visually with `pnpm dev`.
- Treat generated text as draft only; always fact-check and polish narrative tone.

## Examples

### Example 1: English product launch deck

- User says: "Create a 12-slide deck about our new AI product launch"
- Actions:
  1. Set `--deck ai-product-launch`, `--title "AI Product Launch"`, `--brief "New AI product features, market positioning, and go-to-market strategy"`, `--slides 12`, `--lang en`.
  2. Run the scaffold script.
  3. Verify all 12 MDX files and `deck.config.ts` are created.
  4. Fill in product details, screenshots, and pricing into the generated content slides.
- Result: `decks/ai-product-launch/` with 12 numbered MDX files ready for content authoring.

### Example 2: Japanese company introduction

- User says: "会社紹介デッキを作って、8枚で"
- Actions:
  1. Set `--deck company-intro`, `--title "会社紹介"`, `--brief "会社概要、事業内容、実績、チーム紹介"`, `--slides 8`, `--lang ja`, `--copyright "© 2026 CORe Inc."`.
  2. Run the scaffold script.
  3. Verify output and fill in company-specific content.
- Result: `decks/company-intro/` with 8 Japanese-language slide stubs.

## Troubleshooting

### Error: "Directory already exists"
- **Cause**: `decks/<deck>` already exists and `--overwrite` was not passed.
- **Fix**: Add `--overwrite` flag if you intend to replace the existing deck, or choose a different deck name.

### Error: "Missing required argument"
- **Cause**: One of `--deck`, `--title`, or `--brief` was not provided.
- **Fix**: Ensure all three required arguments are included in the command.

### Generated slides have wrong structure
- **Cause**: Slide count too low for the brief complexity, or outline pattern mismatch.
- **Fix**: Increase `--slides` count (minimum 4). Review `references/outline-patterns.md` for alternative structures that better fit the brief.
