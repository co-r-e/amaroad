---
name: image-provider
description: |
  Route Amaroad deck image generation and image editing requests to the user's
  chosen provider. Use for generic requests to create, generate, revise, edit,
  recolor, restyle, remove, replace, crop, or otherwise transform slide images
  when the user has not explicitly chosen GPT/Codex/image_gen or
  Gemini/Nanobanana. Ask the user to choose a provider before using
  codex-image, codex-image-edit, nanobanana-image, or nanobanana-image-edit.
---

# Image Provider

Choose the image provider before generating or editing Amaroad deck images.

## Core Rule

If the user asks for image generation or image editing and has not explicitly
chosen GPT/Codex/image_gen or Gemini/Nanobanana, ask exactly one provider
question before proceeding:

```text
画像生成/編集は GPT/Codex と Gemini/Nanobanana のどちらで行いますか？
```

Do not generate, edit, overwrite, or update MDX until the user chooses a
provider.

## Provider Detection

Treat these as GPT/Codex choices:

- `GPT`
- `OpenAI`
- `Codex`
- `image_gen`
- `ChatGPT/Codex subscription`
- `Codex の画像生成`

Treat these as Gemini/Nanobanana choices:

- `Gemini`
- `Nanobanana`
- `Nano Banana`
- `Google`
- `Gemini API`
- `既存の Gemini スクリプト`

If both providers are mentioned and the requested provider is not clear, ask
the same provider question.

## Routing

After the user chooses a provider:

- GPT/Codex + new image -> use `codex-image`
- GPT/Codex + edit existing image -> use `codex-image-edit`
- Gemini/Nanobanana + new image -> use `nanobanana-image`
- Gemini/Nanobanana + edit existing image -> use `nanobanana-image-edit`

Classify the request as an edit when the user provides or points to an existing
image asset and asks to revise, fix, remove, add, recolor, restyle, crop,
replace, or preserve any part of it. Otherwise classify it as a new image.

## Non-Image Cases

- Use `svg-diagram` for deterministic diagrams, flows, architecture visuals,
  comparison charts, and other SVG/code-native output.
- Insert a screenshot placeholder instead of generating an AI image when the
  slide needs a real logged-in, proprietary, or user-specific UI state.
- Ask no provider question when the user explicitly requests SVG, HTML/CSS,
  charts, or another deterministic non-raster output.
