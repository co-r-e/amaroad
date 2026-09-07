---
name: slide-preflight-auditor
description: |
  Runs preflight audits on Amaroad MDX slides to detect rule violations before
  review or export. Checks font sizes, accent borders, Tailwind usage, hard-coded
  colors, and missing speaker notes. Outputs line-numbered findings with severity.
  Use when user says "preflight", "lint slides", "slide audit", "safe zone check",
  "font size check", or "check my slides before export".
  Key capabilities: automated rule checking against CLAUDE.md policies, per-deck
  or all-deck scanning, CI-compatible exit codes, real-browser overflow check via
  `pnpm amaroad doctor`.
---

## Audit Rules (Aligned with CLAUDE.md)

`pnpm amaroad doctor <deck>` runs every automated check in one pass:
- `preflight` (the rules below; also available standalone via `audit-slides.ts`)
  - Minimum font size: below `1.8rem` (`fontSize`) -> `error`
  - One-sided accent border: `borderLeft` / `border-left` -> `error` (CSS-triangle
    idioms with `transparent` borders or `width: 0; height: 0` are ignored)
  - Tailwind-like `className` utilities in slides -> `error`
  - Hard-coded HEX colors like `#RRGGBB` -> `warning`
  - Missing or empty frontmatter `notes` -> `warning` (`--no-notes` to skip)
- `config`: deck.config.ts loads, `createdAt` valid, unknown slide `type`
- `manifest`: `slide-order.ts` entries vs `.mdx` files on disk
- `assets`: missing (`error`), unused (`warning`), unservable (`.xlsx` etc.) assets
- `fonts`: theme font families that are not bundled by the app (`warning`)
- `overflow`: real-browser measurement of content leaving the safe area, clipped
  content, and overlay collisions (needs `pnpm dev`; skipped with a warning otherwise)

Manual checks:
- Exception validation for `no_side_accent_borders` (for example timeline axis)
- Information density / whitespace judgement

See `references/rules.md` for detailed policy notes.

## Workflow

### 1. Run the doctor

Single deck (default; start `pnpm dev` first so the overflow check can run):

```bash
pnpm --silent amaroad doctor sample-deck
```

All decks, static checks only:

```bash
pnpm --silent amaroad doctor --all --skip overflow
```

Machine-readable output (pnpm prints install-check lines to stdout, so write to a file):

```bash
pnpm amaroad doctor sample-deck --format json --output /tmp/doctor.json
```

Preflight rules only (legacy entry point, same rule engine):

```bash
pnpm exec tsx .claude/skills/slide-preflight-auditor/scripts/audit-slides.ts --deck sample-deck --fail-on error
```

### 2. Resolve findings by priority

1. Reduce `error` to zero (`--fail-on error` is the default exit-code threshold).
2. Resolve `warning` items or document intentional exceptions.
3. `info` findings (intentional breakouts, decorative bleed, missing manifest) need no action.

### 3. Verify safe zone

The `overflow` check replaces the old manual screenshot pass: it reports the
offending element, its MDX line, and the overshoot per edge. Re-run it after
each fix; use the viewer only for a final visual sanity check.

### 4. Share audit report

Include:
- Command used
- Scope (single deck or all decks)
- `error` / `warning` counts
- Remaining exceptions and rationale

## CLI Spec

`pnpm amaroad doctor <deck|--all>`:
- `--format md|json`, `--output <file>`
- `--fail-on error|warning|never` (default: `error`)
- `--skip a,b` / `--only a,b` with `config, preflight, manifest, assets, fonts, overflow`
- `--no-notes`: do not require speaker notes
- `--base-url <url>`: server for the overflow check (default `http://127.0.0.1:3850`)

`audit-slides.ts` (preflight only):
- `--deck <name>`: limit target deck (default: all decks)
- `--format md|json`: output format (default: `md`)
- `--fail-on error`: exit code 1 if any `error` exists
- `--no-notes`: do not require speaker notes

## Notes

- `borderLeft` can be valid in limited cases (for example timeline axis), so keep human judgment in the final review.
- Small auxiliary text (dates, badges, etc.) can be contextual exceptions; review before forcing changes.

## Examples

### Example 1: Pre-export audit of a single deck

- User says: "Run preflight on my sales-pitch deck before I export"
- Actions:
  1. Run `pnpm --silent amaroad doctor sales-pitch` (with `pnpm dev` running).
  2. Review output for errors and warnings across all checks.
  3. Fix all `error` findings (e.g., replace `fontSize: "1.5rem"` with `fontSize: "1.8rem"`, or fix an `outside-safe-area` overflow at the reported line).
  4. Re-run until errors are zero.
  5. Share the audit report with error/warning counts.
- Result: Clean audit with zero errors, documented warning exceptions.

### Example 2: CI integration for all decks

- User says: "Lint all slides and fail if there are errors"
- Actions:
  1. Run `pnpm amaroad doctor --all --skip overflow` (CI has no dev server; the `visual` job runs the overflow check for sample-deck).
  2. The command exits with code 1 if any `error` exists, code 0 if clean.
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
