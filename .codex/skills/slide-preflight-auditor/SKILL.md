---
name: slide-preflight-auditor
description: |
  Run preflight audits for Amaroad MDX slides before review or export. Detect
  rule violations, report line-numbered findings, and surface manual checks for
  safe-zone and overlay problems.
---

# Slide Preflight Auditor

Audit Amaroad slide quality mechanically before review and export.

## Use When

- Running a preflight check on one deck or all decks
- Looking for CLAUDE.md-aligned rule violations
- Preparing slides for review, export, or release

## Automated Rules

Detected by `scripts/audit-slides.ts`:

- `fontSize` below `1.8rem` as `error`
- `borderLeft` or `border-left` as `error`
- Tailwind-like `className` utilities in slides as `error`
- Hard-coded HEX colors as `warning`
- Missing or empty frontmatter `notes` as `warning`

Manual checks still required:

- Safe-zone overflow
- Overlay collisions
- Intentional exceptions for one-sided borders

## Workflow

1. Run the audit
```bash
npx tsx .codex/skills/slide-preflight-auditor/scripts/audit-slides.ts --deck sample-deck
```
2. Reduce `error` to zero
3. Resolve or document `warning` items
4. Manually verify safe-zone fit in the viewer or presenter

## CLI Spec

- `--deck <name>`
- `--format md|json`
- `--fail-on error`

## Notes

- See `references/rules.md` for rule detail.
- Small context-specific typography exceptions still require judgment.
