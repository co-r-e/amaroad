---
name: excel-to-slides
description: |
  Generates an Amaroad MDX slide deck from an Excel (.xlsx) file. Each row
  becomes one content slide with a consistent card-based layout. Produces
  deck.config.ts, a ShowcaseCover, and numbered MDX files.
  Use when user says "Excelからスライド", "Excel to slides", "スプレッドシートから
  デッキを作って", "generate slides from spreadsheet", "一覧表をスライド化",
  or provides an .xlsx file and asks to turn it into a presentation.
  Key capabilities: automatic column mapping, dry-run preview, logo copy,
  hyperlinked source URLs, customizable theme colors and slide template.
---

# Excel to Slides

Generate an Amaroad slide deck where each Excel row becomes one MDX slide.

## Quick start

```bash
# Copy script to project if not present
cp <skill-dir>/scripts/generate-from-excel.mjs <project>/scripts/

# Ensure xlsx is installed
npm install --save-dev xlsx

# Dry-run first
node scripts/generate-from-excel.mjs <excel-file> <deck-name> \
  --title "Deck Title" --logo /path/to/logo.png --dry-run

# Generate
node scripts/generate-from-excel.mjs <excel-file> <deck-name> \
  --title "Deck Title" --logo /path/to/logo.png
```

## Workflow

1. **Confirm inputs** — Ask user for: Excel file path, deck name, title, logo (optional).
2. **Ensure xlsx package** — Run `npm ls xlsx` in the project root. If missing: `npm install --save-dev xlsx`.
3. **Copy script** — Copy `scripts/generate-from-excel.mjs` from skill dir to project `scripts/`.
4. **Dry-run** — Execute with `--dry-run`, show the file list.
5. **Generate** — Run without `--dry-run`.
6. **Verify** — Open the deck in the browser and screenshot a few slides.

## Expected Excel format

First sheet is read. Default column mapping:

| Column header | Maps to |
|---|---|
| 攻撃手法名 | Slide title (Japanese) |
| English Official / Common Name | Subtitle / filename slug |
| 攻撃対象レイヤー | Grey badge |
| 概要 | Overview box |
| 区分 | Grey badge |
| 予防策 | Card column 1 (light navy `#4A6FA5`) |
| 検知策 | Card column 2 (navy `#1B3A5C`) |
| 対応策 | Card column 3 (dark navy `#0A1E3D`) |
| ソースURL | Hyperlinked footer |

To use different columns, edit the `COL` object and the MDX template in the
script. See [references/template-guide.md](references/template-guide.md).

## CLI options

| Option | Description | Default |
|---|---|---|
| `--title <t>` | Deck title | deck-name |
| `--logo <path>` | Logo image → `assets/` | none |
| `--copyright <t>` | Copyright text | `© 2026 CORe Inc.` |
| `--dry-run` | List files without writing | off |

## Adapting for different Excel schemas

1. Open `scripts/generate-from-excel.mjs`
2. Edit the `COL` object to match new column headers
3. Edit the MDX template string inside `rows.forEach` to change layout
4. Adjust colors in the inline styles or `.measure-card` CSS

For detailed customization: [references/template-guide.md](references/template-guide.md)

## Output structure

```
decks/<deck-name>/
├── assets/logo.png       # if --logo provided
├── deck.config.ts
├── 01-cover.mdx           # ShowcaseCover split-band
├── 02-<slug>.mdx          # Row 1
├── 03-<slug>.mdx          # Row 2
└── ...
```
