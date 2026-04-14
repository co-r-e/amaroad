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

## Workflow

1. Confirm inputs: Excel file path, deck name, title, logo (optional)
2. Ensure `xlsx` is installed (already a direct dep — `pnpm install` covers it)
3. Dry-run to preview file list
4. Generate all slides
5. Verify in browser

## Usage

```bash
node .codex/skills/excel-to-slides/scripts/generate-from-excel.mjs \
  <excel-file> <deck-name> \
  [--title "Deck Title"] \
  [--logo /path/to/logo.png] \
  [--copyright "© 2026 CORe Inc."] \
  [--dry-run]
```

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

To adapt for a different schema, edit the `COL` object and the MDX template in
the script. See [references/template-guide.md](references/template-guide.md).

## CLI options

| Option | Default |
|---|---|
| `--title <t>` | deck-name |
| `--logo <path>` | none |
| `--copyright <t>` | `© 2026 CORe Inc.` |
| `--dry-run` | off |

## Output

```
decks/<deck-name>/
├── assets/logo.png
├── deck.config.ts
├── 01-cover.mdx
├── 02-<slug>.mdx
└── ...
```

## Design tokens

| Element | Color |
|---|---|
| Badge text | `#02001A` |
| Badge bg | `#ECEDF0` |
| 予防策 | `#4A6FA5` |
| 検知策 | `#1B3A5C` |
| 対応策 | `#0A1E3D` |
| Card bg | `#F5F7FA` |
| Card border | `#E2E6EC` |

## Failure behavior

- Missing column headers: error with available column list
- Empty sheet: error
- Existing deck directory: overwritten without warning

## Notes

- Cover uses `<ShowcaseCover variant="split-band">`
- Source URLs with newlines are parsed into multiple hyperlinks
- Slugs are generated from the English name column
