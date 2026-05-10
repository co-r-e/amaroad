<p align="center">
  <img src="public/amaroad-logo.svg" alt="Amaroad" width="240" />
</p>

<p align="center">
    A slide presentation tool built with Next.js and MDX.<br>
  Author your slides from the CLI using tools like Claude Code or Codex, and view them in the browser with a PowerPoint-like sidebar layout.
</p>

> **Renamed from DexCode to Amaroad** — this project was previously published as **DexCode** (`co-r-e/dexcode`) and was renamed to **Amaroad** (`co-r-e/amaroad`) in April 2026. GitHub preserves the redirect for old URLs, but please update bookmarks and local clones:
> ```bash
> git remote set-url origin git@github.com:co-r-e/amaroad.git
> ```
> All DexCode references inside this codebase (package name, logo, CSS variables, internal event/storage keys, type names, log prefixes) have been updated. The MDX authoring experience is unchanged.

> **Amaroad is an AI-driven slide authoring tool.** The web UI is view-only — all slide creation and editing is done through AI coding agents.
>
> - **AI-first workflow** -- Slides are always created and modified via AI agents such as [Claude Code](https://docs.anthropic.com/en/docs/claude-code) or [Codex](https://openai.com/index/codex/). The browser is purely for previewing and presenting.
> - **Small edits, too** -- Even minor tweaks (typo fixes, color changes, reordering slides) are delegated to the AI rather than edited by hand.
> - **Voice input recommended** -- Pair with a voice input tool like [Aqua Voice](https://withaqua.com/) for a hands-free, conversational workflow. Describe what you want and let the AI handle the rest.

## Features

- **MDX slides** -- Write slides as individual `.mdx` files with full Markdown + JSX support
- **16:9 widescreen** -- Slides render at a virtual 1920x1080 resolution and scale to fit any screen
- **Multi-deck** -- Manage multiple slide decks in a single project under `decks/`
- **12 slide types** -- cover, section, content, comparison, stats, timeline, image-left, image-right, image-full, quote, agenda, ending; plus 25+ showcase components for ready-made layouts
- **Presenter mode** -- Open a separate fullscreen window for projector output, synced in real-time via BroadcastChannel
- **Keyboard navigation** -- Arrow keys, Space, Enter, Home, End; press `?` for shortcut help
- **Slide URL sync** -- URL updates with `?slide=N` as you navigate; supports browser back/forward and direct links
- **Speaker notes** -- Resizable notes panel with basic Markdown rendering (bold, italic, code, headings, lists); touch-friendly resize handle
- **Configurable overlays** -- Logo, copyright text, page numbers, and accent lines with flexible positioning
- **Built-in components** -- Charts, icons, code blocks, tables, multi-column layouts, math equations, shapes, cards, timelines, steps, and 25+ showcase components for covers, dashboards, comparisons, team grids, and more
- **PDF / PPTX export** -- Export decks from the browser UI as PDF or PowerPoint files
- **Tunnel sharing** -- Share your deck over the internet with a single click via Cloudflare Tunnel
- **Slide transitions** -- Configurable per-slide or per-deck transitions (fade, slide, none)
- **Security headers** -- X-Content-Type-Options, X-Frame-Options, Referrer-Policy applied to all routes
- **Accessible** -- WCAG AA modal focus traps, aria-labels, focus-visible indicators
- **CLI-first workflow** -- The web UI is view-only; slides are authored and edited from the terminal
- **Hot reload** -- File changes are reflected instantly via Next.js HMR

## Requirements

- Node.js 20+
- pnpm 10+

## Quick Start

```bash
git clone git@github.com:co-r-e/amaroad.git
cd amaroad
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the deck listing page. Click a deck to view it.

## Project Structure

```
amaroad/
├── .codex/
│   └── skills/                # Project skills for Codex
├── .claude/
│   └── skills/                # Project skills for Claude Code
├── decks/                     # Your slide decks go here
│   └── sample-deck/
│       ├── deck.config.ts     # Deck configuration (theme, logo, etc.)
│       ├── 01-a-cover.mdx     # Each MDX file = one slide
│       ├── 02-about.mdx
│       ├── ...
│       └── assets/            # Deck-specific images and files
├── src/
│   ├── app/                   # Next.js App Router pages
│   ├── components/
│   │   └── mdx/               # Slide components (25+ showcase components)
│   ├── contexts/              # React context providers
│   ├── hooks/                 # Custom React hooks
│   ├── lib/                   # Core utilities and loaders
│   └── types/                 # TypeScript type definitions
├── public/                    # Shared static assets
├── package.json
├── next.config.ts
└── LICENSE
```

## Creating a Deck

> **Tip:** Before building slides, run the `deck-designer` skill to plan your deck interactively. It walks you through purpose, audience, outline, and design preferences, then outputs a structured brief you can feed directly into `deck-scaffold-from-brief`. Example: `デッキを設計したい。対象は新規顧客、20分の提案。`

### 1. Create a directory

Create a new directory under `decks/` with your deck name:

```bash
mkdir decks/my-presentation
```

### 2. Add a deck config

Create `decks/my-presentation/deck.config.ts`:

```typescript
import { defineConfig } from "../../src/lib/deck-config";

export default defineConfig({
  title: "My Presentation",
  logo: {
    src: "/amaroad-logo.svg",  // or "./assets/my-logo.svg"
    position: "top-right",   // top-left | top-center | top-right | bottom-left | bottom-center | bottom-right
  },
  copyright: {
    text: "© 2026 My Company",
    position: "bottom-left", // bottom-left | bottom-center | bottom-right
  },
  pageNumber: {
    position: "bottom-right", // bottom-left | bottom-center | bottom-right
    startFrom: 1,             // starting page number (default: 1)
    hideOnCover: true,        // hide page number on cover slides (default: true)
  },
  theme: {
    colors: {
      primary: "#02001A",     // required -- headings, links, accents
      secondary: "#4A90D9",   // optional
      accent: "#FF6B35",      // optional
      background: "#FFFFFF",  // optional (default: #FFFFFF)
      text: "#1a1a1a",        // optional (default: #1a1a1a)
      textMuted: "#6b7280",   // optional -- subdued text
      surface: "#f9fafb",     // optional -- card/box backgrounds
    },
    fonts: {
      heading: "Inter, sans-serif",
      body: "Noto Sans JP, sans-serif",
      mono: "Fira Code, monospace", // optional -- code blocks
      scale: 1.08,                  // optional -- enlarge/reduce slide typography globally
    },
    spacing: {
      scale: 0.96,                  // optional -- tighten/loosen layout spacing globally
    },
  },
  accentLine: {               // optional -- decorative side line
    position: "left",         // left | right
    width: 6,                 // pixels (default: 6)
    gradient: "linear-gradient(to bottom, #02001A, #4A90D9)", // optional
  },
  transition: "fade",         // optional -- default transition for all slides (fade | slide | none)
});
```

### 3. Add slides

Create numbered `.mdx` files. Each file is one slide. Files are ordered by filename (numeric sorting).

```
decks/my-presentation/
├── deck.config.ts
├── 01-cover.mdx
├── 02-agenda.mdx
├── 03-introduction.mdx
├── 04-details.mdx
└── 05-thank-you.mdx
```

### 4. Write slide content

Each `.mdx` file has YAML frontmatter and MDX body:

```mdx
---
type: cover
notes: |
  Speaker notes go here.
  They are visible in development but not shown on the slide.
---

# Welcome to My Talk

A subtitle or description goes here
```

#### Frontmatter fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | `SlideType` | `"content"` | Slide type (see below) |
| `transition` | `"fade"` \| `"slide"` \| `"none"` | -- | Override deck-level transition |
| `verticalAlign` | `"top"` \| `"center"` | `"top"` | Vertical alignment of content |
| `notes` | `string` | -- | Speaker notes (multi-line YAML) |
| `background` | `string` | -- | Override slide background color |

#### Slide types

- **`cover`** -- Title slides. Page number is hidden by default.
- **`section`** -- Section divider slides.
- **`content`** -- Standard content slides (default).
- **`comparison`** -- Side-by-side comparison layout.
- **`stats`** -- Key metrics / statistics display.
- **`timeline`** -- Chronological event layout.
- **`image-left`** -- Image on the left, text on the right.
- **`image-right`** -- Image on the right, text on the left.
- **`image-full`** -- Full-bleed image (no padding).
- **`quote`** -- Blockquote-focused layout with extra padding.
- **`agenda`** -- Agenda / table of contents layout.
- **`ending`** -- Closing / thank-you slides.

## Recommended Workflow

Building a great deck with Amaroad is a conversation with AI. Here is the workflow we recommend:

### Step 1: Establish the deck's visual identity

Start by creating about 4 slides (cover, section, content, ending) and iterate on them with the AI. Focus on typography, colors, spacing, and layout patterns rather than final content. This small set becomes your design reference.

### Step 2: Lock the design rules into a deck-level CLAUDE.md

Once you are happy with the look and feel, tell the AI to extract the design decisions into a `CLAUDE.md` file inside the deck directory (e.g., `decks/my-deck/CLAUDE.md`). This file acts as a persistent style guide that the AI follows for every subsequent slide.

### Step 3: Build a shared image foundation with nanobanana

Use the `nanobanana-image` skill to generate a hero image or key visual that sets the tone for the entire deck. Record the prompt, style keywords, and color palette in the same deck-level `CLAUDE.md` so every future image stays visually consistent.

### Step 4: Iterate slide-by-slide through conversation

For each new slide:

1. **Ask the AI first** -- "I want to add a slide about X. What do you plan to create?"
2. **Review the proposal** -- The AI will describe the layout, components, and content it intends to use.
3. **Refine through discussion** -- Push back, adjust, or approve. This back-and-forth is where the quality comes from.
4. **Generate the slide** -- Once aligned, let the AI write the MDX.

Repeat this cycle. Because the design rules and image style are already locked in, each new slide is consistent with the rest of the deck automatically.

### The result

Hundreds -- even thousands -- of slides can be produced in a matter of hours. A presentation you need for tomorrow can realistically be completed in a single day.

### Not using Claude Code?

This workflow works with any AI coding agent. If you are using a different agent (e.g., Codex, Cursor, Windsurf), place the same instructions in an `AGENTS.md` file instead of `CLAUDE.md`. The principle is identical: give the AI persistent, deck-scoped rules so it stays on-brand across every slide.

## Built-in MDX Components

All standard Markdown elements are styled for slide presentation (large fonts optimized for projection).

### Layout

#### Columns

Side-by-side layout:

```mdx
<Columns>
  <Column>

  ## Left side

  Content here.

  </Column>
  <Column>

  ## Right side

  Content here.

  </Column>
</Columns>
```

Optional props:
- `<Columns gap="3rem">` -- Column gap (default: `"2rem"`)
- `<Column width="40%">` -- Fixed column width

#### Center

Center content horizontally and vertically:

```mdx
<Center>

# Centered heading

</Center>
```

### Content

#### Card

Content container:

```mdx
<Card title="My Card">
  Card body content here.
</Card>
```

#### Timeline / TimelineItem

Chronological events:

```mdx
<Timeline>
  <TimelineItem title="2024" description="Project started" />
  <TimelineItem title="2025" description="v1.0 released" />
</Timeline>
```

#### Steps / Step

Numbered process steps:

```mdx
<Steps>
  <Step title="Install">Run pnpm install</Step>
  <Step title="Configure">Edit deck.config.ts</Step>
  <Step title="Create">Write MDX slides</Step>
</Steps>
```

### Data & Media

#### Chart

Data visualization using Recharts:

```mdx
<Chart
  type="bar"
  data={[
    { name: "Q1", value: 400 },
    { name: "Q2", value: 300 },
    { name: "Q3", value: 500 },
  ]}
  xKey="name"
  yKey="value"
  height={350}
/>
```

Supported types: `bar`, `line`, `area`, `pie`

Optional props:
- `colors={["#02001A", "#4A90D9"]}` -- Custom color palette
- `height={400}` -- Chart height in pixels (default: `400`)

#### Icon

Lucide icons:

```mdx
<Icon name="rocket" size={48} />
<Icon name="code" size={32} color="#4A90D9" />
```

See all available icons at [lucide.dev/icons](https://lucide.dev/icons). Use kebab-case names (e.g., `file-text`, `arrow-right`).

#### Shape

SVG shapes:

```mdx
<Shape type="circle" size={100} fill="#4A90D9" />
<Shape type="rectangle" size={80} />
<Shape type="triangle" size={60} />
<Shape type="arrow" size={120} />
<Shape type="line" size={200} strokeWidth={3} />
```

### Math

LaTeX math equations via KaTeX:

```mdx
Inline: $E = mc^2$

Block:

$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$
```

### Code blocks

Syntax-highlighted code:

````mdx
```typescript
function hello(name: string): string {
  return `Hello, ${name}!`;
}
```
````

### Tables

Standard Markdown tables with styled headers:

```mdx
| Feature | Status |
|---------|--------|
| MDX     | Done   |
| Themes  | Done   |
```

## Showcase Components

Amaroad includes 25+ pre-built showcase components -- full-slide layout templates that handle positioning, spacing, and responsive design. Use these instead of building layouts from scratch.

### Covers & Sections

- **ShowcaseCover** -- Title slides with variants: `split-band`, `image-right`, `typography`, `minimal`, `creative`, `artistic`
- **ShowcaseSection** -- Section dividers with variants: `left`, `number`, `dark`, `split`, `minimal`, `centered`
- **ShowcaseEndSlide** -- Closing slides with variants: `dark-keywords`, `cta`, `hero`, `section-icons`, `contact`, `thank-you`

```mdx
<ShowcaseCover variant="split-band" title="Product Launch 2026" subtitle="Next-generation platform" />

<ShowcaseEndSlide variant="contact" name="Jane Doe" email="jane@example.com" />
```

### Content Layouts

- **FigureShowcase** -- 15 image layout variants for photos and diagrams
- **ShowcaseSplit** -- Split layouts with variants: `speaker`, `dark-light`, `spotlight`, `data-narrative`
- **ShowcaseColumnText** -- Multi-column text (2 or 3 columns)

```mdx
<FigureShowcase variant="image-right" src="./assets/photo.jpg" title="Architecture" description="System overview" />

<ShowcaseColumnText columns={3} items={[
  { title: "Speed", body: "Sub-second responses" },
  { title: "Scale", body: "Millions of users" },
  { title: "Safety", body: "Enterprise-grade security" },
]} />
```

### Data & Metrics

- **ShowcaseFeatureGrid** -- Feature grids with variants: `cards`, `bordered`, `dark`, `horizontal`
- **ShowcaseMetric** -- Big number display
- **ShowcaseStatGrid** -- Stat grid with multiple metrics
- **ShowcaseDashboard** -- KPI cards combined with charts
- **ShowcaseComparisonTable** -- Feature comparison matrix
- **ShowcaseMatrix** -- Priority/risk matrices

```mdx
<ShowcaseMetric value="4.2M" label="Monthly Active Users" delta="+23%" />

<ShowcaseDashboard kpis={[{ label: "Revenue", value: "$1.2M" }]} chart={{ type: "bar", data: [...] }} />
```

### Lists & Process

- **ShowcaseAgenda** -- Agenda layouts with variants: `list`, `grid`, `highlight`, `grid-3day`
- **ShowcaseComparison** -- Comparison layouts with variants: `checklist`, `before-after`, `do-dont`, `pros-cons`
- **ShowcasePricing** -- Pricing tier comparison

```mdx
<ShowcaseComparison variant="do-dont" doItems={["Use CSS variables", "Keep slides concise"]} dontItems={["Hardcode colors", "Overload with text"]} />
```

### Media & Visual

- **ShowcaseVideo** -- Video embeds with variants: `standalone`, `with-description`
- **ShowcaseFAQ** -- Q&A pair layouts
- **ShowcaseQuote** -- Testimonial cards
- **ShowcaseTeamGrid** -- Team member grids with variants: `square`, `circle`
- **ShowcaseLayerStack** -- Technology stack layer diagrams
- **ShowcaseDiagram** -- SVG diagram wrapper
- **ShowcaseIconGrid** -- Icon showcase grid
- **ShowcaseShapeGrid** -- Shape showcase grid
- **LogoWall** -- Logo grid display
- **KpiStrip** -- Horizontal KPI strip
- **ScreenshotCallouts** -- Screenshot with annotated callouts

```mdx
<ShowcaseQuote quote="Amaroad changed how we build presentations." author="Jane Doe" role="CTO, Acme Inc." />

<ShowcaseTeamGrid variant="circle" members={[{ name: "Alice", role: "Engineer", image: "./assets/alice.jpg" }]} />
```

## Deck Assets

Place images and other files in an `assets/` directory inside your deck:

```
decks/my-presentation/
├── deck.config.ts
├── 01-cover.mdx
└── assets/
    ├── logo.svg
    └── photo.jpg
```

Reference them in MDX with relative paths:

```mdx
![Photo](./assets/photo.jpg)
```

Or in JSX attributes:

```mdx
<img src="./assets/photo.jpg" alt="Photo" />
```

Assets are served via the API route at `/api/decks/{deck-name}/assets/{filename}`. Only image, video, font, and PDF files are served; source code files are blocked.

## Routing

| URL | Description |
|-----|-------------|
| `/` | Deck listing page |
| `/{deck-name}` | Slide viewer for a specific deck |
| `/{deck-name}?slide=N` | Jump directly to slide N (1-based) |
| `/{deck-name}/presenter` | Presenter mode (fullscreen projection) |

## Keyboard Shortcuts

These shortcuts work in both the slide viewer and presenter mode:

| Key | Action |
|-----|--------|
| `→` `↓` `Space` `Enter` | Next slide |
| `←` `↑` | Previous slide |
| `Home` | First slide |
| `End` | Last slide |
| `f` | Toggle fullscreen (presenter mode) |
| `Escape` | Exit fullscreen (presenter mode) |
| `?` | Show keyboard shortcuts help |

## Presenter Mode

Click the "Presenter Mode" button in the sidebar to open a separate fullscreen window. This window shows only the current slide, designed for projector output.

- The presenter window and main viewer stay synchronized via BroadcastChannel
- Navigate from either window -- both update in real-time
- Press `f` to toggle fullscreen; press `Escape` to exit

## Export

Export decks to PDF or PPTX directly from the browser. Click the export button on the deck listing page and choose your format. Each slide is captured as an image and assembled into the output file.

- **PDF** -- Landscape 1920x1080, one slide per page
- **PPTX** -- Widescreen layout, one slide per page

## Tunnel Sharing

Share your deck over the internet via Cloudflare Tunnel. Click the "Share" button in the sidebar to start a tunnel. A public URL is generated and copied to your clipboard.

- Only available when running on localhost
- The tunnel stays active across page reloads
- Click again to stop the tunnel

## Custom Components

You can add your own React components for use in MDX. Edit `src/components/mdx/index.tsx` to register them:

```typescript
import { MyComponent } from "./MyComponent";

export const slideComponents: MDXComponents = {
  // ... existing components
  MyComponent,
};
```

Then use in any MDX file:

```mdx
<MyComponent prop="value" />
```

## AI Skills

Amaroad includes 15 project skills under `.codex/skills/` for Codex. Most of them are also mirrored under `.claude/skills/` for Claude Code. These skills are designed to be triggered from normal CLI chat requests, so users do not need to run the skill files manually.

### How users should ask

- Mention the skill name explicitly when you want deterministic behavior, for example: `Use deck-scaffold-from-brief with tasks/deck-brief-launch.md and create an 8-slide Japanese deck.`
- Natural language also works. If the request clearly matches a skill, the agent can choose it automatically.
- Put the important constraints in the same message: target deck path, source files, language, slide count, dry-run vs write mode, logo path, and whether overwriting is allowed.
- Chain skills when the task spans multiple stages. A common flow is `deck-designer` -> `deck-scaffold-from-brief` -> `nanobanana-image` / `svg-diagram` -> `speaker-notes-polisher` -> `slide-preflight-auditor`.

### Recommended prompt patterns

| Skill | Best used for | Example user prompt |
|-------|---------------|---------------------|
| `deck-designer` | Planning a deck before writing slides | `デッキを設計したい。対象は新規顧客、20分の提案、まず構成を壁打ちして。` |
| `deck-scaffold-from-brief` | Generating a full deck from a brief | `tasks/deck-brief-ai-launch.md から deck-scaffold-from-brief でデッキを作って。日本語、10枚構成。` |
| `excel-to-slides` | Turning a spreadsheet into a deck | `Excelからスライド化して。data/attack-catalog.xlsx を decks/attack-catalog に変換して。` |
| `deck-localizer` | Translating a deck between Japanese and English | `decks/sample-deck を英語化して。MDX 構造は保って、notes は日本語のまま。` |
| `nanobanana-image` | Creating a new illustration or hero image | `05-market-landscape.mdx 用に、青基調の hero image を作って assets に保存し、MDX に差し込んで。` |
| `nanobanana-image-edit` | Revising an existing image asset | `decks/sample-deck/assets/hero.png の背景だけ差し替えて。人物はそのまま、全体を暖色寄りに。` |
| `svg-diagram` | Creating architecture, flow, or comparison diagrams | `03-architecture.mdx に入れる SVG 図を作って。現在の deck theme に合わせた構成図にして。` |
| `graphic-recording` | Creating a hand-drawn visual summary slide | `このセクションをグラレコ風の1枚絵にして、該当スライドへ挿入して。` |
| `speaker-notes-polisher` | Rewriting speaker notes into a standard format | `sample-deck の notes を整えて。Purpose / Talking Points / Estimated Time 形式で。` |
| `slide-overflow-fixer` | Fixing clipped or overcrowded slides | `decks/sample-deck で overflow しているスライドを safe zone 内に収めて。見出しデザインは変えないで。` |
| `slide-preflight-auditor` | Auditing a deck before review or export | `export 前に decks/sample-deck を preflight audit して。行番号つきで問題点を出して。` |
| `fact-citation-validator` | Checking citations for numeric or factual claims | `sample-deck の数値・事実主張を検証して、出典不足の行を洗い出して。` |
| `theme-normalizer` | Replacing hard-coded colors with theme variables | `sample-deck の hard-coded HEX を theme variables に寄せて。まず dry-run で確認したい。` |
| `remotion-video` | Converting a deck into a video project | `decks/product-keynote を Remotion video 化して。デッキの見た目と流れは維持して。` |
| `remotion-best-practices` | Reviewing or improving Remotion implementation details | `この Remotion composition を見て、animation と caption の実装改善点を出して。` |

### Good request checklist

- State the target deck or file paths explicitly.
- Say whether you want planning only, dry-run only, or actual file changes.
- Include language and audience when the output is presentation content.
- Mention brand constraints early: logo, colors, fonts, copyright text.
- If the work should happen in sequence, say so directly: `First design the deck, then scaffold it, then audit it.`

## Tech Stack

- [Next.js 16](https://nextjs.org/) -- React 19 framework with App Router and Turbopack
- [TypeScript](https://www.typescriptlang.org/) -- Type safety
- Native CSS Variables & CSS Modules -- Strict encapsulation for slide styling
- [Tailwind CSS 4](https://tailwindcss.com/) -- Dashboard and app UI styling
- [MDX](https://mdxjs.com/) -- Markdown + JSX for slide content
- [Recharts](https://recharts.org/) -- Charts and data visualization
- [Lucide](https://lucide.dev/) -- Icon library
- [KaTeX](https://katex.org/) -- Math equation rendering
- [html-to-image](https://github.com/bubkoo/html-to-image) -- Slide capture for export
- [jsPDF](https://github.com/parallax/jsPDF) -- PDF generation
- [pptxgenjs](https://github.com/gitbrent/PptxGenJS) -- PPTX generation
- [cloudflared](https://github.com/nicksrandall/cloudflared) -- Cloudflare Tunnel for sharing
- [gray-matter](https://github.com/jonschlinkert/gray-matter) -- YAML frontmatter parsing
- [jiti](https://github.com/unjs/jiti) -- Runtime TypeScript config loading

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server with hot reload |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |

## Community

- [Contributing Guide](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)

## License

- Project license: [MIT](LICENSE)
- Third-party notices: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
