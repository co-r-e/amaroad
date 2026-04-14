---
name: nanobanana-image-edit
description: |
  Edits existing images via Gemini API and updates them in Amaroad slide decks.
  Sends the original image with an edit prompt to apply targeted modifications
  such as removing objects, changing colors, or adding elements.
  Use when user says "edit image", "fix image", "modify image", "remove the
  background", or the Japanese equivalents "画像を編集", "画像を修正", "画像を直して".
  Key capabilities: in-place overwrite or save-as-new, visual verification before
  and after edit, aspect ratio and resolution control, English prompt optimization
  for best Gemini results.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
---

## Prerequisites

- `GEMINI_API_KEY` set in `.env.local` at the project root

## Workflow

### Step 1: Identify Target Image

Determine from the user's request:

1. **Target image**: File path of the image to edit (e.g., `decks/<deck>/assets/<filename>.png`)
2. **Edit description**: What to change (remove, add, modify, recolor, etc.)

If the image was recently generated or discussed in conversation, infer the path from context.
Ask for clarification if the target is ambiguous.

### Step 2: Verify the Image

Read the target image file with the Read tool to visually confirm:

- The image exists and is readable
- The area to be edited is identifiable
- The edit request is feasible

### Step 3: Build Edit Prompt

Construct a clear, specific edit prompt in **English** (Gemini produces best results with English):

- Describe precisely **what to change** and **where** in the image
- Describe **what to replace it with** (e.g., "fill with surrounding background")
- Explicitly state **what to keep unchanged** (e.g., "Keep everything else exactly the same")

**Present the prompt to the user for confirmation before executing.**

### Step 4: Execute Edit

Run the edit script:

```bash
npx tsx .claude/skills/nanobanana-image-edit/scripts/edit-image.ts \
  --image "decks/<deck>/assets/<filename>.png" \
  --prompt "<edit prompt>" \
  --output "decks/<deck>/assets/<filename>.png"
```

- Omit `--output` to overwrite the original file in-place
- Optionally specify `--aspect-ratio` and `--resolution` (defaults: preserve original aspect, 2K)

### Step 5: Verify Result

Read the output image with the Read tool to confirm:

- The requested edit was applied correctly
- No unintended changes were introduced
- The overall image quality is preserved

If the result is unsatisfactory, adjust the prompt and re-run.

### Step 6: Report Results

Report the following to the user:

- Edited image file path
- Prompt used
- Whether the file was overwritten or saved to a new path
- Since the image path is unchanged when overwriting, MDX references remain valid

## Script Specification

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `--image` | Yes | - | Input image file path |
| `--prompt` | Yes | - | Edit instructions (English recommended) |
| `--output` | No | Same as `--image` | Output file path (.png) |
| `--aspect-ratio` | No | `16:9` | Aspect ratio for the output |
| `--resolution` | No | `2K` | Resolution (1K, 2K, 4K) |

## Examples

### Example 1: Remove text from a generated image

- User says: "Remove the watermark text from hero-cover.png in sample-deck"
- Actions:
  1. Locate the image at `decks/sample-deck/assets/hero-cover.png`
  2. Read the image to visually confirm the watermark location
  3. Build edit prompt: "Remove the watermark text in the bottom-right corner. Fill the area with the surrounding background. Keep everything else exactly the same."
  4. Present prompt to user for confirmation
  5. Run `edit-image.ts` with `--image` and `--prompt`, overwriting in-place
  6. Read the output image to verify the watermark is gone
- Result: The watermark is removed from the image. Since the file path is unchanged, no MDX update is needed.

### Example 2: Change background color of an illustration

- User says: "Change the background of team-photo.png to a dark blue gradient"
- Actions:
  1. Locate and visually verify the image
  2. Build edit prompt: "Replace the background with a dark blue gradient from top-left (#1a1a4e) to bottom-right (#2d2d7e). Keep all people and foreground elements exactly the same."
  3. Run the edit after user confirmation
  4. Verify the result visually
- Result: The image background is updated to a dark blue gradient while preserving all foreground elements.

## Troubleshooting

### Edit produces unexpected changes to unrelated areas
- **Symptom**: Gemini modifies parts of the image that should remain unchanged
- **Fix**: Add explicit "Keep everything else exactly the same" to the prompt. Be more specific about the exact region to edit (e.g., "in the top-left corner", "the text at coordinates roughly center-bottom").

### GEMINI_API_KEY not set
- **Symptom**: Script exits with "GEMINI_API_KEY is not set"
- **Fix**: Add `GEMINI_API_KEY=your-key-here` to `.env.local` at the project root.

### Input image not found
- **Symptom**: Script exits with a file-not-found error
- **Fix**: Verify the image path. Images are stored under `decks/<deck-name>/assets/`. Use `Glob` to search for the file if the exact name is uncertain.
