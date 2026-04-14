---
name: speaker-notes-polisher
description: |
  Standardizes speaker notes across all MDX slides in an Amaroad deck. Extracts
  key points from headings and lists, then structures them into Purpose, Talking
  Points, and Estimated Time sections. Supports fill mode (add missing sections
  only) and rewrite mode (unify tone/structure across all slides).
  Use when user says "polish notes", "fill speaker notes", "rewrite speaker notes",
  "add speaker notes", or "standardize notes".
  Key capabilities: dry-run preview before writing, per-file change reports,
  duration estimation from content density, batch processing of entire decks.
---

## Workflow

### 1. Confirm target deck

- Confirm deck name under `decks/<deck-name>`.

### 2. Choose execution mode

- `fill` (default): keep existing notes and add missing sections only
- `rewrite`: replace existing notes and unify tone/structure across all slides

### 3. Run script

Start with dry-run to inspect changes.

```bash
npx tsx .claude/skills/speaker-notes-polisher/scripts/polish-notes.ts \
  --deck <deck-name> \
  --mode fill
```

If results look good, apply changes with `--write`.

```bash
npx tsx .claude/skills/speaker-notes-polisher/scripts/polish-notes.ts \
  --deck <deck-name> \
  --mode rewrite \
  --write
```

### 4. Verify generated notes

Confirm each `.mdx` frontmatter `notes` contains:
- `Purpose`
- `Talking Points`
- `Estimated Time`

Apply manual refinements only where needed.

## Note Generation Rules

- Prioritize `#` headings, Markdown list items, and `<li>` items in slide body.
- If extracted signals are sparse, use key body lines as fallback.
- Estimate duration from content density (list count, chart/table/code presence, slide type).
- Follow formatting in `references/notes-style.md`.

## Script Spec

| Argument | Required | Default | Description |
|---|---|---|---|
| `--deck` | Yes | - | Target deck name (or direct deck directory path) |
| `--mode` | No | `fill` | `fill` or `rewrite` |
| `--write` | No | false | Write changes to files |

## Dry-run Output

- Number of changed files
- Per-file reason (`new`, `fill missing sections`, `full rewrite`)
- `notes` diff summary (added/removed line counts)

## Examples

### Example 1: Fill missing speaker notes for a deck

- User says: "Add speaker notes to my sample-deck"
- Actions:
  1. Confirm the target deck: `decks/sample-deck`
  2. Run in dry-run fill mode: `npx tsx .claude/skills/speaker-notes-polisher/scripts/polish-notes.ts --deck sample-deck --mode fill`
  3. Review the dry-run output showing which files will be updated and what sections are missing
  4. Apply changes with `--write` after user confirms
- Result: All MDX files in sample-deck now have standardized notes with Purpose, Talking Points, and Estimated Time. Files that already had complete notes are left unchanged.

### Example 2: Rewrite all notes with consistent tone

- User says: "Rewrite all speaker notes in sample-deck to have a consistent professional tone"
- Actions:
  1. Run dry-run in rewrite mode: `npx tsx ... --deck sample-deck --mode rewrite`
  2. Review proposed changes across all slides
  3. Apply with `--write` after confirmation
- Result: Every slide's notes are rewritten with uniform structure and tone, with accurate time estimates based on content density.

## Troubleshooting

### Notes section is empty after running
- **Symptom**: The script runs but some slides end up with empty or minimal notes
- **Fix**: The slide body likely has very sparse content (e.g., a single image or chart with no text). Manually add notes for these slides, as the script needs headings or list items to extract talking points from.

### Estimated time seems incorrect
- **Symptom**: Duration estimates are too short or too long for certain slides
- **Fix**: The script estimates from content density (list count, chart/table/code presence). For slides with dense visuals but sparse text, or text-heavy slides meant for quick display, manually adjust the Estimated Time after generation.

### Script cannot find the deck
- **Symptom**: Error about missing deck directory
- **Fix**: Verify the deck name matches the directory name under `decks/`. Pass just the directory name (e.g., `sample-deck`), not the full path.
