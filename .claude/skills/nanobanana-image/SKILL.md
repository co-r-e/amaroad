---
name: nanobanana-image
description: |
  Generates AI images via Gemini API and inserts them into Amaroad MDX slides.
  Captures the slide layout to auto-select the optimal aspect ratio, builds an
  optimized English prompt, generates the image, and updates the MDX file.
  Use when user says "generate image", "create image", "add a photo to this slide",
  or the Japanese equivalents "画像を生成", "画像を作って", "イメージを生成".
  Key capabilities: automatic aspect ratio detection from slide layout, 10 aspect
  ratios (9:16 to 21:9), 1K/2K/4K resolution, prompt optimization for slide use,
  and automatic MDX insertion with correct asset paths.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
---

## Prerequisites

- The `GEMINI_API_KEY` environment variable must be set (write it in `.env.local` at the project root and the script will auto-load it)

## Workflow

### Step 1: Gather Information

Identify the following from the user's request:

1. **Target deck**: Which deck to add the image to (directory name under `decks/`)
2. **Target slide**: Which MDX file to insert the image reference into
3. **Image content**: What to depict
4. **Resolution**: Default `2K` (follow user specification if provided)
5. **Filename**: English kebab-case reflecting the content (e.g., `hero-cityscape.png`)

Ask for missing information if needed.

### Step 1.5: Layout Analysis and Automatic Aspect Ratio Selection

Capture a screenshot of the slide and have Claude visually analyze it to **automatically determine the optimal aspect ratio**. If the user explicitly specifies an aspect ratio, prioritize that instead.

#### Procedure

1. **Confirm the dev server is running** (`pnpm dev`)
2. **Capture a screenshot**:

```bash
npx tsx .claude/skills/nanobanana-image/scripts/capture-slide.ts \
  --deck <deck-name> \
  --slide <0-indexed> \
  --output /tmp/slide-capture.png
```

3. **Read the captured image with the Read tool** and visually analyze the slide layout:
   - Estimate the width-to-height ratio of the empty area where the image will be placed
   - Check how much space the title, text, and column layout occupy
   - Determine the shape of the image insertion space (portrait, landscape, or square)

4. **Select the optimal aspect ratio from the table**:

| Supported Aspect Ratio | Numeric Ratio (W/H) | Suitable Cases |
|---|---|---|
| `9:16`  | 0.56 | Extreme portrait |
| `2:3`   | 0.67 | Narrow portrait |
| `3:4`   | 0.75 | Portrait column |
| `4:5`   | 0.80 | Slightly portrait |
| `1:1`   | 1.00 | Square area |
| `5:4`   | 1.25 | Slightly landscape |
| `4:3`   | 1.33 | Standard in-column placement |
| `3:2`   | 1.50 | Landscape column |
| `16:9`  | 1.78 | Full-width / wide area |
| `21:9`  | 2.33 | Ultra-wide banner |

5. **Present the rationale to the user**:
   - Approximate size of the empty area confirmed in the captured image
   - The chosen aspect ratio and reasoning
   - Explanation of how the image will fit

#### Technical Details

- Capture API: `GET /api/capture/{deck}/{slide}` — uses `next/og` (Satori) to server-side render the MDX structure as a 960x540 PNG
- No browser required (Playwright/Puppeteer not needed)
- Complex components like images and charts are rendered as placeholder boxes
- Japanese text may not render accurately due to font limitations, but this does not affect layout analysis

**Present the chosen aspect ratio and analysis rationale to the user before proceeding with generation.**

### Step 2: Prompt Optimization

Convert the user's description into a prompt suitable for Gemini image generation:

- **Write in English** (Gemini produces best quality with English prompts)
- **Add specific descriptions**: Composition, lighting, style, color tone
- **Consider slide usage**: Space for text overlay, high contrast, simple background
- **No title/heading text in the image** unless the user explicitly requests it. The slide already has its own heading in MDX.
- Present the prompt to the user for confirmation

### Step 3: Image Generation

Generate the image with the following command:

```bash
npx tsx .claude/skills/nanobanana-image/scripts/generate-image.ts \
  --prompt "<optimized prompt>" \
  --output "decks/<deck>/assets/<filename>.png" \
  --aspect-ratio <ratio> \
  --resolution <resolution>
```

### Step 4: Insert into MDX

After successful generation, insert the image reference into the target MDX file:

```mdx
![Description text](./assets/<filename>.png)
```

- `resolveAssetPaths()` automatically converts to `/api/decks/<deck>/assets/<filename>.png`, so use relative path `./assets/`
- Choose an appropriate insertion position based on the slide context

### Step 5: Report Results

Report the following to the user:

- File path of the generated image
- Prompt used
- MDX file and position where the image was inserted
- How to verify on the dev server (`pnpm dev` then navigate to the relevant slide)

## Generation Script Specification

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `--prompt` | Yes | - | Image generation prompt (English recommended) |
| `--output` | Yes | - | Output file path (.png) |
| `--aspect-ratio` | No | `16:9` | Aspect ratio (1:1, 3:2, 4:3, 16:9, 21:9, etc.) |
| `--resolution` | No | `2K` | Resolution (1K, 2K, 4K) |

## Examples

### Example 1: Generate a hero image for a cover slide

- User says: "Generate a hero image for the cover slide of my sample-deck"
- Actions:
  1. Identify target deck (`sample-deck`) and slide (`01-a-cover.mdx`)
  2. Capture slide screenshot and analyze layout to determine aspect ratio (e.g., 16:9 for full-width cover)
  3. Build optimized English prompt based on deck theme and slide context
  4. Present aspect ratio rationale and prompt to user for confirmation
  5. Run `generate-image.ts` with the confirmed prompt
  6. Insert `![Hero image](./assets/hero-cover.png)` into the MDX file
- Result: A 2K, 16:9 hero image saved to `decks/sample-deck/assets/hero-cover.png` and referenced in the cover slide MDX

### Example 2: Add a portrait photo placeholder to a two-column layout

- User says: "Add a team photo to the left column of slide 61"
- Actions:
  1. Identify target deck and slide (`61-team-grid.mdx`)
  2. Capture slide and analyze the left column space (portrait, approximately 3:4)
  3. Build prompt: "Professional team photo, diverse group in modern office, natural lighting"
  4. Generate at 3:4 aspect ratio, 2K resolution
  5. Insert image reference into the left column JSX
- Result: A 3:4 team photo saved and inserted into the correct column position

## Troubleshooting

### GEMINI_API_KEY not set
- **Symptom**: Script exits with "GEMINI_API_KEY is not set"
- **Fix**: Add `GEMINI_API_KEY=your-key-here` to `.env.local` at the project root. The script auto-loads this file.

### Safety filter blocks image generation
- **Symptom**: API returns successfully but no image data is included in the response
- **Fix**: The prompt likely triggered Gemini's safety filter. Rephrase to avoid potentially sensitive content (violence, medical imagery, real people's likenesses). Use abstract or illustrative language instead.

### Slide capture fails
- **Symptom**: `capture-slide.ts` returns an error or blank image
- **Fix**: Ensure the dev server is running (`pnpm dev`). The capture API requires the Next.js server at `localhost:3000`. Also verify the deck name and slide index (0-based) are correct.
