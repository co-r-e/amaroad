---
name: graphic-recording
description: |
  Graphic recording style image generation skill. Takes slide text or screenshots as input,
  generates a hand-drawn visual note illustration that follows the deck's theme colors,
  saves it to the deck's assets directory, and inserts it into the MDX file.
  Uses Gemini API (gemini-3.1-flash-image-preview).
  Triggers: "グラレコ", "グラフィックレコーディング", "graphic recording", "グラレコ風", "グラレコを生成"
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
