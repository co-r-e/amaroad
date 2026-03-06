---
name: animations
description: Fundamental animation skills for Remotion
metadata:
  tags: animation, useCurrentFrame, interpolate, motion
---

# Animations in Remotion

All animations must use `useCurrentFrame()` as the driving mechanism.

## Basic animation

Write animations in seconds, then multiply by `fps` to convert to frames:

```tsx
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";

export const MyAnimation = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [0, 2 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });

  return <div style={{ opacity }}>Hello World</div>;
};
```

## Forbidden approaches

- CSS transitions and animations will not render correctly
- Tailwind animation class names are incompatible with Remotion's rendering system

All motion must be frame-based and explicitly controlled through React state derived from the current frame counter.
