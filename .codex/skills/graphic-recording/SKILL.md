---
name: graphic-recording
description: |
  Generate a graphic-recording style image from Amaroad slide content or slide
  screenshots, match it to the deck theme, save it under the deck assets
  directory, and insert it into MDX. Use for hand-drawn visual note style slides.
---

# Graphic Recording

Generate graphic-recording style visual note illustrations from slide content.

## Use When

- The user asks for a graphic-recording or hand-drawn visual summary
- A text-heavy slide should be converted into a more illustrative visual
- A slide needs a theme-matched sketch note image

## Prerequisites

- `GEMINI_API_KEY` is set in `.env.local`

## Workflow

1. Identify the target deck, source slide, and insertion target
2. Extract source material
   - Prefer reading the target MDX slide directly
   - If layout context matters, capture the slide image:
```bash
npx tsx .codex/skills/nanobanana-image/scripts/capture-slide.ts \
  --deck <deck-name> \
  --slide <0-indexed> \
  --output /tmp/slide-capture.png
```
3. Read the deck theme from `deck.config.ts`
4. Build a generation prompt using slide content and theme colors
   - Use `references/prompt-guide.md` when shaping the prompt
5. Show the prompt to the user before generation
6. Generate the image
```bash
npx tsx .codex/skills/nanobanana-image/scripts/generate-image.ts \
  --prompt "<constructed prompt>" \
  --output "decks/<deck>/assets/<filename>.png" \
  --aspect-ratio 16:9 \
  --resolution 2K
```
7. Insert the image into the target MDX slide and report the file path and prompt

## Notes

- Use English prompts for image generation quality unless a different approach is clearly better.
- Default filename pattern: `graphic-recording-<topic>.png`.
