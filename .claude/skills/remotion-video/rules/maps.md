---
name: maps
description: Make map animations with Mapbox
metadata:
  tags: map, map animation, mapbox
---

Maps can be added to a Remotion video with Mapbox.

## Prerequisites

Mapbox and `@turf/turf` need to be installed:

```bash
npm i mapbox-gl @turf/turf @types/mapbox-gl
```

The user needs to create a free Mapbox account and create an access token.

The mapbox token needs to be added to the `.env` file:

```txt title=".env"
REMOTION_MAPBOX_TOKEN=pk.your-mapbox-access-token
```

## Basic map

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { AbsoluteFill, useDelayRender, useVideoConfig } from "remotion";
import mapboxgl, { Map } from "mapbox-gl";

mapboxgl.accessToken = process.env.REMOTION_MAPBOX_TOKEN as string;

export const MyComposition = () => {
  const ref = useRef<HTMLDivElement>(null);
  const { delayRender, continueRender } = useDelayRender();
  const { width, height } = useVideoConfig();
  const [handle] = useState(() => delayRender("Loading map..."));
  const [map, setMap] = useState<Map | null>(null);

  useEffect(() => {
    const _map = new Map({
      container: ref.current!,
      zoom: 11.53,
      center: [6.5615, 46.0598],
      pitch: 65,
      bearing: 0,
      style: "mapbox://styles/mapbox/standard",
      interactive: false,
      fadeDuration: 0,
    });

    _map.on("load", () => {
      continueRender(handle);
      setMap(_map);
    });
  }, [handle]);

  const style: React.CSSProperties = useMemo(
    () => ({ width, height, position: "absolute" }),
    [width, height],
  );

  return <AbsoluteFill ref={ref} style={style} />;
};
```

Important rules:
- Animations must be driven by `useCurrentFrame()`. Disable Mapbox's own animations (`fadeDuration: 0`, `interactive: false`).
- Loading must be delayed using `useDelayRender()`.
- The container element MUST have explicit width, height, and `position: "absolute"`.
- Do not add a `_map.remove()` cleanup function.

## Rendering

When rendering a map animation:

```bash
npx remotion render --gl=angle --concurrency=1
```
