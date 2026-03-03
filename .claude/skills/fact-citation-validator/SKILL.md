---
name: fact-citation-validator
description: |
  Validate factual and numeric claims in DexCode MDX slides and flag lines
  missing citations. Use before release/export when you need traceable sources.
  Triggers: citation check, fact check slides, source audit, claim validator.
---

# fact-citation-validator Skill

Audit slides for unsupported factual claims and report line-numbered findings.

## Purpose

- Reduce unsupported numeric claims before external sharing.
- Standardize citation quality across decks.
- Produce deterministic reports that are easy to fix.

## What It Checks

Automated by `validate-citations.ts`:
- Numeric/factual claim lines in `decks/<deck>/*.mdx`
- Missing citation near claim line (`error`)
- Citation marker without verifiable link (`warning`)

Citation evidence accepted:
- Markdown link with `http/https`
- Plain `http/https` URL
- `Source:` / `Sources:` / `Reference:` markers (warning if no link)

Detailed policy: `references/citation-policy.md`

## Workflow

### 1. Run dry audit

All decks:

```bash
npx tsx .claude/skills/fact-citation-validator/scripts/validate-citations.ts
```

Single deck:

```bash
npx tsx .claude/skills/fact-citation-validator/scripts/validate-citations.ts --deck sample-deck
```

### 2. Fix by priority

1. Reduce `error` to zero.
2. Upgrade weak markers to verifiable links.

### 3. Enforce in CI when needed

```bash
npx tsx .claude/skills/fact-citation-validator/scripts/validate-citations.ts --fail-on error
```

### 4. Share report

Include:
- command and scope
- error/warning counts
- any intentional exceptions

## CLI Spec

- `--deck <name>`: audit one deck (default: all decks)
- `--format md|json`: output format (default: `md`)
- `--window <N>`: citation search radius in lines around a claim (default: `2`)
- `--fail-on error|warning`: fail process when threshold is met

## Notes

- The checker is heuristic by design; final publication review still needs human judgment.
- Keep source links close to claims for deterministic detection.
