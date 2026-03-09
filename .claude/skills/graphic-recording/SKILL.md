---
name: graphic-recording
description: |
  Generates graphic-recording-style illustrations from slide content using Gemini
  image generation. Takes MDX text or slide screenshots as input, produces a
  hand-drawn visual note that matches the deck's theme colors, and inserts it
  into the target slide.
  Use when user says "グラレコ", "graphic recording", "グラフィックレコーディング",
  "グラレコ風", "visual note for this slide", or "グラレコを生成".
  Key capabilities: theme-aware color extraction, text-based or screenshot-based
  input, automatic MDX insertion, 16:9 aspect ratio output.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
---

## Prerequisites

- `GEMINI_API_KEY` set in `.env.local`

## Workflow

### Step 1: Identify Target Slide

Determine from user request:

1. **Target deck**: directory name under `decks/`
2. **Source slide**: which MDX file's content to visualize
3. **Insertion target**: same slide or a different one

Ask if unclear.

### Step 2: Extract Slide Content

**Method A: Text-based** (preferred)
Read the target MDX file and extract text content.

**Method B: Screenshot-based**
If dev server is running, capture the slide and analyze visually:

```bash
npx tsx .claude/skills/nanobanana-image/scripts/capture-slide.ts \
  --deck <deck-name> \
  --slide <0-indexed> \
  --output /tmp/slide-capture.png
```

### Step 3: Extract Theme Colors

Read the deck's `deck.config.ts` and extract:

- `primary` — main color (headings, emphasis borders)
- `accent` — accent color (highlights, arrows)
- `background` — background color
- `text` — body text color
- `surface` — surface color (card backgrounds)

### Step 4: Build Prompt

Combine slide text content and theme colors into a graphic recording style prompt.

See `references/prompt-guide.md` for prompt construction guidelines.

**Always present the prompt to the user for confirmation before generating.**

### Step 5: Generate Image

Use the nanobanana-image generation script:

```bash
npx tsx .claude/skills/nanobanana-image/scripts/generate-image.ts \
  --prompt "<constructed prompt>" \
  --output "decks/<deck>/assets/<filename>.png" \
  --aspect-ratio 16:9 \
  --resolution 2K
```

- Default aspect ratio: `16:9` (full-width slide usage)
- Filename: `graphic-recording-<topic>.png` (kebab-case English)

### Step 6: Insert into MDX

```mdx
<img src="./assets/<filename>.png" alt="..." style={{ width: "100%", borderRadius: "0.8rem" }} />
```

- Use relative path `./assets/` (`resolveAssetPaths()` auto-converts)
- Adjust `width` and placement based on slide layout

### Step 7: Report Results

- Generated image file path
- Prompt used
- How to verify on dev server

## Examples

### Example 1: Graphic recording from text content

- User says: "Create a graphic recording for slide 05 of my product-launch deck"
- Actions:
  1. Read `decks/product-launch/05-features.mdx` to extract text content.
  2. Read `decks/product-launch/deck.config.ts` to extract theme colors.
  3. Build a graphic recording prompt combining the feature list with theme colors. Present to user for confirmation.
  4. Generate the image with `generate-image.ts` at 16:9, 2K resolution.
  5. Insert `<img>` tag into the MDX file.
- Result: `decks/product-launch/assets/graphic-recording-features.png` inserted into slide 05.

### Example 2: Screenshot-based graphic recording

- User says: "グラレコ風にスライド3を可視化して (sample-deck)"
- Actions:
  1. Capture slide 3 via `capture-slide.ts`.
  2. Analyze the screenshot to extract visual content and layout.
  3. Extract theme colors from `deck.config.ts`.
  4. Build and confirm the prompt with the user.
  5. Generate and insert the graphic recording image.
- Result: Hand-drawn visual note illustration matching the deck's color scheme.

## Troubleshooting

### Error: GEMINI_API_KEY not found
- **Cause**: The `.env.local` file does not contain `GEMINI_API_KEY`.
- **Fix**: Add `GEMINI_API_KEY=<your-key>` to `.env.local` in the project root.

### Generated image does not match theme colors
- **Cause**: Theme colors were not correctly extracted or included in the prompt.
- **Fix**: Verify the theme colors in `deck.config.ts`. Ensure the prompt explicitly specifies HEX color values (e.g., "use #3B82F6 as the main accent color"). Regenerate after adjusting the prompt.

### Image appears distorted or cropped in slide
- **Cause**: Aspect ratio mismatch between the generated image and the slide layout.
- **Fix**: Use `--aspect-ratio 16:9` for full-width placement. For half-width column layouts, use `--aspect-ratio 1:1` or `--aspect-ratio 4:3` and adjust the `width` style in the MDX `<img>` tag.
