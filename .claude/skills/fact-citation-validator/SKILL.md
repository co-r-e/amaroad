---
name: fact-citation-validator
description: |
  Scans DexCode MDX slides for numeric and factual claims, then flags lines
  that lack verifiable citations. Produces a line-numbered report with error
  and warning severity levels.
  Use when user says "citation check", "fact check slides", "source audit",
  "claim validator", "check sources", or "validate references".
  Key capabilities: heuristic claim detection, configurable citation search
  radius, markdown and JSON output formats, CI-friendly --fail-on flag,
  single-deck or all-decks scope, and accepted evidence types (URLs, Source
  markers, markdown links).
---

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

## Examples

### Example 1: Audit a single deck before sharing externally

- User says: "Check citations in sample-deck before I share it"
- Actions:
  1. Run: `npx tsx .claude/skills/fact-citation-validator/scripts/validate-citations.ts --deck sample-deck`
  2. Review the report: errors (claims with no citation) and warnings (citation markers without verifiable links)
  3. Fix errors first by adding source URLs near claim lines
  4. Upgrade warnings by replacing plain "Source:" markers with full markdown links
- Result: A line-numbered report showing all unsupported claims, with zero errors after fixes are applied.

### Example 2: Enforce citation standards in CI

- User says: "Add citation validation to our CI pipeline"
- Actions:
  1. Add to CI config: `npx tsx .claude/skills/fact-citation-validator/scripts/validate-citations.ts --fail-on error`
  2. This will exit with non-zero status if any error-level findings exist
  3. Optionally use `--format json` for machine-readable output
- Result: CI pipeline fails when slides contain unsupported numeric claims, preventing uncited content from being published.

## Troubleshooting

### False positives on non-factual numeric content
- **Symptom**: The checker flags numbers that are not factual claims (e.g., step numbers like "Step 1", "Phase 2", pricing tiers)
- **Fix**: The checker uses heuristics and will occasionally flag non-claims. These can be noted as intentional exceptions in the report. Keep the `--window` parameter at the default (2 lines) to reduce false positives from nearby but unrelated citations.

### Citations not detected despite being present
- **Symptom**: A line is flagged as missing a citation even though a URL or source marker exists nearby
- **Fix**: Ensure the citation is within the `--window` radius (default: 2 lines) of the claim. Move the source link closer to the claim line. Accepted formats: markdown links with http/https, plain URLs, or `Source:` / `Sources:` / `Reference:` markers.

### Script reports no findings but deck has uncited claims
- **Symptom**: The report is clean but manual review finds missing citations
- **Fix**: The heuristic only detects lines with numeric patterns or specific factual claim indicators. Qualitative claims ("studies show...", "experts agree...") without numbers may not be caught. Human review remains necessary for comprehensive citation auditing.
