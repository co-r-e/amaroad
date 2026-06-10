---
name: nanobanana-image-edit
description: |
  Edit an existing slide image with Gemini image editing, save the result, and
  optionally keep MDX references intact by overwriting the original asset. Use
  when the user explicitly asks for Gemini, Nanobanana, or the existing Gemini
  edit script workflow, or when a deck is already standardized on Gemini-edited
  imagery. For provider-ambiguous image edit requests, use image-provider first
  so the user can choose GPT/Codex or Gemini/Nanobanana.
---

# Nanobanana Image Edit

Edit existing images using Gemini and return a revised asset for the deck.

## Use When

- The user asks for Gemini or Nanobanana image editing
- The user asks to use the existing Gemini edit script workflow
- A deck is already standardized on Gemini-edited imagery
- MDX already points at an image and the path should remain valid

## Prerequisites

- `GEMINI_API_KEY` is set in `.env.local`

## Provider Boundary

- If the user has not chosen Gemini/Nanobanana, stop and use `image-provider`
  before editing.

## Workflow

1. Identify the target image path and requested edit
2. Verify the image exists and the edit request is feasible
3. Build a precise edit prompt in English
   - Specify what changes
   - Specify what stays unchanged
4. Show the prompt to the user before execution
5. Run the edit script
```bash
pnpm exec tsx .codex/skills/nanobanana-image-edit/scripts/edit-image.ts \
  --image "decks/<deck>/assets/<filename>.png" \
  --prompt "<edit prompt>" \
  --output "decks/<deck>/assets/<filename>.png"
```
6. Verify the output image and rerun with a refined prompt if needed
7. Report the final asset path and whether the file was overwritten

## Script Spec

- `--image <path>` required
- `--prompt <text>` required
- `--output <path>` optional, defaults to in-place overwrite
- `--aspect-ratio <ratio>` optional
- `--resolution <1K|2K|4K>` optional

## Notes

- If the path is unchanged, MDX references remain valid.
- If the result drifts too far from the original, tighten the prompt and retry.
