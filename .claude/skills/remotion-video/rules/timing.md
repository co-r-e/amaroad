---
name: timing
description: Interpolation curves in Remotion - linear, easing, spring animations
metadata:
  tags: interpolate, spring, easing, bezier, timing
---

# Timing and Interpolation in Remotion

## Linear Interpolation

Use `interpolate()` for basic linear interpolation. Use `extrapolateRight: "clamp"` to limit output range:

```tsx
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";

const frame = useCurrentFrame();
const { fps } = useVideoConfig();

const opacity = interpolate(frame, [0, 1 * fps], [0, 1], {
  extrapolateRight: "clamp",
});
```

## Spring Animations

Use `spring()` for organic motion (animates from 0 to 1). Default physics: `mass: 1, damping: 10, stiffness: 100`.

```tsx
import { useCurrentFrame, useVideoConfig, spring } from "remotion";

const frame = useCurrentFrame();
const { fps } = useVideoConfig();

const scale = spring({ frame, fps, config: { damping: 200 } });
```

### Common spring presets

```tsx
// Smooth without bounce
spring({ frame, fps, config: { damping: 200 } });

// Snappy with minimal bounce
spring({ frame, fps, config: { damping: 20, stiffness: 200 } });

// Bouncy entrance
spring({ frame, fps, config: { damping: 8 } });

// Heavy and slow
spring({ frame, fps, config: { damping: 15, stiffness: 80, mass: 2 } });
```

### Delay and duration

```tsx
// Delay by 10 frames
spring({ frame, fps, delay: 10 });

// Stretch to specific duration
spring({ frame, fps, durationInFrames: 30 });
```

### Combining spring with interpolate

```tsx
const progress = spring({ frame, fps, config: { damping: 200 } });
const translateY = interpolate(progress, [0, 1], [100, 0]);
```

## Easing Functions

Use easing with `interpolate()`:

```tsx
import { Easing, interpolate } from "remotion";

// Quadratic ease-in-out
interpolate(frame, [0, 60], [0, 1], {
  easing: Easing.inOut(Easing.quad),
});

// Cubic bezier
interpolate(frame, [0, 60], [0, 1], {
  easing: Easing.bezier(0.25, 0.1, 0.25, 1),
});
```

Available convexities: `in`, `out`, `inOut`
Available curves: `quad`, `sin`, `exp`, `circle`
