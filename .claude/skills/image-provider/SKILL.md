---
name: image-provider
description: |
  Routes Amaroad deck image generation and editing to the user's chosen provider.
  Use for any request to create, generate, revise, edit, recolor, restyle, remove,
  replace, or crop a slide image when the user has NOT explicitly chosen
  GPT/Codex/image_gen or Gemini/Nanobanana — including "画像を生成", "画像を作って",
  "画像を編集", "画像を修正", "generate an image", "edit this image".
  Ask which provider to use, then hand off to codex-image, codex-image-edit,
  nanobanana-image, or nanobanana-image-edit. Do not generate, edit, overwrite,
  or update MDX before the user has chosen.
allowed-tools:
  - AskUserQuestion
  - Skill
  - Read
  - Glob
  - Grep
---

## Core Rule

If the user asks for image generation or editing and has not explicitly chosen a
provider, ask exactly one provider question before anything else:

> 画像生成/編集は GPT/Codex と Gemini/Nanobanana のどちらで行いますか？

Use `AskUserQuestion` with these options:

| Option | Description |
|---|---|
| GPT / Codex | Codex CLI built-in `image_gen`. Uses the ChatGPT/Codex subscription; no API key. ~30-120s per image. |
| Gemini / Nanobanana | Gemini API via `GEMINI_API_KEY` in `.env.local`. Faster, and supports explicit aspect ratio and resolution. |

Do not generate, edit, overwrite files, or update MDX until the user has chosen.

Ask this question once per request, not once per image. If the user is producing
several images in one go, the choice applies to all of them.

## Provider Detection

Skip the question entirely when the user already named a provider.

Treat these as **GPT/Codex**: `GPT`, `OpenAI`, `Codex`, `image_gen`,
`ChatGPT/Codex subscription`, 「Codex の画像生成」, 「GPTで」.

Treat these as **Gemini/Nanobanana**: `Gemini`, `Nanobanana`, `Nano Banana`,
`Google`, `Gemini API`, 「既存の Gemini スクリプト」, 「Geminiで」.

If both are mentioned and the intent is not clear, ask the same question.

## Routing

After the provider is known, classify the request and hand off:

| Provider | New image | Edit existing image |
|---|---|---|
| GPT / Codex | `codex-image` | `codex-image-edit` |
| Gemini / Nanobanana | `nanobanana-image` | `nanobanana-image-edit` |

Classify as an **edit** when the user points to an existing image asset and asks
to revise, fix, remove, add, recolor, restyle, crop, replace, or preserve any
part of it. Otherwise classify as **new**.

Invoke the chosen skill with the Skill tool and let it run its own workflow —
this skill's job ends at the handoff.

## Non-Image Cases

Ask no provider question when the request is not for a raster image:

- **Diagrams, flows, architecture visuals, comparison charts**: use `svg-diagram`.
- **Charts from quantitative data**: use the deck's chart components.
- **A real logged-in, proprietary, or user-specific UI state**: insert a
  screenshot placeholder instead — see the `screenshot_placeholder` rule in
  CLAUDE.md. Only the user can supply that screenshot.
- **The user explicitly asked for SVG, HTML/CSS, or another deterministic,
  code-native output**: build it directly.

## Fallback

If the chosen provider is unavailable, say so and offer the other one rather
than silently switching:

- Codex path needs the `codex` CLI installed and signed in (`codex login`).
- Gemini path needs `GEMINI_API_KEY` in `.env.local` at the project root.
