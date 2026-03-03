---
name: speaker-notes-polisher
description: |
  Refine .mdx frontmatter `notes` by extracting key points from headings and lists,
  then standardize them into three sections: `Purpose`, `Talking Points`, and `Estimated Time`.
  Support both missing-section fill mode and full rewrite mode.
  Triggers: polish notes, fill speaker notes, rewrite speaker notes.
---

# speaker-notes-polisher Skill

Improve frontmatter `notes` in `.mdx` slides for presentation-ready delivery.

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
