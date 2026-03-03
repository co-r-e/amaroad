---
name: slide-preflight-auditor
description: |
  Run preflight audits for DexCode MDX slides before review/export.
  Detect rule violations from CLAUDE.md and output line-numbered findings.
  Triggers: preflight, lint slides, slide audit, safe zone check, font size check.
---

# slide-preflight-auditor Skill

Audit DexCode slide quality mechanically before review and export.

## Purpose

- Detect CLAUDE.md rule violations early.
- Pinpoint fix targets quickly with file and line numbers.
- Include manual checks for items that cannot be fully verified automatically (for example safe zone collisions).

## Audit Rules (Aligned with CLAUDE.md)

Automatically detected by `audit-slides.ts`:
- Minimum font size: below `1.8rem` (`fontSize`) -> `error`
- One-sided accent border: `borderLeft` / `border-left` -> `error`
- Tailwind-like `className` utilities in slides -> `error`
- Hard-coded HEX colors like `#RRGGBB` -> `warning`
- Missing or empty frontmatter `notes` -> `warning`

Manual checks:
- Safe-zone overflow (content escaping inviolable area, overlay collisions)
- Exception validation for `no_side_accent_borders` (for example timeline axis)

See `references/rules.md` for detailed policy notes.

## Workflow

### 1. Run automated audit

All decks:

```bash
npx tsx .claude/skills/slide-preflight-auditor/scripts/audit-slides.ts
```

Single deck:

```bash
npx tsx .claude/skills/slide-preflight-auditor/scripts/audit-slides.ts --deck sample-deck
```

CI mode (fail on error):

```bash
npx tsx .claude/skills/slide-preflight-auditor/scripts/audit-slides.ts --fail-on error
```

### 2. Resolve findings by priority

1. Reduce `error` to zero.
2. Resolve `warning` items or document intentional exceptions.

### 3. Manually verify safe zone

Automated checks do not fully cover safe-zone problems, so always perform final viewer/presenter validation.

Checklist:
- No content clipped outside slide frame
- No collisions with logo/copyright/page-number overlays
- No excessive whitespace that hurts information density

### 4. Share audit report

Include:
- Command used
- Scope (single deck or all decks)
- `error` / `warning` counts
- Remaining exceptions and rationale

## CLI Spec (`audit-slides.ts`)

- `--deck <name>`: limit target deck (default: all decks)
- `--format md|json`: output format (default: `md`)
- `--fail-on error`: exit code 1 if any `error` exists

## Notes

- `borderLeft` can be valid in limited cases (for example timeline axis), so keep human judgment in the final review.
- Small auxiliary text (dates, badges, etc.) can be contextual exceptions; review before forcing changes.
