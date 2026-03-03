# Localization Rules

## Translate

- Headings and body prose
- Bullet points and explanatory text
- Frontmatter `notes` content

## Do Not Translate

- MDX/JSX syntax and component names (`<Columns>`, `<CardGrid>`, etc.)
- Prop keys and values that are structural (`type`, `verticalAlign`, `transition`)
- Code blocks and inline code
- URLs, asset paths (`./assets/...`), CSS vars (`var(--slide-*)`)

## Style Targets

English target:
- Clear, concise presenter tone
- Keep line length moderate for slide readability

Japanese target:
- Natural business presentation tone
- Keep concise phrasing; avoid excessive honorifics

## QA Checklist After Localization

- No MDX parse errors
- No overflow due to text expansion
- Notes still match slide intent
- Citations and source links remain intact
