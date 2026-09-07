---
name: slide-overflow-fixer
description: |
  Fix overflowing Amaroad MDX slide content while keeping everything inside the
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

Measure overflow numerically (the frame clips, so screenshots cannot show it;
requires `pnpm dev`):

```bash
pnpm --silent amaroad overflow <deck-name> --slide <0-indexed-slide>
pnpm --silent amaroad overflow <deck-name> --format json --output /tmp/overflow.json
```

Findings carry the element selector, MDX line, and per-edge overshoot.
`outside-safe-area` / `outside-frame` / `clipped-content` are errors;
`overlay-collision` is a warning; `intentional-breakout` / `decorative-bleed`
are informational.

Real-render screenshot for context:

```bash
pnpm exec tsx .codex/skills/nanobanana-image/scripts/capture-slide.ts \
  --deck <deck-name> \
  --slide <0-indexed-slide> \
  --output /tmp/<deck-name>-<slide>-after.png
```

Final gate before reporting:

```bash
pnpm --silent amaroad doctor <deck-name>
```

## Pass Criteria

- `pnpm amaroad overflow` reports 0 errors for the slide
- No `overlay-collision` warnings
- Heading design unchanged
- Body text remains readable (no `low-font-size` error from `pnpm amaroad doctor`)
