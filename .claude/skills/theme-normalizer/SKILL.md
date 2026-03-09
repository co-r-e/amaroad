---
name: theme-normalizer
description: |
  Replaces hard-coded HEX colors in DexCode MDX slides with CSS variable
  references (var(--slide-*)) based on the deck's theme.colors in deck.config.ts.
  Use when user says "normalize theme", "hardcoded hex", "theme color normalize",
  "replace hex with variables", or "/theme-normalizer".
  Key capabilities: case-insensitive HEX matching (#RGB, #RRGGBB, #RGBA,
  #RRGGBBAA), dry-run preview with per-file replacement counts, glob-based file
  filtering, and safe write mode that only touches matched candidates.
---

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

## Examples

### Example 1: Preview replacements across a full deck

User says: "Normalize the hex colors in my sample-deck."

Actions:
1. Run dry-run: `npx tsx .claude/skills/theme-normalizer/scripts/normalize-theme.ts --deck sample-deck`
2. Review the per-file output showing `#1E3A5F -> var(--slide-primary)` candidates.
3. Confirm the mapping looks correct with the user.
4. Apply: `npx tsx .claude/skills/theme-normalizer/scripts/normalize-theme.ts --deck sample-deck --write`

Result: All matching hard-coded HEX values across the deck are replaced with `var(--slide-*)` references. Non-matching HEX values (those not in `theme.colors`) are left untouched.

### Example 2: Normalize a single file

User says: "Only fix the colors in 03-overview.mdx."

Actions:
1. Run with file filter: `npx tsx .claude/skills/theme-normalizer/scripts/normalize-theme.ts --deck sample-deck --files "03-overview.mdx"`
2. Review output and apply with `--write` if correct.

Result: Only the specified file is updated; other MDX files remain unchanged.

## Troubleshooting

### No candidates found but hard-coded HEX values exist in the file

Symptom: Dry-run reports zero replacements, yet you can see `#RRGGBB` values in the MDX.
Cause: The HEX value does not exactly match any color defined in `deck.config.ts` `theme.colors`. The script only replaces exact matches after case normalization.
Fix: Check whether the HEX in the MDX is a derived shade (e.g., with added alpha or a slightly different hue). If it should map to a theme color, update `deck.config.ts` to include it, or manually replace the value.

### rgb() or hsl() colors not replaced

Symptom: Colors written as `rgb(30, 58, 95)` or `hsl(210, 52%, 24%)` are ignored.
Cause: The script only matches HEX notation. `rgb(...)` and `hsl(...)` are explicitly excluded.
Fix: Manually convert these values to their HEX equivalent and re-run, or replace them by hand with the appropriate `var(--slide-*)`.

### Script cannot find deck

Symptom: Error message about missing deck directory.
Cause: The `--deck` value does not match any directory under `decks/`.
Fix: Verify the deck name with `ls decks/` and pass the exact directory name.
