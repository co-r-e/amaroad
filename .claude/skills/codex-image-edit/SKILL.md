---
name: codex-image-edit
description: |
  Edits existing Amaroad deck images with the Codex CLI's built-in image_gen tool
  (GPT / OpenAI) and updates them in place or alongside the original. Runs on the
  ChatGPT/Codex subscription, so no OPENAI_API_KEY is required.
  Use when the user explicitly asks to revise, fix, remove, add, recolor, restyle,
  or crop an existing slide image with Codex, GPT, OpenAI, or image_gen, or the
  Japanese equivalents "Codexで画像を修正", "GPTで画像を編集", "この画像をGPTで直して".
  For provider-ambiguous image edit requests, use image-provider first so the user
  can choose GPT/Codex or Gemini/Nanobanana.
  Key capabilities: in-place overwrite or save-as-new, visual verification before
  and after, sandboxed delegation that cannot touch deck files, MDX reference updates.
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
non-interactive `codex exec` run, and the Codex CLI loads the image with
`view_image` and edits it with `image_gen`.

The source image is copied into a throwaway temp directory, which is the only
place that run can write. The original file is never reachable from it —
overwriting the source, when that is what was asked for, is done by the script
after the result has been verified as a real, non-empty PNG.

## Prerequisites

- The Codex CLI must be installed and signed in. Verify with `codex --version`;
  if authentication fails, the script tells the user to run `codex login`.
- No `OPENAI_API_KEY` is needed. Do not ask for one, and do not fall back to the
  OpenAI Images API or to `scripts/image_gen.py`.
- Each edit costs Codex subscription tokens (roughly 40k) and takes about
  30-120 seconds.
- `oxipng` is used to shrink the edited PNG losslessly. It is optional — the
  script warns and continues without it — but install it with `brew install oxipng`
  to cut roughly 30-40% off every image at zero quality cost.

## Provider Boundary

- Use `codex-image` instead when the user wants a brand-new image rather than a
  change to an existing asset.
- Use `nanobanana-image-edit` instead when the user explicitly asks for Gemini,
  Nanobanana, or the Gemini API path.
- Use `image-provider` first when the user has not chosen a provider.
- Do not use this skill for SVG, icon-system, or other code-native visuals. Edit
  those files directly, or use `svg-diagram`.

## Workflow

### Step 1: Identify the Target

Determine from the user's request:

1. **Target image**: the file path, usually `decks/<deck>/assets/<filename>.png`
2. **Edit description**: what to change
3. **Output preference**: overwrite in place, or save as a new file

If the image was generated or discussed earlier in the conversation, infer the
path from context. Use Glob to locate it when the name is uncertain. Ask when
the target is genuinely ambiguous.

### Step 2: Verify the Source

Read the target image with the Read tool to confirm it exists, that the region
to change is identifiable, and that the edit is feasible. Read the deck's
`deck.config.ts` or deck-level `CLAUDE.md` when mascot or style consistency
matters.

### Step 3: Build the Edit Prompt

Write a precise English prompt:

- State exactly **what changes** and **where**
- State what it becomes (e.g. "fill with the surrounding background")
- State what must **stay unchanged**: subject identity, pose, composition,
  colors, background, art style
- Do not change in-image text unless the user asked for exact wording

Editing should be narrower than regeneration — repeat the invariants every time.

**Present the prompt to the user before running.**

### Step 4: Run the Edit

```bash
pnpm exec tsx .claude/skills/codex-image-edit/scripts/edit-image.ts \
  --image "decks/<deck>/assets/<filename>.png" \
  --prompt "<edit prompt>" \
  --resolution 1K
```

- Omit `--output` to overwrite the source in place, which keeps every existing
  MDX reference valid.
- Pass `--output "decks/<deck>/assets/<name>-v2.png"` to save non-destructively.
  The script refuses to clobber an existing different file unless you add
  `--force`.
- `--output` is required when the source is not a `.png`, because the result is
  always a PNG.
- The saved PNG is losslessly optimized before the script exits (typically -38%,
  pixel-identical), and the size before and after is reported on stderr. Pass
  `--optimize aggressive` when the file is still too heavy (adds pngquant at a
  90-100 quality floor, typically -55%), or `--optimize off` to disable the step.

### Step 5: Verify the Result

Read the output image with the Read tool and confirm:

- The requested change was applied
- Nothing else drifted — identity, pose, framing, palette
- The reported aspect ratio still matches the source (the script warns when it
  drifted more than 5%)

If the result drifted, retry once with a stricter prompt that names the
unchanged elements first.

### Step 6: Update MDX If Needed

- Overwrote in place: MDX references are still valid, nothing to do.
- Saved to a new filename: update every intended reference from
  `./assets/<old>.png` to `./assets/<new>.png`. Use Grep to find them all.

### Step 7: Report

Tell the user the final path, whether the original was replaced, which MDX
references changed, and the exact edit prompt used.

## Script Specification

| Argument | Required | Default | Description |
|---|---|---|---|
| `--image` | Yes | - | Source image: `.png`, `.jpg`, `.jpeg`, or `.webp` |
| `--prompt` | Yes | - | Edit instructions (English recommended) |
| `--output` | No | Same as `--image` | Destination, must end with `.png` |
| `--resolution` | No | `1K` | Longest-edge cap: `1K` (1536px), `2K` (2560px), `4K` (3840px) |
| `--model` | No | Codex CLI default | Codex model override |
| `--timeout` | No | `480` | Seconds to wait for Codex |
| `--optimize` | No | `lossless` | PNG shrinking: `lossless` (oxipng, pixel-identical), `aggressive` (adds pngquant at quality floor 90), `off` |
| `--no-resize` | No | off | Keep Codex's native dimensions |
| `--force` | No | off | Allow overwriting an existing destination other than `--image` |

When running via Bash, allow at least the script's timeout plus overhead — e.g.
`timeout: 540000` for the default 480s.

## Examples

### Example 1: Remove an unwanted element, in place

- User says: 「hero-cover.png の右下の文字を GPT で消して」
- Actions:
  1. Read `decks/<deck>/assets/hero-cover.png` to locate the text
  2. Prompt: "Remove the text in the bottom-right corner. Fill the area with the surrounding background. Keep the subject, composition, colors, and style exactly the same."
  3. Run `edit-image.ts` without `--output` to overwrite in place
  4. Read the result to confirm the text is gone and nothing else moved
- Result: the asset is updated at the same path, so no MDX change is needed

### Example 2: Restyle without touching the original

- User says: 「この画像の背景をダークネイビーにしたバージョンも作って」
- Actions:
  1. Prompt: "Replace only the background with a flat dark navy (#1a1a4e). Keep the subject, its edges, pose, and colors unchanged."
  2. Run with `--output "decks/<deck>/assets/<name>-dark.png"`
  3. Verify, then update only the slides that should use the dark variant
- Result: both variants exist; the original is untouched

## Troubleshooting

### `codex` CLI not found
- **Symptom**: "the `codex` CLI was not found on PATH"
- **Fix**: Install the Codex CLI and run `codex login`, or offer the user
  `nanobanana-image-edit`, which uses the Gemini API key already in `.env.local`.

### Codex exits non-zero with an authentication error
- **Symptom**: "codex exec failed (exit code N)" with auth text in the tail
- **Fix**: Run `codex login`. This skill never uses `OPENAI_API_KEY`.

### Codex finishes but writes no image
- **Symptom**: "codex exec finished but wrote no image", plus Codex's own message
- **Fix**: Usually a declined edit — common when the image contains a real
  person's likeness. Rephrase, or use a different approach entirely.

### The edit changed more than it should have
- **Symptom**: Identity, pose, or palette drifted
- **Fix**: Retry with the invariants stated first and the change stated last, and
  name each element that must not move. Do not stack multiple changes in one run.

### Source is not a PNG
- **Symptom**: "--output is required because the edit result is a PNG"
- **Fix**: Pass an explicit `.png` destination, then update the MDX references
  from the old extension to `.png`.

### oxipng is not installed
- **Symptom**: "skipped image optimization: `oxipng` is not installed"
- **Fix**: `brew install oxipng`. The image is still saved correctly; it is just
  30-40% larger than it needs to be.
