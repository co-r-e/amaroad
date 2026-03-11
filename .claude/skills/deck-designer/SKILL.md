---
name: deck-designer
description: |
  Interactive deck design consultant that guides users through structured Q&A
  to plan a new DexCode slide deck before building it. Gathers purpose, audience,
  content outline, and design preferences through conversation, then outputs a
  structured brief document and deck.config.ts parameters.
  Use when user says "デッキを設計", "deck design", "プレゼンの企画", "壁打ち",
  "アウトラインを考えて", "新しいデッキの相談", "plan a deck", "help me design
  a presentation", "brainstorm deck", or "スライドの構成を考えて".
  Key capabilities: phased Q&A workflow, design preset selection, outline
  pattern matching, brief document generation for deck-scaffold-from-brief.
---

# Deck Designer

Interactive Q&A workflow to design a DexCode slide deck before building it.
Output: a structured brief markdown file (`tasks/deck-brief-<name>.md`) that
feeds directly into the `deck-scaffold-from-brief` skill.

## Workflow

Run phases sequentially. Ask 2-3 questions per message (never more). Summarize
gathered information at the end of each phase before moving to the next.

### Phase 1: Purpose & Audience

Gather the "why" and "who" first. See `references/question-bank.md` Phase 1 for
the full question set. At minimum, determine:

- **Goal**: What should the audience do/think/feel after the presentation?
- **Audience**: Who are they? What do they already know?
- **Context**: Where/when will it be presented? (conference, internal, client pitch, etc.)
- **Duration**: How long is the talk? (determines slide count)
- **Language**: Japanese or English?

### Phase 2: Content & Structure

Build the outline. See `references/question-bank.md` Phase 2.

1. Ask for the key messages (3-5 main points).
2. Suggest an outline pattern that fits the content:
   - **Problem -> Solution**: for pitches and proposals
   - **Why -> What -> How**: for strategy and vision
   - **Before -> After -> Plan**: for transformation stories
3. Draft a slide-by-slide outline with types (cover, section, content, ending).
4. Confirm with user and iterate.

### Phase 3: Design & Theme

Determine visual direction. See `references/design-presets.md` for preset options.

1. Ask about brand constraints (company colors, logo, existing guidelines).
2. If no brand constraints, present 3 preset options from `references/design-presets.md`
   that match the deck's mood:
   - Show name, color palette, and font pairing
   - Ask user to pick one or describe custom preferences
3. Confirm: logo placement, copyright text, accent line preference.

### Phase 4: Output Brief

Generate the brief document and present a summary.

1. Write `tasks/deck-brief-<deck-name>.md` using the template in
   `references/brief-template.md`.
2. Present a summary table to the user:
   - Deck name, title, language, slide count
   - Outline pattern, theme preset
   - Key design decisions
3. Ask: "Ready to scaffold? I can run `deck-scaffold-from-brief` with this brief."
4. If yes, invoke the scaffold skill with the gathered parameters.

## Conversation Style

- Ask in the user's language (detect from first message).
- Keep questions concrete — offer choices when possible ("A or B?" > "What do you think?").
- If the user gives vague answers, propose a sensible default and ask to confirm.
- Share your reasoning when suggesting outline patterns or design choices.
- Never ask more than 3 questions in one message.

## Slide Count Estimation

| Talk Duration | Slide Count |
|---------------|-------------|
| 5 min (LT)    | 6-8         |
| 10 min        | 8-12        |
| 15 min        | 12-16       |
| 20 min        | 16-20       |
| 30 min        | 20-28       |
| 45 min        | 28-36       |
| 60 min        | 36-48       |

Rule of thumb: 1.5-2 slides per minute for technical content, 1 slide per minute
for discussion-heavy content.

## Integration with Other Skills

After the brief is finalized:
- **deck-scaffold-from-brief**: Generate the deck structure
- **speaker-notes-polisher**: Fill speaker notes after content is written
- **slide-preflight-auditor**: Validate before export
- **nanobanana-image**: Generate images for slides
- **svg-diagram**: Create diagrams
