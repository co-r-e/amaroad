---
name: nanobanana-image
description: |
  Generate slide images with Gemini, save them under the target deck assets
  directory, and insert them into MDX. Use when the user explicitly asks for
  Gemini, Nanobanana, or the existing Gemini script workflow, or when a deck is
  already standardized on Gemini-generated imagery. For provider-ambiguous
  image requests, use image-provider first so the user can choose GPT/Codex or
  Gemini/Nanobanana.
---

# Nanobanana Image

Generate images for Amaroad slides and insert them into MDX.

## Use When

- The user asks for Gemini or Nanobanana image generation
- The user asks to use the existing Gemini script workflow
- A deck is already standardized on Gemini-generated imagery
- A concept visual should be added directly into an MDX slide

## Prerequisites

- `GEMINI_API_KEY` is set in `.env.local`

## Provider Boundary

- If the user has not chosen Gemini/Nanobanana, stop and use `image-provider`
  before generating.

## Workflow

1. Gather deck, slide, image concept, and preferred filename
2. Determine aspect ratio
   - Respect an explicit user choice first
   - Otherwise inspect the target slide layout and choose a suitable ratio
```bash
npx tsx .codex/skills/nanobanana-image/scripts/capture-slide.ts \
  --deck <deck-name> \
  --slide <0-indexed> \
  --output /tmp/slide-capture.png
```
3. Explain the chosen aspect ratio briefly before generation
4. Build an English image prompt suited for slide usage
   - Add composition, style, lighting, and contrast guidance
   - Avoid putting heading text inside the image unless explicitly requested
5. Show the prompt to the user before generation
6. Generate the image
```bash
npx tsx .codex/skills/nanobanana-image/scripts/generate-image.ts \
  --prompt "<optimized prompt>" \
  --output "decks/<deck>/assets/<filename>.png" \
  --aspect-ratio <ratio> \
  --resolution <resolution>
```
7. Insert the generated asset into the target MDX slide
8. Report the asset path, prompt, and insertion location

## Notes

- Use relative asset paths like `./assets/<filename>.png` in MDX.
- Default resolution is `2K` unless the user requests otherwise.
