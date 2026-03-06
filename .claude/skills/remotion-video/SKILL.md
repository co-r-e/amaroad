---
name: remotion-video
description: |
  Convert a DexCode slide deck into an animated video using Remotion.
  Reads deck.config.ts and MDX slides, then generates a standalone Remotion
  project that faithfully reproduces the deck's theme, layout, and content
  as a frame-by-frame animated video.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Agent
---

# Remotion Video Skill

## When To Use

- User says "このデッキを動画にして", "make a video from this deck", or similar
- User wants to convert a DexCode presentation to an MP4 video
- User requests animated slide videos

## Prerequisites

- The `remotion-best-practices` skill must be installed (provides Remotion API knowledge)
- Load relevant rule files from `.claude/skills/remotion-best-practices/rules/` as needed

## Workflow

### Step 1: Identify Target Deck

Ask the user which deck to convert if not specified.
List available decks:

```bash
ls decks/
```

Read the deck config and all MDX slides:

```bash
# Extract theme
npx tsx .claude/skills/svg-diagram/scripts/extract-theme.ts --deck <deck-name>
```

Also read `decks/<deck-name>/deck.config.ts` to get the full config (title, logo, copyright, pageNumber, transition, accentLine).

### Step 2: Read and Analyze Slides

Read all `.mdx` files in `decks/<deck-name>/` (sorted by filename).
For each slide, extract:

- **frontmatter**: type, transition, notes, background, verticalAlign
- **content**: headings, paragraphs, lists, images, charts, components used

Build a slide manifest:

```
Slide 01 (cover): "Title text" — has logo, gradient background
Slide 02 (section): "Section Title" — centered, icon
Slide 03 (content): "Feature Overview" — 3-column grid with cards
...
```

### Step 3: Design Video Storyboard

Map each slide type to an animation pattern:

| Slide Type   | Animation Pattern |
|-------------|-------------------|
| cover       | Fade-in background → slide-in title → fade-in subtitle/badges |
| section     | Wipe transition → scale-in icon → fade-in heading + divider |
| content     | Fade → staggered card/item entrance (spring, 6-frame delay each) |
| comparison  | Split columns slide-in from left/right |
| stats       | Counter animation (interpolate numbers) → fade-in labels |
| timeline    | Sequential fade-in of timeline items top-to-bottom |
| image-left  | Image slides in from left → text fades in from right |
| image-right | Text fades in from left → image slides in from right |
| image-full  | Ken Burns effect (slow zoom + pan) |
| quote       | Fade-in quotation marks → typewriter text → fade-in attribution |
| agenda      | Staggered list item fade-in |
| ending      | Fade-in logo → slide-in text → fade-in CTA |

Default timing per slide:
- **Enter animation**: 1s (30 frames at 30fps)
- **Hold**: 3s (90 frames) — adjust based on content density
- **Exit/transition**: 0.5s (15 frames) via TransitionSeries

### Step 4: Generate Remotion Project

Create the project under `decks/<deck-name>/video/`:

```
decks/<deck-name>/video/
├── package.json
├── tsconfig.json
├── remotion.config.ts
├── src/
│   ├── Root.tsx              # Top-level component with Composition
│   ├── DeckVideo.tsx         # Main component using TransitionSeries
│   ├── scenes/
│   │   ├── Scene01Cover.tsx
│   │   ├── Scene02Section.tsx
│   │   ├── Scene03Content.tsx
│   │   └── ...
│   └── components/
│       ├── SlideBackground.tsx  # Background with theme colors
│       ├── AnimatedText.tsx     # Reusable text animation
│       └── SlideOverlay.tsx     # Logo, copyright, page number
```

#### package.json

```json
{
  "name": "<deck-name>-video",
  "private": true,
  "scripts": {
    "studio": "remotion studio",
    "render": "remotion render DeckVideo out/video.mp4",
    "preview": "remotion preview"
  },
  "dependencies": {
    "@remotion/cli": "latest",
    "@remotion/transitions": "latest",
    "@remotion/google-fonts": "latest",
    "@remotion/media": "latest",
    "react": "^19",
    "react-dom": "^19",
    "remotion": "latest"
  },
  "devDependencies": {
    "@types/react": "^19",
    "typescript": "^5"
  }
}
```

#### Key Rules (from remotion-best-practices)

- **16:9 at 1920x1080, 30fps**
- **All animation via `useCurrentFrame()` + `interpolate()` / `spring()`** — never CSS transitions or animations
- **Fonts via `@remotion/google-fonts`** — map from deck theme fonts
- **Assets via `staticFile()`** — copy deck assets to `public/`
- **Colors**: Map directly from deck theme colors extracted in Step 1
- **TransitionSeries** for slide-to-slide transitions (fade default, matching deck config)

#### Root.tsx Pattern

```tsx
import { Composition } from "remotion";
import { DeckVideo } from "./DeckVideo";

export const RemotionRoot: React.FC = () => {
  const fps = 30;
  const totalDuration = /* sum of all scene durations */;

  return (
    <Composition
      id="DeckVideo"
      component={DeckVideo}
      durationInFrames={totalDuration}
      fps={fps}
      width={1920}
      height={1080}
    />
  );
};
```

#### DeckVideo.tsx Pattern (TransitionSeries)

```tsx
import { TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";

export const DeckVideo: React.FC = () => {
  const fps = 30;
  const transitionDuration = Math.round(0.5 * fps); // 15 frames

  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={4 * fps}>
        <Scene01Cover />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={{ type: "in-out", durationInFrames: transitionDuration }}
      />
      <TransitionSeries.Sequence durationInFrames={4 * fps}>
        <Scene02Section />
      </TransitionSeries.Sequence>
      {/* ... more scenes ... */}
    </TransitionSeries>
  );
};
```

#### Scene Component Pattern

```tsx
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

export const Scene01Cover: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [15, 35], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const titleY = spring({ frame: frame - 15, fps, config: { damping: 15 } });

  return (
    <div style={{
      width: "100%",
      height: "100%",
      backgroundColor: theme.background,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <h1 style={{
        opacity: titleOpacity,
        transform: `translateY(${(1 - titleY) * 40}px)`,
        fontFamily: theme.fontHeading,
        fontWeight: theme.headingWeight,
        color: theme.primary,
        fontSize: 72,
      }}>
        {/* Deck title */}
      </h1>
    </div>
  );
};
```

### Step 5: Copy Assets

```bash
# Copy deck images to video project public/
cp -r decks/<deck-name>/assets/* decks/<deck-name>/video/public/
# Copy logo if used
cp public/dexcode-logo.svg decks/<deck-name>/video/public/  # if logo references /dexcode-logo.svg
```

### Step 6: Install and Render

```bash
cd decks/<deck-name>/video
npm install
npx remotion render DeckVideo out/video.mp4
```

### Step 7: Report Results

Report to the user:
- Output file path: `decks/<deck-name>/video/out/video.mp4`
- Total duration (seconds)
- Number of scenes
- Any warnings or issues

## Slide Duration Guidelines

Adjust hold time based on content density:

| Content Type | Hold Duration |
|-------------|--------------|
| Cover / Ending | 3s |
| Section divider | 2.5s |
| Simple content (1-3 items) | 3s |
| Dense content (4+ items, tables) | 4-5s |
| Stats / Numbers | 3.5s |
| Quote | 3s |
| Image-focused | 3s |

Total enter+hold+transition per slide is typically 4-5.5 seconds.

## Font Mapping

Map DexCode theme fonts to Remotion Google Fonts:

```tsx
// Example: if deck uses "Inter, sans-serif"
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadNotoSansJP } from "@remotion/google-fonts/NotoSansJP";

const inter = loadInter();
const notoSansJP = loadNotoSansJP();
```

If the deck font is not available in Google Fonts, use the closest match or load locally via `@remotion/fonts`.

## Operational Notes

- Always read the `remotion-best-practices` rules for API details before generating Remotion code
- Never use CSS `transition`, `animation`, or `@keyframes` — Remotion renders frame-by-frame
- All `<img>` must be `<Img>` from `@remotion/media`
- All durations: multiply seconds by fps (e.g., `3 * fps` for 3 seconds)
- Use `extrapolateLeft: "clamp"` and `extrapolateRight: "clamp"` on all `interpolate()` calls
- Japanese text needs `Noto Sans JP` loaded via `@remotion/google-fonts`
- For charts/graphs in slides, recreate them as animated SVG (reference `rules/charts.md`)

## Error Handling

- If `npx remotion render` fails, check the error output and fix the scene component
- Common issues: missing fonts, broken asset paths, invalid interpolation ranges
- Run `npx remotion studio` first to preview in browser before rendering
