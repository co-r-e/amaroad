---
name: slide-overflow-fixer
description: |
  Fix overflowing DexCode MDX slide content while keeping everything inside the
  safe zone. Use for clipped text, oversized media, dense layouts, and overlay
  collisions without changing heading design or slide-frame constraints.
---

# Slide Overflow Fixer

Fix slide overflow pragmatically without breaking the presentation design system.

## Non-Negotiable Constraints

1. Do not change heading design.
2. Do not edit heading component implementation.
3. Do not override `h1`, `h2`, or `h3` styles inline in MDX.
4. Keep SlideFrame safe-zone paddings unchanged.
5. Keep non-heading text at `1.8rem` or larger.
6. Do not use Tailwind utility classes inside slide MDX or `src/components/mdx`.

## Workflow

1. Identify the target deck and slide files
2. Confirm overflow and isolate the offending block
3. Apply fixes in this order:
   - Layout change
   - Media scaling
   - Non-heading typography or spacing adjustment
   - Split content across slides
4. Use `references/fix-patterns.md` for concrete fix strategies
5. Re-verify the slide after each edit

## Useful Commands

```bash
ls decks/<deck-name>/*.mdx | sort -V
```

```bash
npx tsx .codex/skills/nanobanana-image/scripts/capture-slide.ts \
  --deck <deck-name> \
  --slide <0-indexed-slide> \
  --output /tmp/<deck-name>-<slide>-after.png
```

## Pass Criteria

- No clipping
- No safe-zone violations
- No collisions with overlays
- Heading design unchanged
- Body text remains readable
