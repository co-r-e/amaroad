<p align="center">
  <img src="public/dexcode-logo.svg" alt="DexCode" width="240" />
</p>

<p align="center">
    A slide presentation tool built with Next.js and MDX.<br>
  Author your slides from the CLI using tools like Claude Code or Codex, and view them in the browser with a PowerPoint-like sidebar layout.
</p>

> **DexCode is an AI-driven slide authoring tool.** The web UI is view-only — all slide creation and editing is done through AI coding agents.
>
> - **AI-first workflow** -- Slides are always created and modified via AI agents such as [Claude Code](https://docs.anthropic.com/en/docs/claude-code) or [Codex](https://openai.com/index/codex/). The browser is purely for previewing and presenting.
> - **Small edits, too** -- Even minor tweaks (typo fixes, color changes, reordering slides) are delegated to the AI rather than edited by hand.
> - **Voice input recommended** -- Pair with a voice input tool like [Aqua Voice](https://withaqua.com/) for a hands-free, conversational workflow. Describe what you want and let the AI handle the rest.

## Features

- **MDX slides** -- Write slides as individual `.mdx` files with full Markdown + JSX support
- **16:9 widescreen** -- Slides render at a virtual 1920x1080 resolution and scale to fit any screen
- **Multi-deck** -- Manage multiple slide decks in a single project under `decks/`
- **12 slide types** -- cover, section, content, comparison, stats, timeline, image-left, image-right, image-full, quote, agenda, ending
- **Presenter mode** -- Open a separate fullscreen window for projector output, synced in real-time via BroadcastChannel
- **Keyboard navigation** -- Arrow keys, Space, Enter, Home, End; press `?` for shortcut help
- **Slide URL sync** -- URL updates with `?slide=N` as you navigate; supports browser back/forward and direct links
- **Speaker notes** -- Resizable notes panel with basic Markdown rendering (bold, italic, code, headings, lists); touch-friendly resize handle
- **Configurable overlays** -- Logo, copyright text, page numbers, and accent lines with flexible positioning
- **Built-in components** -- Charts, icons, code blocks, tables, multi-column layouts, math equations, shapes, cards, timelines, callouts, video embeds
- **PDF / PPTX export** -- Export decks from the browser UI as PDF or PowerPoint files
- **Tunnel sharing** -- Share your deck over the internet with a single click via Cloudflare Tunnel
- **Slide transitions** -- Configurable per-slide or per-deck transitions (fade, slide, none)
- **Security headers** -- X-Content-Type-Options, X-Frame-Options, Referrer-Policy applied to all routes
- **Accessible** -- WCAG AA modal focus traps, aria-labels, focus-visible indicators
- **CLI-first workflow** -- The web UI is view-only; slides are authored and edited from the terminal
- **Hot reload** -- File changes are reflected instantly via Next.js HMR

## Requirements

- Node.js 20+
- npm

## Quick Start

```bash
git clone git@github.com:co-r-e/dexcode
cd dexcode
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the deck listing page. Click a deck to view it.

## Project Structure

```
dexcode/
├── decks/                     # Your slide decks go here
│   └── sample-deck/
│       ├── deck.config.ts     # Deck configuration (theme, logo, etc.)
│       ├── 01-cover.mdx       # Each MDX file = one slide
│       ├── 02-about.mdx
│       ├── ...
│       └── assets/            # Deck-specific images and files
├── src/
│   ├── app/                   # Next.js App Router pages
│   ├── components/            # React components
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
    src: "/dexcode-logo.svg",  // or "./assets/my-logo.svg"
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

#### CardGrid

Grid layout for cards:

```mdx
<CardGrid>
  <Card title="Feature A">Description of feature A</Card>
  <Card title="Feature B">Description of feature B</Card>
  <Card title="Feature C">Description of feature C</Card>
</CardGrid>
```

### Content

#### Card / TaggedCard

Content containers:

```mdx
<Card title="My Card">
  Card body content here.
</Card>

<TaggedCard tag="NEW" title="Tagged Card">
  Card with a colored tag label.
</TaggedCard>
```

#### Stat

Key metrics display:

```mdx
<Stat value="99.9%" label="Uptime" />
```

#### Badge

Inline labels:

```mdx
<Badge>Beta</Badge>
```

#### Callout

Highlighted information box:

```mdx
<Callout>
  Important information goes here.
</Callout>
```

#### Divider

Horizontal separator:

```mdx
<Divider />
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
  <Step title="Install">Run npm install</Step>
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

#### Video

Embedded video (YouTube, Vimeo, or local files):

```mdx
<Video src="https://www.youtube.com/embed/dQw4w9WgXcQ" />
<Video src="./assets/demo.mp4" autoPlay />
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
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## Community

- [Contributing Guide](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)

## License

- Project license: [MIT](LICENSE)
- Third-party notices: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
