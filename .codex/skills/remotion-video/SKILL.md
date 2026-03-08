---
name: remotion-video
description: |
  Convert a DexCode slide deck into a standalone animated Remotion video project.
  Use when a deck should become an MP4 or video-ready Remotion composition that
  reproduces the deck theme, layout, and slide flow.
---

# Remotion Video

Convert a DexCode presentation into a Remotion-based video project.

## Use When

- The user wants to turn a deck into a video
- A deck needs animated slide-to-slide output
- A Remotion project should be generated from existing MDX slides

## Prerequisites

- The `remotion-best-practices` skill should also be used
- Relevant rule files under `rules/` should be read as needed

## Workflow

1. Identify the target deck
2. Read `deck.config.ts` and all slide `.mdx` files
3. Build a slide manifest by type and content density
4. Design an animation storyboard for each slide type
5. Generate a Remotion project under `decks/<deck-name>/video/`
6. Map theme colors, fonts, overlays, and transitions from the deck config
7. Use `TransitionSeries` and frame-based animation patterns rather than CSS transitions

## Project Shape

Create output like:

```text
decks/<deck-name>/video/
  package.json
  tsconfig.json
  remotion.config.ts
  src/
```

## Implementation Notes

- Standard target is `1920x1080` at `30fps`
- Use `useCurrentFrame()`, `interpolate()`, and `spring()` for motion
- Prefer `@remotion/google-fonts` for mapped theme fonts
- Keep slide-level timing readable before adding decorative motion

## Notes

- Read the `remotion-best-practices` rule files that match the requested video style.
- Preserve the source deck structure and brand theme rather than inventing an unrelated visual language.
