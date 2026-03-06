---
name: display-captions
description: Displaying captions in Remotion with TikTok-style pages and word highlighting
metadata:
  tags: captions, subtitles, display, tiktok, highlight
---

# Displaying captions in Remotion

## Prerequisites

```bash
npx remotion add @remotion/captions
```

## Fetching captions

```tsx
import { useState, useEffect, useCallback } from "react";
import { AbsoluteFill, staticFile, useDelayRender } from "remotion";
import type { Caption } from "@remotion/captions";

export const MyComponent: React.FC = () => {
  const [captions, setCaptions] = useState<Caption[] | null>(null);
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender());

  const fetchCaptions = useCallback(async () => {
    try {
      const response = await fetch(staticFile("captions.json"));
      const data = await response.json();
      setCaptions(data);
      continueRender(handle);
    } catch (e) {
      cancelRender(e);
    }
  }, [continueRender, cancelRender, handle]);

  useEffect(() => {
    fetchCaptions();
  }, [fetchCaptions]);

  if (!captions) return null;

  return <AbsoluteFill>{/* Render captions here */}</AbsoluteFill>;
};
```

## Creating pages

```tsx
import { createTikTokStyleCaptions } from "@remotion/captions";

const SWITCH_CAPTIONS_EVERY_MS = 1200;

const { pages } = useMemo(() => {
  return createTikTokStyleCaptions({
    captions,
    combineTokensWithinMilliseconds: SWITCH_CAPTIONS_EVERY_MS,
  });
}, [captions]);
```

## Rendering with Sequences

```tsx
import { Sequence, useVideoConfig } from "remotion";

const { fps } = useVideoConfig();

return (
  <AbsoluteFill>
    {pages.map((page, index) => {
      const nextPage = pages[index + 1] ?? null;
      const startFrame = (page.startMs / 1000) * fps;
      const endFrame = Math.min(
        nextPage ? (nextPage.startMs / 1000) * fps : Infinity,
        startFrame + (SWITCH_CAPTIONS_EVERY_MS / 1000) * fps,
      );
      const durationInFrames = endFrame - startFrame;

      if (durationInFrames <= 0) return null;

      return (
        <Sequence key={index} from={startFrame} durationInFrames={durationInFrames}>
          <CaptionPage page={page} />
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
```

## Word highlighting

```tsx
import type { TikTokPage } from "@remotion/captions";

const HIGHLIGHT_COLOR = "#39E508";

const CaptionPage: React.FC<{ page: TikTokPage }> = ({ page }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTimeMs = (frame / fps) * 1000;
  const absoluteTimeMs = page.startMs + currentTimeMs;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ fontSize: 80, fontWeight: "bold", whiteSpace: "pre" }}>
        {page.tokens.map((token) => {
          const isActive = token.fromMs <= absoluteTimeMs && token.toMs > absoluteTimeMs;
          return (
            <span key={token.fromMs} style={{ color: isActive ? HIGHLIGHT_COLOR : "white" }}>
              {token.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
```

Notes:
- Use `whiteSpace: "pre"` to preserve whitespace in captions.
- Put captioning logic in a separate component file.
