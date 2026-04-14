---
name: svg-diagram
description: |
  Generate professional SVG diagrams for Amaroad slides, match the current deck
  theme, save them under the deck assets directory, and insert them into MDX.
  Use for flows, architecture, comparisons, hierarchies, cycles, and concept maps.
---

# SVG Diagram

Generate SVG diagrams that match the deck theme and fit slide layouts.

## Use When

- A slide needs a diagram instead of prose
- The user asks for architecture, flow, comparison, hierarchy, or cycle visuals
- A theme-consistent vector asset should be inserted into MDX

## Workflow

1. Gather deck, slide, diagram content, and filename
2. Extract theme colors and fonts
```bash
npx tsx .codex/skills/svg-diagram/scripts/extract-theme.ts --deck <deck-name>
```
3. If placement matters, inspect the target slide layout
4. Choose a diagram type and read the matching template under `templates/`
5. Generate the SVG using the template rules and common layout constraints
6. Save to `decks/<deck>/assets/<filename>.svg`
7. Insert the asset reference into the target MDX slide

## Diagram Types

- Flowchart
- Architecture
- Process Flow
- Comparison
- Hierarchy
- Cycle
- Concept Grid

## Common Rules

- Keep text minimal and presentation-friendly
- Use orthogonal arrows only
- Use theme colors and fonts from the deck config
- Choose the `viewBox` based on the actual insertion space

## Notes

- Read only the template file that matches the requested diagram type.
- Use relative asset paths like `./assets/<filename>.svg` in MDX.
