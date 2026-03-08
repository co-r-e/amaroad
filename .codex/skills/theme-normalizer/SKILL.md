---
name: theme-normalizer
description: |
  Normalize hard-coded HEX colors in deck MDX files into slide CSS variables
  derived from deck.config.ts theme.colors. Use dry-run first, then apply with
  write mode when a deck should follow theme variables consistently.
---

# Theme Normalizer

Unify hard-coded MDX colors into deck-theme CSS variables.

## Use When

- `decks/<deck>/*.mdx` still contains repeated hard-coded HEX values
- Theme changes should propagate reliably through slide variables
- A deck needs maintainable color usage before review or branding updates

## Workflow

1. Select the target deck
2. Run dry-run first
```bash
npx tsx .codex/skills/theme-normalizer/scripts/normalize-theme.ts --deck <deck>
```
3. Narrow the target file set when needed
```bash
npx tsx .codex/skills/theme-normalizer/scripts/normalize-theme.ts \
  --deck <deck> \
  --files "03-*.mdx"
```
4. Apply changes only after reviewing candidates
```bash
npx tsx .codex/skills/theme-normalizer/scripts/normalize-theme.ts \
  --deck <deck> \
  --write
```
5. Review the diff and rerun with narrower scope if needed

## Replacement Rules

- Replace only normalized HEX values defined in `theme.colors`
- Matching is case-insensitive exact HEX match
- Do not rewrite colors outside the mapped theme values

## Notes

- See `references/color-mapping.md` for full mapping detail.
- Gradients and non-HEX color expressions are intentionally excluded.
