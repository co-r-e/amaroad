# DexCode — Project CLAUDE.md

## MDX Slide Authoring Rules

```yaml
slide_layout:
  inviolable_area:
    definition: >
      The content area inside the slide frame, bounded by padding on all sides.
      Overlay elements (logo, copyright, page number) float above this area via absolute positioning.
      All MDX content is rendered exclusively within this area.
    padding_by_type:
      content: "80px top, 72px left/right, 64px bottom"
      cover: "96px top, 96px left/right, 80px bottom"
      ending: "96px top, 96px left/right, 80px bottom"
      section: "96px top, 96px left/right, 80px bottom"
      quote: "120px top, 140px left/right, 100px bottom"
      image-full: "0 (no padding)"
    structure: |
      SlideFrame (relative, overflow-hidden)
        ├── SlideOverlay (absolute inset-0, z-10, pointer-events-none)
        │   ├── Logo
        │   ├── Copyright
        │   └── Page number
        └── Content container (flex-col, padding applied)
            └── SlideContent (flex-1, min-h-0)
                └── [data-mdx-status] (flex h-full flex-col)
                    └── MDX content (headings, paragraphs, charts, etc.)
    rules:
      - Never modify SlideFrame padding values; they are already calibrated.
      - All content must fit within the inviolable area. No negative margins to break out (except cover type).
      - Elements with data-growable expand via flex:1 to fill remaining vertical space.

no_tailwind_in_slides:
  rule: Never use Tailwind CSS utility classes (e.g., className="flex items-center") inside MDX slide files or slide components (/src/components/mdx/).
  reason: The slide presentation engine has been migrated to a strict CSS Modules + Native CSS Variables architecture to ensure scalable, themeable, 16:9 responsive presentations. Tailwind utility classes break this encapsulation and interfere with dynamic theme variables.
  use_instead: CSS Modules (*.module.css) for components, and inline styles with CSS variables (e.g., style={{ color: "var(--slide-primary)", display: "flex", alignItems: "center" }}) inside MDX/JSX when one-off styling is needed.
  scope: Only applies to slide contents and `src/components/mdx`. Non-slide application UI (like the deck listing page in `src/app/page.tsx`) still uses Tailwind.

no_markdown_lists_in_jsx:
  rule: Never use Markdown list syntax (- or 1.) inside JSX components
  reason: Causes MDX parse errors inside <Column>, <Card>, <Center>, <div>, etc.
  use_instead: <ul><li> HTML tags
  scope: Markdown list syntax is only allowed at the top level (not wrapped in JSX)
  example_bad: |
    <Column width="50%">
    - Item 1
    - Item 2
    </Column>
  example_good: |
    <Column width="50%">
    <ul>
      <li>Item 1</li>
      <li>Item 2</li>
    </ul>
    </Column>

prefer_p_over_ul_li:
  rule: Use <p> with middle dots (・) instead of JSX <ul><li>
  reason: JSX <ul><li> bypasses slide component font sizing and renders at browser default (small)
  example_good: |
    <p style={{ fontSize: "2.2rem", color: "var(--slide-text-muted)" }}>
      ・Item 1<br/>・Item 2
    </p>

multi_line_text_spacing:
  rule: >
    Avoid using <br/> inside large headings or emphasized text blocks when precise vertical spacing matters.
    For multi-line headings, stack separate inline elements with display:block instead.
  reason: >
    In large Japanese text, <br/> keeps the text inside one paragraph line box, so line-height can make it look
    like there is a blank line. Default paragraph margins can also create unexpected extra spacing.
  use_instead:
    - Use `<span style={{ display: "block" }}>...</span>` for each line in a heading or emphasized phrase
    - Set `margin: 0` explicitly on raw `<p>` / `<div>` blocks used inside slides
    - Tune `line-height` deliberately for 2-line headings; start around `1.1` to `1.25`
  example_bad: |
    <p style={{ fontSize: "2.4rem", fontWeight: 800, lineHeight: 1.4 }}>
      Claude Code を<br/>
      非エンジニアでも使えるようにするツール
    </p>
  example_good: |
    <div style={{ fontSize: "2.4rem", fontWeight: 800, lineHeight: 1.2 }}>
      <span style={{ display: "block" }}>Claude Code を</span>
      <span style={{ display: "block" }}>非エンジニアでも使えるようにするツール</span>
    </div>

minimum_font_size:
  rule: All text on slides must be 1.8rem or larger
  reason: Smaller sizes (1.5-1.7rem) are hard to read when projected
  exception: Dates, badges, and other auxiliary text

flex_overflow_prevention:
  rule: >
    When placing images, screenshots, SVGs, charts, or other intrinsic-sized elements
    inside a flex container (especially with data-growable), always add overflow: "hidden"
    and minHeight: 0 to the wrapper div.
  reason: >
    Elements like <img> expand to their natural dimensions and can overflow the
    inviolable area. flex: 1 alone does not prevent this; the container needs
    explicit overflow clipping and min-height reset to allow shrinking.
  example_good: |
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0, overflow: "hidden" }}>
      ![Screenshot](./assets/screenshot.png)
    </div>
  example_bad: |
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      ![Screenshot](./assets/screenshot.png)
    </div>

content_area_space_usage:
  rule: Minimize whitespace inside the content area; pack content tightly
  details:
    - Visual elements (charts, graphs, images, diagrams) must be displayed as large as possible.
      They are the focal point of the slide and should use all remaining space.
    - Block element margins use --slide-space-sm (16px) as the baseline. No wasted whitespace.
    - Expandable elements (code blocks, tables, charts, images) use the data-growable attribute
      to automatically fill remaining space.
    - Exception: when content is genuinely sparse (e.g., a single line of text), whitespace is acceptable.

accent_color:
  rule: Use at most one accent color per slide
  details:
    - The primary color (--slide-primary) is the base. Only one additional accent color is allowed.
    - Multiple accent colors compete for attention and weaken visual hierarchy.
    - Use color intensity (opacity, lighter/darker shades of the same hue) for variation instead.

no_side_accent_borders:
  rule: Never add a thick colored border on one side of a box
  reason: >
    One-sided accent borders (e.g., border-left: 4px solid <color>) are an overused
    AI-generated design cliché. They add visual noise without conveying information.
  use_instead:
    - Full uniform border (border: 1px solid) for outlined containers
    - Background color for emphasis
    - No border at all for clean, minimal boxes
  exception: Timeline vertical lines where the line represents a chronological axis

card_border_defaults:
  rule: Card-like containers should be borderless by default
  reason: >
    A generic 1px outline on every card adds visual noise and makes layouts feel busy.
    Most cards should separate themselves by surface color, spacing, and radius instead.
  use_border_when:
    - The border conveys a state such as selected, highlighted, recommended, before/after, or warning
    - The component explicitly exposes an outlined/bordered variant
    - A comparison needs a stronger edge than background fill alone
  default: >
    Surface background + radius, no outer border.

icon_usage:
  rule: Only use icons when they accurately convey meaning. Never use icons "just because."
  allowed:
    - Checklist completion/incomplete states (circle-check, circle)
    - Before/After good/bad indicators (check-circle, x-circle)
    - Platform links like GitHub/Docs (github, book-open)
    - Process representation inside flow diagram steps
    - Avatar placeholders (user)
    - Card heading icons that visually categorize or distinguish each card's topic
  prohibited:
    - Decorative icons next to standalone headings (non-card context)
    - Atmosphere-setting icons on cover slides
    - Circle-background + icon combos for section dividers
  test: "If removing the icon loses no information, the icon is unnecessary."
  note: >
    Card layouts are an exception — icons as card headings help users quickly
    scan and differentiate multiple cards at a glance, even if the text alone
    conveys the meaning.

visual_first:
  rule: Proactively use diagrams, graphs, and charts wherever visual explanation is clearer than text
  details:
    - When content involves processes, comparisons, data, architecture, relationships, or flows,
      prefer a visual (SVG diagram, chart, graph) over bullet points or paragraphs.
    - Use the svg-diagram skill for flowcharts, architecture diagrams, and process flows.
    - Use chart components (bar, pie, line, etc.) for quantitative data.
    - Visuals should be the primary content; supporting text is secondary.
  test: "Could this content be understood faster as a diagram or chart? If yes, visualize it."

css_variable_override_pattern:
  rule: >
    Shared MDX components use CSS custom properties with fallbacks for layout values
    that may need per-deck or per-instance customization.
  naming: "--{component}-{variant}-{property}"
  examples:
    - "--figure-side-columns"       # FigureShowcase, side variant, grid-template-columns
    - "--figure-imagetext-gap"      # FigureShowcase, image-text variant, gap
    - "--logo-columns"              # LogoWall, columns count
  implementation:
    - CSS: Use `var(--name, fallback)` so existing decks are unaffected.
    - TSX: Accept `style?: React.CSSProperties` prop, spread on root element.
    - MDX override: `<Component style={{ "--figure-imagetext-columns": "40% 1fr" }} />`
  scope: Layout structure (grid ratios, align, gap) and fixed sizes. Typography stays hardcoded until needed.

no_em_dash:
  rule: Never use em dashes (—) in slide text or titles
  reason: Em dashes look unnatural in Japanese presentation context
  use_instead: Hyphen (-), full-width hyphen (ー), or rephrase without a dash
  scope: All MDX slide files and speaker notes
```
