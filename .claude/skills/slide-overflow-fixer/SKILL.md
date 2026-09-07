---
name: slide-overflow-fixer
description: |
  Fixes overflowing MDX slide content in Amaroad decks while keeping all content
  inside the inviolable area. Applies layout changes, media resizing, text and
  spacing tuning, and slide splitting as a last resort.
  Use when user says "overflow", "clipping", "content does not fit", "ha-mi-dashi",
  "slide contents are out of bounds", or "fix this slide layout".
  Key capabilities: prioritized fix strategy (layout > media > spacing > split),
  numeric before/after verification with `pnpm amaroad overflow`, heading design
  preservation, safe-zone padding enforcement, and body text readability floor
  (1.8rem minimum).
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

The slide frame is `overflow: hidden`, so a screenshot never shows the overflow
itself. Measure it instead (requires `pnpm dev` running):

```bash
pnpm --silent amaroad overflow <deck-name> --slide <0-indexed-slide>
# whole deck:
pnpm --silent amaroad overflow <deck-name> --format json --output /tmp/overflow.json
```

Each finding names the offending element (`selector`), the MDX line (`L<n>`),
and how far it leaves the safe area per edge (`bottom +38px`). Rules:
- `outside-safe-area` / `outside-frame` / `clipped-content` are errors to fix.
- `overlay-collision` (text under logo / copyright / page number) is a warning.
- `intentional-breakout` / `decorative-bleed` are informational (full-bleed bands
  on cover/section/ending slides, absolutely positioned decoration).

Optionally capture the real render for context:

```bash
pnpm exec tsx .claude/skills/nanobanana-image/scripts/capture-slide.ts \
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

Re-run the measurement (the dev server hot-reloads the edited slide):

```bash
pnpm --silent amaroad overflow <deck-name> --slide <0-indexed-slide>
```

Finish with the full gate before reporting:

```bash
pnpm --silent amaroad doctor <deck-name>
```

Pass criteria:
- `pnpm amaroad overflow` reports 0 errors for the slide (no `outside-safe-area`,
  `outside-frame`, or `clipped-content`).
- No `overlay-collision` warnings remain (text does not sit under logo/copyright/page number).
- Heading design unchanged.
- Body text remains readable (`>= 1.8rem`), i.e. `pnpm amaroad doctor` reports no `low-font-size` error.

### 6. Report result

Report:
- Updated files
- Which fix pattern was used
- Why that pattern was selected
- Residual risk (if any) and next candidate adjustment

## Examples

### Example 1: Dense bullet list overflows bottom edge

User says: "Slide 05 content is clipped at the bottom."

Actions:
1. Run `pnpm --silent amaroad overflow <deck> --slide 4` and note the finding (`[data-slide-content]` clipped, `bottom +120px`, L14).
2. Read the MDX file and identify the overflow cause (12 bullet items in a single column).
3. Apply fix: convert single-column list to a two-column `<Columns>` layout.
4. Re-run the overflow check and confirm it reports no errors.

Result: The 12 items display as two columns of 6, fitting inside the inviolable area with no clipping.

### Example 2: Large chart pushes footer content off-slide

User says: "The bar chart on slide 10 collides with the page number overlay."

Actions:
1. Run `pnpm --silent amaroad overflow <deck> --slide 9` and note the `overlay-collision` warning on the chart.
2. Identify that the chart container has no `data-growable` and uses a fixed height of 500px.
3. Apply fix: reduce chart height to 380px and add `data-growable` so it adapts to remaining space.
4. Re-run the overflow check and confirm the warning is gone.

Result: Chart fits within the content area, page number overlay is unobstructed, and the chart remains readable.

## Troubleshooting

### Heading style changed after fix

Symptom: After applying overflow fixes, headings look different (font size, weight, or decoration changed).
Cause: Inline styles were applied to `h1`/`h2`/`h3` elements, or heading component CSS was modified.
Fix: Revert heading changes. Never override heading styles. Only adjust non-heading content (body text, images, layout, spacing).

### Content still clips after reducing font size

Symptom: Text was reduced to 1.6rem but content still overflows.
Cause: The minimum font size floor is 1.8rem. Going below this violates readability rules and still does not solve deep overflow.
Fix: Do not reduce below 1.8rem. Instead, split the slide into two slides or restructure the layout (e.g., columns, accordion, or tab pattern).

### Overflow check or capture fails

Symptom: `pnpm amaroad overflow` reports `server-unavailable`, or `capture-slide.ts` errors.
Cause: The dev server is not running, the Playwright browser is missing, or the slide index is incorrect (0-indexed).
Fix: Start the dev server with `pnpm dev`; run `pnpm exec playwright install chromium` if Chromium cannot launch; confirm the 0-indexed slide number from `decks/<deck>/slide-order.ts` (index = position in the array).
