---
name: deck-scaffold-from-brief
description: |
  Scaffolds a new Amaroad slide deck from a user brief. Generates deck.config.ts
  and a full set of numbered MDX slide files (cover, section, content, ending).
  Use when user says "new deck", "scaffold deck", "create presentation",
  "make a deck from this brief", or the Japanese equivalent "デッキを作って".
  Key capabilities: configurable slide count (minimum 4), language selection
  (ja/en), copyright text, outline pattern selection, and overwrite protection
  for existing decks. Runs via Codex scripts path.
---

# Deck Scaffold From Brief

Create a new Amaroad deck skeleton from a short brief with minimal setup time.

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

## Examples

### Example 1: Create a 10-slide English deck

User says: "Create a new deck about AI adoption strategy for my team."

Actions:
1. Confirm deck name (`ai-adoption-strategy`), title, and brief with user.
2. Run: `npx tsx .codex/skills/deck-scaffold-from-brief/scripts/scaffold-deck.ts --deck ai-adoption-strategy --title "AI Adoption Strategy" --brief "Overview of AI adoption roadmap for engineering teams" --slides 10 --lang en`
3. Verify generated files in stdout and on disk.
4. Preview with `npm run dev` and fill in real content.

Result: `decks/ai-adoption-strategy/` directory with `deck.config.ts` and 10 numbered MDX files (cover, sections, content, ending).

### Example 2: Overwrite an existing deck with Japanese content

User says: "Redo the sample-deck scaffold in Japanese with 8 slides."

Actions:
1. Run with overwrite flag: `npx tsx .codex/skills/deck-scaffold-from-brief/scripts/scaffold-deck.ts --deck sample-deck --title "サンプルデッキ" --brief "デモ用サンプル" --slides 8 --lang ja --overwrite`
2. Confirm the existing deck was replaced.

Result: `decks/sample-deck/` is regenerated with 8 Japanese-language MDX slides.

## Troubleshooting

### Error: deck directory already exists

Symptom: Script exits with an error saying the deck directory exists.
Cause: The target `decks/<deck>` already contains files and `--overwrite` was not passed.
Fix: Add `--overwrite` to the command if you intend to replace the existing deck. Otherwise, choose a different deck name.

### Error: slides must be 4 or more

Symptom: Script exits with a validation error.
Cause: `--slides` was set to a value less than 4, which is the minimum needed for cover, section, content, and ending.
Fix: Set `--slides` to 4 or higher.

### Generated slides have placeholder text

Symptom: MDX files contain generic placeholder text instead of real content.
Cause: This is expected behavior. The scaffold generates draft structure only.
Fix: Fill in real content after scaffolding. Use other skills (fact-citation-validator, speaker-notes-polisher) to refine.
