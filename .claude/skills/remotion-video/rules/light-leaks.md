---
name: light-leaks
description: Light leak overlay effects using @remotion/light-leaks
metadata:
  tags: light-leaks, overlay, effect, transition, webgl
---

# Light Leaks in Remotion

The `<LightLeak>` component from `@remotion/light-leaks` creates a WebGL-based overlay effect that reveals during the first half of its duration and retracts during the second half.

Requires Remotion 4.0.415 and up. Check with `npx remotion versions` and update with `npx remotion upgrade`.

## Prerequisites

```bash
npx remotion add @remotion/light-leaks
```

## Basic usage

```tsx
import { LightLeak } from "@remotion/light-leaks";
import { AbsoluteFill } from "remotion";

<AbsoluteFill>
  <YourContent />
  <LightLeak />
</AbsoluteFill>;
```

## With TransitionSeries

Primarily designed for use within `<TransitionSeries.Overlay>`:

```tsx
import { TransitionSeries } from "@remotion/transitions";
import { LightLeak } from "@remotion/light-leaks";

<TransitionSeries>
  <TransitionSeries.Sequence durationInFrames={60}>
    <SceneA />
  </TransitionSeries.Sequence>
  <TransitionSeries.Overlay durationInFrames={30}>
    <LightLeak />
  </TransitionSeries.Overlay>
  <TransitionSeries.Sequence durationInFrames={60}>
    <SceneB />
  </TransitionSeries.Sequence>
</TransitionSeries>;
```

## Configuration

- `durationInFrames` - Defaults to parent composition length
- `seed` - Controls the leak pattern; default is `0` (yellow-orange tint)
- `hueShift` - Adjusts color from 0-360 degrees (`120` = green, `240` = blue)

```tsx
<LightLeak seed={3} hueShift={120} />
```
