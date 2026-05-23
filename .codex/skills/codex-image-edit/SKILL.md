---
name: codex-image-edit
description: |
  Edit existing Amaroad deck image assets with Codex built-in image generation,
  save the revised bitmap under the target deck assets directory, and keep or
  update MDX references. Use when the user asks to revise, fix, remove, add,
  recolor, restyle, crop, or otherwise transform an existing slide image using
  Codex, built-in image_gen, ChatGPT/Codex subscription image editing, or an
  OpenAI image workflow without adding an API-key based project script. For
  provider-ambiguous image edit requests, use image-provider first so the user
  can choose GPT/Codex or Gemini/Nanobanana.
---

# Codex Image Edit

Edit an existing bitmap asset for an Amaroad deck using Codex built-in
`image_gen`, then save the result so the deck can keep using it.

## Provider Boundary

- Use the built-in `image_gen` tool. Do not create OpenAI Images API scripts,
  require `OPENAI_API_KEY`, or route through `codex app-server`.
- If the user has not chosen GPT/Codex/image_gen, stop and use `image-provider`
  before editing.
- Use `codex-image` instead when the user wants a new image rather than a
  change to an existing asset.
- Use `nanobanana-image-edit` instead when the user explicitly asks for Gemini,
  Nanobanana, or the existing Gemini edit script path.
- Do not use this skill for SVG, icon-system, or code-native visual edits.
  Edit those files directly or use `svg-diagram` for deterministic diagrams.

## Workflow

1. Identify the edit target image path, requested edit, output preference, and
   whether MDX references should stay unchanged.
2. Verify the image exists and is a bitmap asset in or intended for
   `decks/<deck>/assets/`.
3. Load the local target image into conversation context before editing:
   - Use the built-in `view_image` tool for local filesystem images.
   - Treat the loaded image as the edit target, not merely as style reference.
4. Inspect deck context when relevant:
   - Read MDX files that reference the target asset.
   - Read `decks/<deck>/deck.config.ts` and deck-level `CLAUDE.md` when style
     or mascot consistency matters.
5. Build a precise English edit prompt:
   - State exactly what changes.
   - State what must remain unchanged: subject identity, pose, composition,
     colors, background, transparency, brand style, or aspect ratio as needed.
   - Avoid changing in-image text unless the user explicitly requested exact
     text changes.
6. Edit with built-in `image_gen` using the loaded image as the edit target.
7. Save the selected revised output:
   - Overwrite the original only when the user explicitly requested replacement.
   - Otherwise save a sibling filename such as `<name>-edited.png` or
     `<name>-v2.png` under `decks/<deck>/assets/`.
   - Use the file path returned by the tool when available; otherwise locate
     the selected output under `$CODEX_HOME/generated_images/`.
   - Never leave an MDX-referenced project asset only under `$CODEX_HOME`.
8. Verify the saved asset:
   - Confirm the file exists and is a valid image.
   - Inspect the result when the environment allows it.
   - Check the file size. If it is over roughly 2MB, prefer a simpler targeted
     re-edit before lossy compression.
9. Update MDX only when needed:
   - If overwriting the same path, MDX references remain valid.
   - If saving to a new filename, update all intended references from
     `./assets/<old>` to `./assets/<new>`.
10. Report the final asset path, whether the original was overwritten, any MDX
    references changed, and the final edit prompt.

## Notes

- Preserve invariants aggressively. Image editing should be narrower than
  regeneration.
- If the edit drifts too far from the source, retry once with a stricter prompt
  that names the unchanged elements first.
- If the user asks for true native transparency or a complex cutout, follow the
  system `imagegen` transparent-image guidance before choosing any CLI fallback.
