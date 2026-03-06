---
name: audio
description: Using audio and sound in Remotion - importing, trimming, volume, speed, pitch
metadata:
  tags: audio, sound, music, volume, trim, speed, loop, pitch
---

# Using audio in Remotion

## Prerequisites

First, the @remotion/media package needs to be installed.
If it is not, use the following command:

```bash
npx remotion add @remotion/media # If project uses npm
bunx remotion add @remotion/media # If project uses bun
yarn remotion add @remotion/media # If project uses yarn
pnpm exec remotion add @remotion/media # If project uses pnpm
```

## Basic usage

Use `<Audio>` from `@remotion/media` to embed audio:

```tsx
import { Audio } from "@remotion/media";
import { staticFile } from "remotion";

export const MyComposition = () => {
  return <Audio src={staticFile("audio.mp3")} />;
};
```

Remote URLs are also supported:

```tsx
<Audio src="https://example.com/audio.mp3" />
```

## Trimming

Use `trimBefore` and `trimAfter` to remove portions. Values are in frames:

```tsx
const { fps } = useVideoConfig();

<Audio
  src={staticFile("audio.mp3")}
  trimBefore={2 * fps} // Skip first 2 seconds
  trimAfter={10 * fps} // End at 10 second mark
/>
```

## Delaying

Wrap audio in a `<Sequence>` to delay playback:

```tsx
const { fps } = useVideoConfig();

<Sequence from={1 * fps}>
  <Audio src={staticFile("audio.mp3")} />
</Sequence>
```

## Volume

Set static volume (0 to 1):

```tsx
<Audio src={staticFile("audio.mp3")} volume={0.5} />
```

Or use a callback for dynamic volume:

```tsx
import { interpolate } from "remotion";

const { fps } = useVideoConfig();

<Audio
  src={staticFile("audio.mp3")}
  volume={(f) =>
    interpolate(f, [0, 1 * fps], [0, 1], { extrapolateRight: "clamp" })
  }
/>
```

## Muting

```tsx
<Audio src={staticFile("audio.mp3")} muted />
```

## Speed

Use `playbackRate` to change speed:

```tsx
<Audio src={staticFile("audio.mp3")} playbackRate={2} />   {/* 2x speed */}
<Audio src={staticFile("audio.mp3")} playbackRate={0.5} /> {/* Half speed */}
```

Reverse playback is not supported.

## Looping

```tsx
<Audio src={staticFile("audio.mp3")} loop />
```

Use `loopVolumeCurveBehavior` to control frame counting:
- `"repeat"`: Frame count resets to 0 each loop
- `"extend"`: Frame count continues incrementing

```tsx
<Audio
  src={staticFile("audio.mp3")}
  loop
  loopVolumeCurveBehavior="extend"
  volume={(f) => interpolate(f, [0, 300], [1, 0])}
/>
```

## Pitch

Use `toneFrequency` to adjust pitch without affecting speed. Values range from 0.01 to 2:

```tsx
<Audio src={staticFile("audio.mp3")} toneFrequency={1.5} /> {/* Higher pitch */}
<Audio src={staticFile("audio.mp3")} toneFrequency={0.8} /> {/* Lower pitch */}
```

Pitch shifting only works during server-side rendering, not in the Remotion Studio preview or in the `<Player />`.

## Layering

Multiple `<Audio>` components can stack within a single composition for multi-track arrangements.
