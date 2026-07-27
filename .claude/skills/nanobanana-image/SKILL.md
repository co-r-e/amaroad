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
- `oxipng` is used to shrink the generated PNG losslessly. It is optional — the
  script warns and continues without it — but install it with `brew install oxipng`
  to cut roughly 30-40% off every generated image at zero quality cost.

## Model Selection

The default is **`gemini-3.1-flash-lite-image`**: faster, cheaper, and good
enough for the illustration and photo styles decks actually use.

Switch to `gemini-3.1-flash-image-preview` with `--model` only when lite is not
good enough — typically dense in-image text, intricate detail, or a first attempt
that came back visibly weak. Say why when you switch.

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

1. **Confirm the dev server is running** (`pnpm dev`, which serves port **3850**)
2. **Capture a screenshot**:

```bash
pnpm exec tsx .claude/skills/nanobanana-image/scripts/capture-slide.ts \
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
pnpm exec tsx .claude/skills/nanobanana-image/scripts/generate-image.ts \
  --prompt "<optimized prompt>" \
  --output "decks/<deck>/assets/<filename>.png" \
  --aspect-ratio <ratio> \
  --resolution <resolution>
```

The model defaults to `gemini-3.1-flash-lite-image` — add `--model gemini-3.1-flash-image-preview` only for the cases described in **Model Selection** above.

The saved PNG is losslessly optimized before the script exits, and the size
before and after is reported on stderr. Pass `--optimize aggressive` when the
file is still too heavy: it adds high-quality palette quantization (pngquant at
a 90-100 quality floor), which typically reaches -55% instead of -38% and is
visually indistinguishable on flat illustration. Photographic images fail that
quality floor on their own and keep full color depth. `--optimize off` disables
the step entirely.

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
| `--model` | No | `gemini-3.1-flash-lite-image` | Gemini image model: `gemini-3.1-flash-lite-image` or `gemini-3.1-flash-image-preview` |
| `--optimize` | No | `lossless` | PNG shrinking: `lossless` (oxipng, pixel-identical), `aggressive` (adds pngquant at quality floor 90), `off` |

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
- **Fix**: Ensure the dev server is running (`pnpm dev`). The capture API requires the Next.js server at `localhost:3850`, which is the script's default port. Also verify the deck name and slide index (0-based) are correct.

### Generated image is still too large
- **Symptom**: The file is well over 1MB after lossless optimization
- **Fix**: Lower `--resolution` first (2K to 1K halves the pixel count), then try
  `--optimize aggressive`. Only reach for a simpler prompt if both are not enough
  — CLAUDE.md targets roughly 500KB-1MB per deck image.

### Gemini returned JPEG instead of PNG
- **Symptom**: none normally — this is handled automatically
- **Detail**: The lite model often answers with JPEG even for a `.png`
  destination. The script re-encodes it into the requested container, which is
  lossless and measured within 1% of the JPEG's own file size, so every deck
  asset keeps one predictable extension. Always use the path printed on stdout.
  Outside macOS (`sips` unavailable) the script instead renames the file to match
  the real format and warns, rather than hiding JPEG bytes behind a `.png` name.

### oxipng is not installed
- **Symptom**: "skipped image optimization: `oxipng` is not installed"
- **Fix**: `brew install oxipng`. The image is still saved correctly; it is just
  30-40% larger than it needs to be.
