---
name: voiceover
description: Adding AI-generated voiceover to Remotion compositions using ElevenLabs TTS
metadata:
  tags: voiceover, audio, elevenlabs, tts, speech, calculateMetadata, dynamic duration
---

# Adding AI voiceover to a Remotion composition

Use ElevenLabs TTS to generate speech audio per scene, then use `calculateMetadata` to dynamically size the composition to match the audio.

## Prerequisites

An **ElevenLabs API key** is required (`ELEVENLABS_API_KEY` environment variable).

**MUST** ask the user for their ElevenLabs API key if `ELEVENLABS_API_KEY` is not set. **MUST NOT** fall back to other TTS tools.

## Generating audio with ElevenLabs

Create a script that reads the config, calls the ElevenLabs API for each scene, and writes MP3 files to `public/`:

```ts title="generate-voiceover.ts"
const response = await fetch(
  `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
  {
    method: "POST",
    headers: {
      "xi-api-key": process.env.ELEVENLABS_API_KEY!,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: "Welcome to the show.",
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.3,
      },
    }),
  },
);

const audioBuffer = Buffer.from(await response.arrayBuffer());
writeFileSync(`public/voiceover/${compositionId}/${scene.id}.mp3`, audioBuffer);
```

## Dynamic composition duration

Use `calculateMetadata` to measure audio durations and set composition length:

```tsx
import { CalculateMetadataFunction, staticFile } from "remotion";

const FPS = 30;

export const calculateMetadata: CalculateMetadataFunction<Props> = async ({
  props,
}) => {
  const durations = await Promise.all(
    SCENE_AUDIO_FILES.map((file) => getAudioDuration(staticFile(file))),
  );

  const sceneDurations = durations.map((d) => d * FPS);

  return {
    durationInFrames: Math.ceil(sceneDurations.reduce((sum, d) => sum + d, 0)),
  };
};
```

If using `<TransitionSeries>`, subtract overlap from total duration.

## Rendering audio

See [audio.md](./audio.md) for rendering and [audio.md#delaying](./audio.md) for delaying audio start.
