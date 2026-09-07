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

## Automated Checks

`pnpm amaroad doctor <deck>` runs everything in one pass:

- `preflight` (also standalone via `scripts/audit-slides.ts`):
  `fontSize` below `1.8rem` (`error`), `borderLeft` / `border-left` (`error`,
  CSS-triangle idioms ignored), Tailwind-like `className` (`error`), hard-coded
  HEX colors (`warning`), missing or empty frontmatter `notes` (`warning`)
- `config`: deck.config.ts loads, `createdAt` valid, unknown slide `type`
- `manifest`: `slide-order.ts` vs `.mdx` files on disk
- `assets`: missing / unused / unservable assets
- `fonts`: theme fonts not bundled by the app
- `overflow`: real-browser safe-zone measurement with element selector, MDX
  line, and per-edge overshoot (needs `pnpm dev`)

Manual checks still required:

- Intentional exceptions for one-sided borders
- Information density judgement

## Workflow

1. Run the doctor (start `pnpm dev` first for the overflow check)
```bash
pnpm --silent amaroad doctor sample-deck
```
   Preflight rules only:
```bash
pnpm exec tsx .codex/skills/slide-preflight-auditor/scripts/audit-slides.ts --deck sample-deck
```
2. Reduce `error` to zero
3. Resolve or document `warning` items
4. Re-run after each fix; the viewer is only a final sanity check

## CLI Spec

`pnpm amaroad doctor <deck|--all>`:
- `--format md|json`, `--output <file>`
- `--fail-on error|warning|never` (default `error`)
- `--skip a,b` / `--only a,b` (`config, preflight, manifest, assets, fonts, overflow`)
- `--no-notes`, `--base-url <url>`

`audit-slides.ts`:
- `--deck <name>`, `--format md|json`, `--fail-on error`, `--no-notes`

## Notes

- See `references/rules.md` for rule detail.
- Small context-specific typography exceptions still require judgment.
