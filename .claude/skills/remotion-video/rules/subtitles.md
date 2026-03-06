---
name: subtitles
description: Working with captions and subtitles in Remotion
metadata:
  tags: captions, subtitles, srt, transcript
---

# Captions and Subtitles in Remotion

All captions must be processed using JSON format with the `Caption` type from `@remotion/captions`.

## Caption type

```tsx
import type { Caption } from "@remotion/captions";

// Caption shape:
// {
//   text: string;
//   startMs: number;
//   endMs: number;
//   timestampMs?: number;
//   confidence?: number;
// }
```

## Related guides

- **Transcribing audio/video**: See [transcribe-captions.md](./transcribe-captions.md) for converting media files into caption data.
- **Rendering captions**: See [display-captions.md](./display-captions.md) for incorporating captions into video output.
- **Converting subtitle files**: See [import-srt-captions.md](./import-srt-captions.md) for transforming .srt files into the required JSON structure.
