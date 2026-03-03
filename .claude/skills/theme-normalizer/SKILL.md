---
name: theme-normalizer
description: |
  Normalize hard-coded HEX colors in decks/{deck}/*.mdx into slide CSS variables
  based on deck.config.ts theme.colors.
  Run dry-run first to review candidates, then apply with --write.
  Trigger: /theme-normalizer, hardcoded hex, theme color normalize, var(--slide-*)
---

# theme-normalizer Skill

Unify hard-coded MDX colors into deck-theme CSS variables.

## When To Use

- `decks/<deck>/*.mdx` still contains hard-coded `#xxxxxx` colors
- The same color is duplicated across many slides, hurting maintainability
- You need reliable theme-following behavior before brand color changes

## Workflow

### 1. Select target deck

- Target files: `decks/<deck>/deck.config.ts` and `decks/<deck>/*.mdx`
- Replacement source: only HEX values defined in `theme.colors` (exact normalized match)

### 2. Run dry-run first (required)

```bash
npx tsx .claude/skills/theme-normalizer/scripts/normalize-theme.ts --deck <deck>
```

- Does not modify files
- Shows only files with candidate replacements
- Reports per-file replacement counts and `HEX -> var(--slide-*)` breakdown

### 3. Narrow scope when needed

```bash
npx tsx .claude/skills/theme-normalizer/scripts/normalize-theme.ts \
  --deck <deck> \
  --files "03-*.mdx"
```

- `--files` supports simple filtering
- With `*` / `?`, uses glob-like matching
- Otherwise uses substring matching

### 4. Apply changes

```bash
npx tsx .claude/skills/theme-normalizer/scripts/normalize-theme.ts \
  --deck <deck> \
  --write
```

- Updates only matched candidates
- Prints per-file replacement counts after write

### 5. Final check

- Review diffs for unintended replacements
- Re-run with `--files` for targeted refinement if needed

## Replacement Rules

See `references/color-mapping.md` for full key mapping.

- Included: HEX values in `theme.colors` (`#RGB`, `#RRGGBB`, `#RGBA`, `#RRGGBBAA`)
- Match strategy: case-insensitive, normalized HEX exact match
- Excluded: undefined HEXs, `rgb(...)`, `hsl(...)`, gradient strings

## CLI Spec

- Required: `--deck <deck-name>`
- Optional: `--write` (default is dry-run)
- Optional: `--files <glob-like substring>`
