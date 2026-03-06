---
name: assets
description: Importing images, videos, audio, and fonts into Remotion
metadata:
  tags: assets, staticFile, public, import, media
---

# Using Assets in Remotion

## Asset Storage

Place all assets in the `public/` folder at your project root.

## Using staticFile()

You **must** use `staticFile()` when referencing public folder files. It returns an encoded URL that works correctly when deploying to subdirectories.

```tsx
import { Img, staticFile } from "remotion";

<Img src={staticFile("photo.png")} />;
```

## Component Usage

- Images: use `<Img>` component with `staticFile()`
- Videos: use `<Video>` from `@remotion/media` with `staticFile()`
- Audio: use `<Audio>` from `@remotion/media` with `staticFile()`
- Fonts: use `loadFont()` with `staticFile()` wrapped in URL function for FontFace

## Remote Assets

External URLs can be used directly without `staticFile()`:

```tsx
<Img src="https://example.com/image.png" />
```

## Automatic Handling

Remotion components ensure assets load completely before rendering. Special characters in filenames (`#`, `?`, `&`) are automatically encoded.
