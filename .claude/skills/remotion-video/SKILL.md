---
name: remotion-video
description: |
  Convert DexCode slide decks into animated videos using Remotion.
  Extracts theme colors, fonts, and slide content from deck.config.ts and MDX files,
  then generates a Remotion project that matches the deck's visual identity.
  Triggers: remotion, video generation, create video, render video, deck to video,
  動画にして, 動画化, 動画を作って, ビデオ生成
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - WebFetch
---

## When to use

Use this skill when a user wants to convert a DexCode slide deck into a video.
The typical request is: "このデッキを動画にして" (turn this deck into a video).

## Workflow

### Step 1: Identify Target Deck

Determine which deck to convert from the user's request.
Decks live under `decks/<deck-name>/`.

If unclear, list available decks:

```bash
ls decks/
```

### Step 2: Extract Theme

Retrieve the deck's theme colors and fonts for Remotion styling:

```bash
npx tsx .claude/skills/svg-diagram/scripts/extract-theme.ts --deck <deck-name>
```

This outputs a JSON with all resolved theme values:
- `primary`, `secondary`, `accent` — brand colors
- `background`, `text`, `textMuted`, `textSubtle` — text/background colors
- `surface`, `surfaceAlt`, `border`, `borderLight` — container colors
- `fontHeading`, `fontBody`, `fontMono` — font families
- `headingWeight`, `radius` — typography and shape

### Step 3: Read Slide Content

1. Read `decks/<deck-name>/deck.config.ts` for logo, copyright, transition settings
2. Glob `decks/<deck-name>/*.mdx` to list all slides (sorted by filename)
3. Read each MDX file to extract:
   - `type` from frontmatter (cover, section, content, ending, etc.)
   - Headings, body text, key visual descriptions
   - `notes` from frontmatter (use as narration script if voiceover is requested)

### Step 4: Design Video Storyboard

Map each slide to a Remotion scene. Follow these design rules:

#### Theme Mapping to Remotion

```tsx
// Theme values extracted in Step 2 become React constants
const THEME = {
  primary: "#7F1084",        // from extract-theme
  background: "#FFFFFF",
  text: "#1a1a1a",
  textMuted: "#6b7280",
  surface: "#f8f9fa",
  fontHeading: "Inter, sans-serif",
  fontBody: "Noto Sans JP, sans-serif",
  headingWeight: 800,
};
```

#### Slide Type to Scene Mapping

| Slide Type | Video Scene Style |
|---|---|
| `cover` | Full-screen title with brand colors, logo fade-in, subtitle typewriter |
| `section` | Large heading centered, primary color background or accent bar |
| `content` | Heading slides in from top, bullet points stagger in one-by-one |
| `comparison` | Split-screen with left/right panels animating in |
| `stats` / `big-number` | Number count-up animation with spring easing |
| `image-full` | Ken Burns zoom effect on the image |
| `quote` | Fade-in text with subtle italic styling |
| `ending` | Logo + CTA + fade out |

#### Transition Between Scenes

Use the deck's `transition` setting from `deck.config.ts`:
- `fade` → `fade()` from `@remotion/transitions`
- `slide` → `slide({ direction: "from-right" })`
- `none` → hard cut (no transition)

#### Timing Guidelines

- **Cover slide**: 4-5 seconds
- **Section divider**: 2-3 seconds
- **Content slide**: 5-8 seconds (more for dense content)
- **Ending slide**: 3-4 seconds
- **Transition overlap**: 15-20 frames at 30fps

### Step 5: Generate Remotion Project

Create files under `decks/<deck-name>/video/`:

```
decks/<deck-name>/video/
├── src/
│   ├── Root.tsx              # RemotionRoot with all compositions
│   ├── Composition.tsx       # Main video composition
│   ├── theme.ts              # Theme constants from deck.config
│   ├── scenes/
│   │   ├── CoverScene.tsx    # Cover slide scene
│   │   ├── SectionScene.tsx  # Section divider scene
│   │   ├── ContentScene.tsx  # Content slide scene
│   │   └── EndingScene.tsx   # Ending scene
│   └── components/
│       ├── AnimatedHeading.tsx
│       ├── AnimatedBullets.tsx
│       └── Logo.tsx
├── public/                   # Copy relevant assets from deck
│   └── (logo, images, etc.)
├── package.json
├── tsconfig.json
└── remotion.config.ts
```

#### Design Principles for Video Generation

1. **Match the deck's visual identity exactly** — same colors, same fonts, same spacing feel
2. **No decorative elements that don't exist in the deck** — if the deck is minimal, the video is minimal
3. **Animations serve comprehension** — stagger bullets so the audience reads them in order
4. **16:9 aspect ratio** (1920x1080) — matches the slide format
5. **30fps** — standard for presentation videos
6. **All animations must use `useCurrentFrame()`** — never CSS animations
7. **Load fonts via `@remotion/google-fonts` or `@remotion/fonts`** — match `fontHeading`/`fontBody` from theme
8. **Copy deck assets** (logo, images) to `video/public/` and reference via `staticFile()`

### Step 6: Render

```bash
cd decks/<deck-name>/video
npm install
npx remotion preview  # Preview in browser
npx remotion render Composition out.mp4  # Render final video
```

### Step 7: Report Results

Report to the user:
- Video file path
- Total duration and scene count
- Theme colors applied
- How to preview (`npx remotion preview`)

## Remotion Rule Files

For detailed Remotion API patterns, load the relevant rule file:

### Core
- [rules/compositions.md](rules/compositions.md) — Defining compositions
- [rules/animations.md](rules/animations.md) — Frame-based animation fundamentals
- [rules/timing.md](rules/timing.md) — Interpolation, spring, easing
- [rules/sequencing.md](rules/sequencing.md) — Sequence, Series, timing control
- [rules/transitions.md](rules/transitions.md) — Scene transitions (fade, slide, wipe)
- [rules/trimming.md](rules/trimming.md) — Trim start/end of animations

### Media
- [rules/images.md](rules/images.md) — Embedding images (`<Img>`)
- [rules/videos.md](rules/videos.md) — Embedding video clips
- [rules/audio.md](rules/audio.md) — Audio playback and control
- [rules/fonts.md](rules/fonts.md) — Google Fonts and local fonts
- [rules/gifs.md](rules/gifs.md) — Animated GIFs
- [rules/assets.md](rules/assets.md) — Asset management with `staticFile()`

### Text & Layout
- [rules/text-animations.md](rules/text-animations.md) — Typewriter, highlighting
- [rules/measuring-text.md](rules/measuring-text.md) — Text dimension measurement
- [rules/measuring-dom-nodes.md](rules/measuring-dom-nodes.md) — DOM measurement

### Advanced
- [rules/charts.md](rules/charts.md) — Animated charts (bar, pie, line)
- [rules/parameters.md](rules/parameters.md) — Zod schema for parametric videos
- [rules/calculate-metadata.md](rules/calculate-metadata.md) — Dynamic duration/dimensions
- [rules/voiceover.md](rules/voiceover.md) — ElevenLabs TTS voiceover
- [rules/audio-visualization.md](rules/audio-visualization.md) — Spectrum/waveform display
- [rules/3d.md](rules/3d.md) — Three.js integration
- [rules/light-leaks.md](rules/light-leaks.md) — Light leak overlay effects
- [rules/lottie.md](rules/lottie.md) — Lottie animations
- [rules/maps.md](rules/maps.md) — Mapbox map animations
- [rules/sfx.md](rules/sfx.md) — Sound effects
- [rules/transparent-videos.md](rules/transparent-videos.md) — Transparent video rendering
- [rules/ffmpeg.md](rules/ffmpeg.md) — FFmpeg/FFprobe operations

### Captions
- [rules/subtitles.md](rules/subtitles.md) — Caption format overview
- [rules/display-captions.md](rules/display-captions.md) — TikTok-style caption rendering
- [rules/transcribe-captions.md](rules/transcribe-captions.md) — Audio transcription
- [rules/import-srt-captions.md](rules/import-srt-captions.md) — SRT file import

### Utilities
- [rules/tailwind.md](rules/tailwind.md) — TailwindCSS in Remotion
- [rules/can-decode.md](rules/can-decode.md) — Video decode check
- [rules/extract-frames.md](rules/extract-frames.md) — Frame extraction
- [rules/get-audio-duration.md](rules/get-audio-duration.md) — Audio duration
- [rules/get-video-duration.md](rules/get-video-duration.md) — Video duration
- [rules/get-video-dimensions.md](rules/get-video-dimensions.md) — Video dimensions
