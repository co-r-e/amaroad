---
name: slide-preflight-auditor
description: |
  Runs preflight audits on Amaroad MDX slides to detect rule violations before
  review or export. Checks font sizes, accent borders, Tailwind usage, hard-coded
  colors, and missing speaker notes. Outputs line-numbered findings with severity.
  Use when user says "preflight", "lint slides", "slide audit", "safe zone check",
  "font size check", or "check my slides before export".
  Key capabilities: automated rule checking against CLAUDE.md policies, per-deck
  or all-deck scanning, CI-compatible exit codes, manual safe-zone checklist.
---

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

## Examples

### Example 1: Pre-export audit of a single deck

- User says: "Run preflight on my sales-pitch deck before I export"
- Actions:
  1. Run `npx tsx .claude/skills/slide-preflight-auditor/scripts/audit-slides.ts --deck sales-pitch`.
  2. Review output for errors and warnings.
  3. Fix all `error` findings (e.g., replace `fontSize: "1.5rem"` with `fontSize: "1.8rem"`).
  4. Manually check safe zone by viewing slides in the dev server.
  5. Share the audit report with error/warning counts.
- Result: Clean audit with zero errors, documented warning exceptions.

### Example 2: CI integration for all decks

- User says: "Lint all slides and fail if there are errors"
- Actions:
  1. Run `npx tsx .claude/skills/slide-preflight-auditor/scripts/audit-slides.ts --fail-on error`.
  2. Script exits with code 1 if any `error` exists, code 0 if clean.
  3. Fix any flagged errors before re-running.
- Result: All decks pass automated checks; exit code 0.

## Troubleshooting

### False positive on borderLeft
- **Cause**: The audit flags `borderLeft` in a timeline slide where the vertical line represents a chronological axis.
- **Fix**: This is a documented exception in `CLAUDE.md`. Note it as an intentional exception in your audit report. The auditor cannot distinguish context, so human review is required.

### Warning for hard-coded HEX colors
- **Cause**: A slide uses `#RRGGBB` instead of CSS variables like `var(--slide-primary)`.
- **Fix**: Replace hard-coded colors with the appropriate CSS variable. If the color genuinely has no matching variable, document the exception.

### Font size errors on auxiliary text
- **Cause**: Dates, badges, or captions use font sizes below 1.8rem.
- **Fix**: Per CLAUDE.md, dates/badges/auxiliary text are exceptions to the minimum font size rule. If the flagged text is genuinely auxiliary, note it as an exception.
