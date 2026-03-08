---
name: fact-citation-validator
description: |
  Validate factual and numeric claims in DexCode MDX slides and flag lines
  missing citations. Use before release or export when slides need traceable
  sources and a deterministic citation audit.
---

# Fact Citation Validator

Audit slides for unsupported factual claims and report line-numbered findings.

## Use When

- A deck is approaching review, external sharing, or export
- Numeric claims need nearby source links
- Citation quality should be checked consistently across slides

## What It Checks

Automated by `scripts/validate-citations.ts`:

- Numeric or factual claim lines in `decks/<deck>/*.mdx`
- Missing citation near the claim line as `error`
- Citation marker without verifiable link as `warning`

Accepted evidence:

- Markdown links with `http` or `https`
- Plain `http` or `https` URLs
- `Source:` or similar markers, with weaker confidence if no link exists

See `references/citation-policy.md` when policy detail is needed.

## Workflow

1. Run a dry audit first
```bash
npx tsx .codex/skills/fact-citation-validator/scripts/validate-citations.ts --deck sample-deck
```
2. Reduce `error` to zero
3. Upgrade weak citations to verifiable links
4. Use CI mode if the deck should fail on unresolved findings
```bash
npx tsx .codex/skills/fact-citation-validator/scripts/validate-citations.ts --fail-on error
```

## CLI Spec

- `--deck <name>`
- `--format md|json`
- `--window <N>`
- `--fail-on error|warning`

## Notes

- The checker is heuristic and does not replace human review.
- Keep source links close to the relevant claim for deterministic detection.
