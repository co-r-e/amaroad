# nanobanana-image

A Claude Code skill for generating slide images using the Gemini API.

## Setup

### 1. Obtain a Gemini API Key

Get an API key from [Google AI Studio](https://aistudio.google.com/apikey).

### 2. Configure the API Key

Copy `.env.example` to create `.env.local` and enter the API key:

```bash
cp .env.example .env.local
```

`.env.local` is included in `.gitignore`, so the key will never be committed to the repository.

## Usage

Invoke in Claude Code as follows:

```
/nanobanana-image Add a futuristic city image to the sample deck
```

The skill will automatically optimize the prompt, generate the image, and insert it into the MDX file.

## Running the Script Standalone

```bash
pnpm exec tsx .claude/skills/nanobanana-image/scripts/generate-image.ts \
  --prompt "A futuristic cityscape at sunset, wide angle, cinematic lighting" \
  --output "decks/sample-deck/assets/hero-cityscape.png" \
  --aspect-ratio 16:9 \
  --resolution 2K
```

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `--prompt` | Yes | - | Image generation prompt (English recommended) |
| `--output` | Yes | - | Output path (.png) |
| `--aspect-ratio` | No | `16:9` | Aspect ratio |
| `--resolution` | No | `2K` | Resolution (1K / 2K / 4K) |
