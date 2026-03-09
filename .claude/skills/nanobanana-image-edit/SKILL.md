---
name: nanobanana-image-edit
description: |
  AI image editing skill. Uses Gemini API (gemini-3.1-flash-image-preview) to edit
  existing images by sending the original image with an edit prompt.
  Saves the edited image and optionally updates MDX references.
  Triggers: 「画像を編集」「画像を修正」「画像を直して」「edit image」「fix image」「modify image」
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

## Error Handling

- `GEMINI_API_KEY` not set → Guide the user to set it in `.env.local`
- Input image not found → Show error with the attempted path
- API error → Display the error message and suggest prompt adjustments
- Safety filter block → Explain and suggest rephrasing the edit prompt
