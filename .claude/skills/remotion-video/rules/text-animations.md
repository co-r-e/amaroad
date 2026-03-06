---
name: text-animations
description: Typography and text animation patterns for Remotion
metadata:
  tags: typography, text, typewriter, highlighter
---

# Text Animations in Remotion

## Typewriter Effect

Always use string slicing for typewriter effects. Never use per-character opacity.

```tsx
import { useCurrentFrame, useVideoConfig } from "remotion";

export const Typewriter: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const charsPerSecond = 20;
  const charsToShow = Math.floor((frame / fps) * charsPerSecond);
  const displayText = text.slice(0, charsToShow);

  return (
    <div style={{ fontFamily: "monospace", fontSize: 48, whiteSpace: "pre" }}>
      {displayText}
      <span
        style={{
          opacity: Math.round(frame / 15) % 2 === 0 ? 1 : 0,
        }}
      >
        |
      </span>
    </div>
  );
};
```

### Advanced: sentence pauses

```tsx
const PAUSE_FRAMES = 15;
const CHARS_PER_FRAME = 0.5;

const sentences = text.split(/(?<=[.!?])\s+/);
let totalChars = 0;
let adjustedFrame = frame;

for (const sentence of sentences) {
  const sentenceEndFrame = (totalChars + sentence.length) / CHARS_PER_FRAME;
  if (frame > sentenceEndFrame) {
    adjustedFrame -= PAUSE_FRAMES;
  }
  totalChars += sentence.length;
}

const charsToShow = Math.floor(adjustedFrame * CHARS_PER_FRAME);
```

## Word Highlighting

Animate a highlighter pen effect over text:

```tsx
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";

export const HighlightedText: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = interpolate(frame, [0, 1 * fps], [0, 100], {
    extrapolateRight: "clamp",
  });

  return (
    <span
      style={{
        fontSize: 64,
        background: `linear-gradient(90deg, yellow ${progress}%, transparent ${progress}%)`,
        padding: "4px 8px",
      }}
    >
      {text}
    </span>
  );
};
```
