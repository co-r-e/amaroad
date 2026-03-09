---
name: remotion-best-practices
description: |
  Provides best practices and API reference for building Remotion videos in React.
  Covers animations, transitions, fonts, assets, audio, captions, charts, 3D, and
  rendering configuration across 30+ progressive-disclosure rule files.
  Use when user says "Remotion code", "video rendering", "remotion animation",
  "remotion setup", "how do I animate in Remotion", or "Remotion best practice".
  Key capabilities: interpolation and spring timing, TransitionSeries patterns,
  Google Fonts loading, audio visualization, subtitle sync, GIF embedding, Lottie
  integration, Three.js 3D, parametrizable videos, and FFmpeg operations.
---

## Captions

When dealing with captions or subtitles, load the [./rules/subtitles.md](./rules/subtitles.md) file for more information.

## Using FFmpeg

For some video operations, such as trimming videos or detecting silence, FFmpeg should be used. Load the [./rules/ffmpeg.md](./rules/ffmpeg.md) file for more information.

## Audio visualization

When needing to visualize audio (spectrum bars, waveforms, bass-reactive effects), load the [./rules/audio-visualization.md](./rules/audio-visualization.md) file for more information.

## Sound effects

When needing to use sound effects, load the [./rules/sound-effects.md](./rules/sound-effects.md) file for more information.

## How to use

Read individual rule files for detailed explanations and code examples:

- [rules/3d.md](rules/3d.md) - 3D content in Remotion using Three.js and React Three Fiber
- [rules/animations.md](rules/animations.md) - Fundamental animation skills for Remotion
- [rules/assets.md](rules/assets.md) - Importing images, videos, audio, and fonts into Remotion
- [rules/audio.md](rules/audio.md) - Using audio and sound in Remotion - importing, trimming, volume, speed, pitch
- [rules/calculate-metadata.md](rules/calculate-metadata.md) - Dynamically set composition duration, dimensions, and props
- [rules/can-decode.md](rules/can-decode.md) - Check if a video can be decoded by the browser using Mediabunny
- [rules/charts.md](rules/charts.md) - Chart and data visualization patterns for Remotion (bar, pie, line, stock charts)
- [rules/compositions.md](rules/compositions.md) - Defining compositions, stills, folders, default props and dynamic metadata
- [rules/extract-frames.md](rules/extract-frames.md) - Extract frames from videos at specific timestamps using Mediabunny
- [rules/fonts.md](rules/fonts.md) - Loading Google Fonts and local fonts in Remotion
- [rules/get-audio-duration.md](rules/get-audio-duration.md) - Getting the duration of an audio file in seconds with Mediabunny
- [rules/get-video-dimensions.md](rules/get-video-dimensions.md) - Getting the width and height of a video file with Mediabunny
- [rules/get-video-duration.md](rules/get-video-duration.md) - Getting the duration of a video file in seconds with Mediabunny
- [rules/gifs.md](rules/gifs.md) - Displaying GIFs synchronized with Remotion's timeline
- [rules/images.md](rules/images.md) - Embedding images in Remotion using the Img component
- [rules/light-leaks.md](rules/light-leaks.md) - Light leak overlay effects using @remotion/light-leaks
- [rules/lottie.md](rules/lottie.md) - Embedding Lottie animations in Remotion
- [rules/measuring-dom-nodes.md](rules/measuring-dom-nodes.md) - Measuring DOM element dimensions in Remotion
- [rules/measuring-text.md](rules/measuring-text.md) - Measuring text dimensions, fitting text to containers, and checking overflow
- [rules/sequencing.md](rules/sequencing.md) - Sequencing patterns for Remotion - delay, trim, limit duration of items
- [rules/tailwind.md](rules/tailwind.md) - Using TailwindCSS in Remotion
- [rules/text-animations.md](rules/text-animations.md) - Typography and text animation patterns for Remotion
- [rules/timing.md](rules/timing.md) - Interpolation curves in Remotion - linear, easing, spring animations
- [rules/transitions.md](rules/transitions.md) - Scene transition patterns for Remotion
- [rules/transparent-videos.md](rules/transparent-videos.md) - Rendering out a video with transparency
- [rules/trimming.md](rules/trimming.md) - Trimming patterns for Remotion - cut the beginning or end of animations
- [rules/videos.md](rules/videos.md) - Embedding videos in Remotion - trimming, volume, speed, looping, pitch
- [rules/parameters.md](rules/parameters.md) - Make a video parametrizable by adding a Zod schema
- [rules/maps.md](rules/maps.md) - Add a map using Mapbox and animate it
- [rules/voiceover.md](rules/voiceover.md) - Adding AI-generated voiceover to Remotion compositions using ElevenLabs TTS

## Examples

### Example 1: Add a spring-based fade-in animation

User says: "How do I make text fade in with a spring animation in Remotion?"

Actions:
1. Load `rules/animations.md` and `rules/timing.md` for interpolation and spring patterns.
2. Show a complete component using `useCurrentFrame()`, `spring()`, and `interpolate()`.
3. Explain `extrapolateLeft: "clamp"` and `extrapolateRight: "clamp"` usage.

Result: A working React component with a spring-driven opacity and translateY animation, ready to paste into a Remotion composition.

### Example 2: Add background music with volume ducking

User says: "I want background music that fades out during voiceover segments."

Actions:
1. Load `rules/audio.md` and `rules/sequencing.md`.
2. Demonstrate `<Audio>` with a volume callback that interpolates based on frame ranges.
3. Show how to layer audio with `<Sequence>` for voiceover timing.

Result: A composition with background music that ducks to 20% volume during voiceover and returns to full volume afterward.

## Troubleshooting

### CSS transition / animation used instead of Remotion API

Symptom: Animations work in the browser preview but produce static frames when rendering.
Cause: CSS `transition`, `animation`, or `@keyframes` were used. Remotion renders frame-by-frame and ignores CSS time-based animations.
Fix: Replace all CSS animations with `useCurrentFrame()` + `interpolate()` or `spring()`.

### Interpolation range error at frame 0

Symptom: `Error: inputRange must be monotonically non-decreasing` or unexpected values at the start of a scene.
Cause: The interpolation input range does not cover frame 0, or `extrapolateLeft` / `extrapolateRight` are not clamped.
Fix: Always add `extrapolateLeft: "clamp"` and `extrapolateRight: "clamp"` to every `interpolate()` call. Ensure the input range starts at or before the first frame the component will see.

### Fonts not loading in rendered video

Symptom: Text renders in a fallback system font in the final .mp4 but looks correct in Remotion Studio.
Cause: Google Fonts were imported via CSS `@import` instead of `@remotion/google-fonts`.
Fix: Use `import { loadFont } from "@remotion/google-fonts/FontName"` and call `loadFont()` at the top level of the component. See `rules/fonts.md`.
