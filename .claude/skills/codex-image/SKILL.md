---
name: codex-image
description: |
  Generates AI images with the Codex CLI's built-in image_gen tool (GPT / OpenAI)
  and inserts them into Amaroad MDX slides. Runs on the ChatGPT/Codex
  subscription, so no OPENAI_API_KEY is required.
  Use when the user explicitly asks for Codex, GPT, OpenAI, or image_gen image
  generation, or the Japanese equivalents "Codexで画像を生成", "GPTで画像を作って",
  "OpenAIで画像を生成".
  For provider-ambiguous image requests, use image-provider first so the user can
  choose GPT/Codex or Gemini/Nanobanana.
  Key capabilities: automatic aspect ratio detection from slide layout, 10 aspect
  ratios (9:16 to 21:9), 1K/2K/4K resolution cap, sandboxed delegation that cannot
  touch deck files, and automatic MDX insertion with correct asset paths.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
---

## How This Works

Claude Code has no built-in `image_gen` tool. This skill delegates one
non-interactive `codex exec` run per image, and the Codex CLI calls `image_gen`
on your behalf.

The delegated run is confined to a throwaway temp directory — it never sees
`decks/`, cannot write to the repository, and cannot run git. The generated PNG
is validated (real PNG, non-empty, dimensions read) and copied to its
destination by the script, not by the delegated agent.

## Prerequisites

- The Codex CLI must be installed and signed in. Verify with `codex --version`;
  if authentication fails, the script tells the user to run `codex login`.
- No `OPENAI_API_KEY` is needed. Do not ask for one, and do not fall back to the
  OpenAI Images API or to `scripts/image_gen.py`.
- Each image costs Codex subscription tokens (roughly 40k) and takes about
  30-120 seconds. Mention this if the user asks for many images at once.
- `oxipng` is used to shrink the generated PNG losslessly. It is optional — the
  script warns and continues without it — but install it with `brew install oxipng`
  to cut roughly 30-40% off every generated image at zero quality cost.

## Provider Boundary

- Use `codex-image-edit` instead when the user wants to modify an existing deck
  image rather than create a new one.
- Use `nanobanana-image` instead when the user explicitly asks for Gemini,
  Nanobanana, or the Gemini API path.
- Use `image-provider` first when the user has not chosen a provider.
- Use `svg-diagram` instead for flowcharts, architecture diagrams, process
  flows, and other visuals that should be deterministic SVG.
- Insert a screenshot placeholder (see the `screenshot_placeholder` rule in
  CLAUDE.md) instead of generating an image when the slide needs a real
  logged-in, proprietary, or user-specific UI state.

## Workflow

### Step 1: Gather Information

Identify the following from the user's request:

1. **Target deck**: directory name under `decks/`
2. **Target slide**: the MDX file the image goes into
3. **Image content**: what to depict
4. **Filename**: English kebab-case reflecting the content (e.g. `hero-cityscape.png`)
5. **Resolution**: default `1K` per the `ai_image_generation` rule in CLAUDE.md

Ask for anything missing that changes the result.

### Step 2: Layout Analysis and Aspect Ratio Selection

Capture the slide and analyze it visually to choose the aspect ratio. If the
user specified one explicitly, use theirs instead.

1. **Confirm the dev server is running** (`pnpm dev`, which serves port **3850**)
2. **Capture the slide** (reuses the nanobanana capture script):

```bash
pnpm exec tsx .claude/skills/nanobanana-image/scripts/capture-slide.ts \
  --deck <deck-name> \
  --slide <0-indexed> \
  --port 3850 \
  --output /tmp/slide-capture.png
```

3. **Read the captured image** and estimate the shape of the space the image
   will occupy: how much the title, text, and columns already take.
4. **Pick the closest ratio**:

| Aspect Ratio | Numeric (W/H) | Suitable Cases |
|---|---|---|
| `9:16` | 0.56 | Extreme portrait |
| `2:3` | 0.67 | Narrow portrait |
| `3:4` | 0.75 | Portrait column |
| `4:5` | 0.80 | Slightly portrait |
| `1:1` | 1.00 | Square area |
| `5:4` | 1.25 | Slightly landscape |
| `4:3` | 1.33 | Standard in-column placement |
| `3:2` | 1.50 | Landscape column |
| `16:9` | 1.78 | Full-width / wide area |
| `21:9` | 2.33 | Ultra-wide banner |

If the dev server is not running and the user does not want to start it, skip
the capture and choose from the slide's MDX structure instead. Say that you did.

**Note**: `image_gen` picks its own output dimensions, so the aspect ratio is a
composition hint, not a guarantee. The script warns when the result drifts more
than 5% from the request. This is usually fine — slide images render with
`object-fit: contain`.

### Step 3: Prompt Optimization

Convert the user's description into an English prompt following the
`ai_image_generation` rule in CLAUDE.md:

- One clear subject, centered, on a pure white background
- Phrases like "minimal clean composition", "no extra icons or decorations"
- Match the existing deck mascot or illustration style when the deck has one
- No text inside the image unless the user explicitly wants exact wording — the
  slide already carries its own heading in MDX

**Present the aspect ratio rationale and the prompt to the user before generating.**

### Step 4: Generate

```bash
pnpm exec tsx .claude/skills/codex-image/scripts/generate-image.ts \
  --prompt "<optimized English prompt>" \
  --output "decks/<deck>/assets/<filename>.png" \
  --aspect-ratio <ratio> \
  --resolution 1K
```

The script prints progress to stderr and the absolute saved path to stdout. It
refuses to overwrite an existing file unless you pass `--force`; without an
explicit replacement request from the user, use a versioned sibling name such as
`<name>-v2.png` instead.

The saved PNG is losslessly optimized before the script exits (typically -38%,
pixel-identical), and the size before and after is reported on stderr. Pass
`--optimize aggressive` when the file is still too heavy: it adds high-quality
palette quantization (pngquant at a 90-100 quality floor), which typically
reaches -55% and is visually indistinguishable on flat illustration.
Photographic images fail that quality floor on their own and keep full color
depth. `--optimize off` disables the step entirely.

### Step 5: Verify

Read the saved image with the Read tool and confirm:

- The subject, composition, and style match the request
- Nothing unwanted was added (stray text, decorations, busy background)
- The reported file size (after optimization) is roughly 500KB-1MB. If it still
  exceeds ~2MB the script warns; lower `--resolution` or try
  `--optimize aggressive` before falling back to a simpler prompt.

### Step 6: Insert into MDX

```mdx
![Description text](./assets/<filename>.png)
```

- `resolveAssetPaths()` rewrites `./assets/` to `/api/decks/<deck>/assets/`, so
  always use the relative form.
- Follow the `flex_overflow_prevention` rule in CLAUDE.md: give the wrapper
  `minHeight: 0` and `overflow: "hidden"`.
- Prefer the slide's existing image component (`FigureShowcase`, `ShowcaseCover`,
  `SlideImage`) over a bare image when one is already in use.

### Step 7: Report

Tell the user the saved path, the final prompt, the MDX file and position, and
how to check it (`pnpm dev`, then open the slide).

## Script Specification

| Argument | Required | Default | Description |
|---|---|---|---|
| `--prompt` | Yes | - | Image description (English recommended) |
| `--output` | Yes | - | Destination path, must end with `.png` |
| `--aspect-ratio` | No | `16:9` | Composition hint (`9:16`, `2:3`, `3:4`, `4:5`, `1:1`, `5:4`, `4:3`, `3:2`, `16:9`, `21:9`) |
| `--resolution` | No | `1K` | Longest-edge cap: `1K` (1536px), `2K` (2560px), `4K` (3840px) |
| `--model` | No | Codex CLI default | Codex model override |
| `--timeout` | No | `480` | Seconds to wait for Codex |
| `--optimize` | No | `lossless` | PNG shrinking: `lossless` (oxipng, pixel-identical), `aggressive` (adds pngquant at quality floor 90), `off` |
| `--no-resize` | No | off | Keep Codex's native dimensions |
| `--force` | No | off | Allow overwriting an existing destination |

When running via Bash, allow at least the script's timeout plus overhead — e.g.
`timeout: 540000` for the default 480s.

## Examples

### Example 1: Hero image for a cover slide

- User says: 「core-pitch のカバーに Codex でヒーロー画像を作って」
- Actions:
  1. Identify deck `core-pitch` and its cover MDX
  2. Capture the slide, see a full-width empty area, choose `16:9`
  3. Build a prompt matching the deck's dolphin mascot style
  4. Present ratio and prompt, then run `generate-image.ts`
  5. Read the result to verify, then insert `![Hero image](./assets/hero-cover.png)`
- Result: a 1K 16:9 PNG at `decks/core-pitch/assets/hero-cover.png`, referenced from the cover slide

### Example 2: Portrait illustration in a two-column slide

- User says: 「左カラムに GPT でイラストを入れて」
- Actions:
  1. Capture the slide, measure the left column as roughly 3:4
  2. Generate at `--aspect-ratio 3:4 --resolution 1K`
  3. Insert into the left `<Column>` with `minHeight: 0` and `overflow: "hidden"` on the wrapper
- Result: a portrait illustration that fits the column without overflowing the inviolable area

## Troubleshooting

### `codex` CLI not found
- **Symptom**: "the `codex` CLI was not found on PATH"
- **Fix**: Install the Codex CLI and run `codex login`. Alternatively offer the
  user `nanobanana-image`, which uses the Gemini API key already in `.env.local`.

### Codex exits non-zero with an authentication error
- **Symptom**: "codex exec failed (exit code N)" with auth text in the tail
- **Fix**: Run `codex login`. This skill never uses `OPENAI_API_KEY`, so adding
  one will not help.

### Codex finishes but writes no image
- **Symptom**: "codex exec finished but wrote no image", plus Codex's own message
- **Fix**: Usually a declined request. Rephrase to avoid real people's likenesses,
  brand marks, or sensitive content, and regenerate.

### Timeout
- **Symptom**: "codex exec timed out after 480s"
- **Fix**: Simplify the prompt, or raise `--timeout` and raise the Bash timeout
  to match.

### Result ignores the requested aspect ratio
- **Symptom**: A warning that the actual ratio differs from the request
- **Fix**: Expected — `image_gen` chooses its own dimensions. Restate the framing
  inside `--prompt` ("wide banner composition with generous horizontal space")
  and regenerate if the framing genuinely matters.

### Slide capture fails
- **Symptom**: `capture-slide.ts` cannot connect
- **Fix**: Start the dev server with `pnpm dev`. The script defaults to port
  3850, which is what `pnpm dev` serves.

### oxipng is not installed
- **Symptom**: "skipped image optimization: `oxipng` is not installed"
- **Fix**: `brew install oxipng`. The image is still saved correctly; it is just
  30-40% larger than it needs to be.
