# Brief Template

Use this template to generate `tasks/deck-brief-<deck-name>.md`.
Fill all sections from gathered Q&A responses.

---

```markdown
# Deck Brief: <title>

## Metadata
| Field | Value |
|-------|-------|
| Deck Name | `<deck-name>` |
| Title | <title> |
| Language | <ja or en> |
| Slide Count | <number> |
| Duration | <minutes> min |
| Speaker | <name / organization> |
| Copyright | <copyright text> |
| Date | <presentation date if known> |

## Purpose & Audience

### Goal
<What should the audience do/think/feel after?>

### Audience
<Who, expertise level, relationship>

### Context
<Where/when presented, event name, format>

## Content Outline

### Outline Pattern
<Pattern name: Problem->Solution / Why->What->How / Before->After->Plan / Custom>

### Key Messages
1. <message 1>
2. <message 2>
3. <message 3>

### Slide-by-Slide Plan
| # | Type | Title/Topic | Notes |
|---|------|-------------|-------|
| 01 | cover | <title> | <cover variant suggestion> |
| 02 | section | <section name> | |
| 03 | content | <topic> | <component suggestion if any> |
| ... | ... | ... | ... |
| NN | ending | Thank You | |

## Design

### Theme
- Preset: <preset name or "Custom">
- Background: <hex>
- Primary: <hex>
- Secondary: <hex>
- Text: <hex>
- Surface: <hex>
- Heading Font: <font>
- Body Font: <font>

### Layout
- Logo: <path> at <position>
- Copyright: <text> at <position>
- Page Number: <position>
- Accent Line: <yes/no, position, gradient>

### Visual Notes
<Any specific design decisions, mood, constraints>

## Scaffold Command

\`\`\`bash
npx tsx .claude/skills/deck-scaffold-from-brief/scripts/scaffold-deck.ts \
  --deck <deck-name> \
  --title "<title>" \
  --brief "<brief text>" \
  --slides <number> \
  --lang <ja|en> \
  --copyright "<copyright>"
\`\`\`

## Post-Scaffold TODO
- [ ] Fill content into generated MDX stubs
- [ ] Add images and diagrams
- [ ] Apply theme colors to deck.config.ts
- [ ] Run preflight audit
- [ ] Polish speaker notes
```
