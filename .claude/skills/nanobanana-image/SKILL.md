---
name: nanobanana-image
description: |
  AI image generation skill. Uses Gemini API (gemini-3.1-flash-image-preview) to generate
  high-quality images for slides, saves them to the deck's assets directory, and inserts them into MDX.
  Triggers: 「画像を生成」「画像を作って」「イメージを生成」「generate image」「create image」
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

1. **Confirm the dev server is running** (`npm run dev`)
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
- How to verify on the dev server (`npm run dev` then navigate to the relevant slide)

## Generation Script Specification

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `--prompt` | Yes | - | Image generation prompt (English recommended) |
| `--output` | Yes | - | Output file path (.png) |
| `--aspect-ratio` | No | `16:9` | Aspect ratio (1:1, 3:2, 4:3, 16:9, 21:9, etc.) |
| `--resolution` | No | `2K` | Resolution (1K, 2K, 4K) |

## Error Handling

- `GEMINI_API_KEY` not set -> Guide the user on how to set it
- API error -> Display the error message and explain the cause
- Output directory does not exist -> Create automatically
- No image data (safety filter, etc.) -> Explain the reason and suggest prompt modifications
