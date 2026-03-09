---
name: slide-overflow-fixer
description: |
  Fix overflowing MDX slide content in DexCode decks while keeping all content
  inside the inviolable area. Use when text, images, charts, tables, or custom
  JSX blocks spill outside the safe zone, get clipped, or collide with overlays.
  Apply layout changes, media resizing, text/spacing tuning, and slide splitting.
  Preserve heading design exactly. Triggers: overflow, clipping, content does not fit,
  "ha-mi-dashi", "slide contents are out of bounds".
---

## Non-negotiable constraints

1. Do not change heading design.
2. Do not edit heading component implementation:
   - `src/components/mdx/typography/Headings.tsx`
   - `src/components/mdx/typography/Headings.module.css`
3. Do not override `h1`, `h2`, `h3` style in MDX with inline styles.
4. Keep SlideFrame safe-zone paddings unchanged.
5. Keep non-heading text at `1.8rem` or larger.
6. Do not use Tailwind utility classes inside slide MDX or `src/components/mdx`.

## Workflow

### 1. Identify target scope

Collect:
- Deck name
- Slide file(s) under `decks/<deck-name>/*.mdx`
- Whether overflow appears in viewer, presenter, export, or all of them

Useful commands:

```bash
ls decks/<deck-name>/*.mdx | sort -V
```

### 2. Confirm overflow and locate the cause

1. Open the target slide in viewer/presenter.
2. Capture before state if needed:

```bash
npx tsx .claude/skills/nanobanana-image/scripts/capture-slide.ts \
  --deck <deck-name> \
  --slide <0-indexed-slide> \
  --output /tmp/<deck-name>-<slide>-before.png
```

3. Inspect which block causes overflow:
- long text block
- dense multi-column layout
- oversized chart/image/video
- wide table/code block
- large margins/gaps/paddings in custom JSX

### 3. Apply fixes in this priority order

1. Layout change (highest leverage)
2. Media scaling
3. Non-heading typography/spacing adjustment
4. Content split across slides (last resort, but preferred over unreadable text)

Detailed patterns: `references/fix-patterns.md`

### 4. Fix execution rules

- Start with the smallest change that resolves overflow.
- Preserve slide intent and visual hierarchy.
- If one slide remains overcrowded after reasonable tuning, split into 2 slides.
- Keep headings untouched in both style and component mapping.

### 5. Verify after each edit

Capture after state:

```bash
npx tsx .claude/skills/nanobanana-image/scripts/capture-slide.ts \
  --deck <deck-name> \
  --slide <0-indexed-slide> \
  --output /tmp/<deck-name>-<slide>-after.png
```

Pass criteria:
- No content is clipped.
- No content extends outside the safe zone.
- No collision with logo/copyright/page number overlays.
- Heading design unchanged.
- Body text remains readable (`>= 1.8rem`).

### 6. Report result

Report:
- Updated files
- Which fix pattern was used
- Why that pattern was selected
- Residual risk (if any) and next candidate adjustment
