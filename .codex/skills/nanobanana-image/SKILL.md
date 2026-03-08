---
name: nanobanana-image
description: |
  Generate slide images with Gemini, save them under the target deck assets
  directory, and insert them into MDX. Use for new illustrations, hero images,
  concept visuals, and other deck imagery.
---

# Nanobanana Image

Generate images for DexCode slides and insert them into MDX.

## Use When

- A slide needs a new image asset
- The user asks to generate or create an image for a deck
- A concept visual should be added directly into an MDX slide

## Prerequisites

- `GEMINI_API_KEY` is set in `.env.local`

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
