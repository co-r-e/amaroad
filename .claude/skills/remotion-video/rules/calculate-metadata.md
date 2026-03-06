---
name: calculate-metadata
description: Dynamically set composition duration, dimensions, and props before rendering
metadata:
  tags: calculateMetadata, dynamic, duration, dimensions, props
---

# calculateMetadata

Use `calculateMetadata` to dynamically set duration, dimensions, and transform props before rendering.

## Video-based configuration

```tsx
import { CalculateMetadataFunction, staticFile } from "remotion";

const calculateMetadata: CalculateMetadataFunction<Props> = async ({
  props,
  abortSignal,
}) => {
  const duration = await getVideoDuration(staticFile("video.mp4"));
  const dimensions = await getVideoDimensions(staticFile("video.mp4"));

  return {
    durationInFrames: Math.ceil(duration * 30),
    width: dimensions.width,
    height: dimensions.height,
  };
};
```

## Multiple videos

```tsx
const calculateMetadata: CalculateMetadataFunction<Props> = async ({
  props,
}) => {
  const durations = await Promise.all(
    props.videos.map((v) => getVideoDuration(staticFile(v))),
  );
  const totalDuration = durations.reduce((sum, d) => sum + d, 0);

  return {
    durationInFrames: Math.ceil(totalDuration * 30),
  };
};
```

## Fetching external data

```tsx
const calculateMetadata: CalculateMetadataFunction<Props> = async ({
  props,
  abortSignal,
}) => {
  const data = await fetch(`https://api.example.com/video/${props.id}`, {
    signal: abortSignal,
  }).then((res) => res.json());

  return {
    durationInFrames: Math.ceil(data.duration * 30),
    props: {
      ...props,
      videoUrl: data.url,
    },
  };
};
```

The `abortSignal` cancels stale requests when props change in the Studio.

## Return values

All fields are optional:

- `durationInFrames` - composition duration
- `width` - composition width
- `height` - composition height
- `fps` - frames per second
- `props` - transformed props
- `defaultOutName` - output filename based on props
- `defaultCodec` - rendering codec

## Default output settings

```tsx
const calculateMetadata: CalculateMetadataFunction<Props> = async () => {
  return {
    defaultCodec: "prores",
    defaultVideoImageFormat: "png",
    defaultPixelFormat: "yuva444p10le",
    defaultProResProfile: "4444",
  };
};
```
