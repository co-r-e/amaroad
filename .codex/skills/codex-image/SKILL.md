---
name: codex-image
description: |
  Generate Amaroad slide images with Codex built-in image generation, save the
  selected bitmap under the target deck assets directory, and insert it into
  MDX. Use for new illustrations, hero images, concept visuals, and deck
  imagery when the user asks to use Codex, built-in image_gen, ChatGPT/Codex
  subscription image generation, or an OpenAI image workflow without adding an
  API-key based project script. For provider-ambiguous image requests, use
  image-provider first so the user can choose GPT/Codex or Gemini/Nanobanana.
---

# Codex Image

Generate a new bitmap asset for an Amaroad deck using Codex built-in
`image_gen`, then make the asset usable from MDX.

## Provider Boundary

- Use the built-in `image_gen` tool. Do not create OpenAI Images API scripts,
  require `OPENAI_API_KEY`, or route through `codex app-server`.
- If the user has not chosen GPT/Codex/image_gen, stop and use `image-provider`
  before generating.
- Use `codex-image-edit` instead when the user wants to modify an existing deck
  image rather than create a new one.
- Use `nanobanana-image` instead when the user explicitly asks for Gemini,
  Nanobanana, or the existing Gemini script path.
- Use `svg-diagram` instead for deterministic diagrams, flows, architecture
  drawings, or other visuals that should be SVG/code-native.
- Insert a screenshot placeholder instead of generating an AI image when the
  slide needs a real logged-in, proprietary, or user-specific UI state.

## Workflow

1. Identify the target deck, target MDX slide, image purpose, preferred
   filename, and whether the image should be inserted or only saved.
2. Inspect the target slide and deck context:
   - Read the target MDX file.
   - Read `decks/<deck>/deck.config.ts` when style or theme matching matters.
   - Read deck-level `CLAUDE.md` when it exists.
3. Choose the intended composition and ratio:
   - Respect explicit user constraints first.
   - For most slide illustrations, use a 16:9 or 4:3 composition.
   - For side panels or portraits, use a vertical or square composition.
4. Build a concise English prompt for slide usage:
   - Follow the repo `ai_image_generation` rule in `CLAUDE.md`.
   - Default to 1K-quality intent, minimal clean composition, one clear
     subject, centered composition, pure white background, and no extra icons
     or decorations.
   - Match existing deck mascots or image style when present.
   - Avoid text inside the image unless the user explicitly requests exact
     in-image text.
5. Generate with built-in `image_gen`.
6. Move or copy the selected generated file into:
   `decks/<deck>/assets/<filename>.png`
   - Use the file path returned by the tool when available; otherwise locate
     the selected output under `$CODEX_HOME/generated_images/`.
   - Never leave an MDX-referenced project asset only under `$CODEX_HOME`.
   - Do not overwrite an existing asset unless the user explicitly requested
     replacement; otherwise use a versioned sibling filename.
7. Verify the saved asset:
   - Confirm the file exists and is a valid image.
   - Check the file size. If it is over roughly 2MB, prefer regenerating with a
     simpler prompt before lossy compression.
   - Inspect the image before inserting when the environment allows it.
8. Insert the image with a relative MDX path such as `./assets/<filename>.png`.
   Wrap the image in a flex container with `minHeight: 0` and
   `overflow: "hidden"` when the target layout can shrink.
9. Report the final asset path, target MDX location, and final prompt.

## MDX Insertion Notes

- Prefer existing image-capable components such as `FigureShowcase`,
  `ShowcaseCover`, `SlideImage`, or the slide's current component pattern.
- Keep generated images inside the slide content area. Do not use negative
  margins to escape the calibrated safe zone.
- Use `./assets/<filename>.png` from deck-local MDX files.
- Use descriptive alt text that explains the visual's purpose.
