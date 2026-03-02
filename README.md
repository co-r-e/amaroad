# nipry

A slide presentation tool built with Next.js and MDX. Author your slides from the CLI using tools like Claude Code or Codex, and view them in the browser with a PowerPoint-like sidebar layout.

> **nipry is an AI-driven slide authoring tool.** The web UI is view-only — all slide creation and editing is done through AI coding agents.
>
> - **AI-first workflow** -- Slides are always created and modified via AI agents such as [Claude Code](https://docs.anthropic.com/en/docs/claude-code) or [Codex](https://openai.com/index/codex/). The browser is purely for previewing and presenting.
> - **Small edits, too** -- Even minor tweaks (typo fixes, color changes, reordering slides) are delegated to the AI rather than edited by hand.
> - **Voice input recommended** -- Pair with a voice input tool like [Aqua Voice](https://withaqua.com/) for a hands-free, conversational workflow. Describe what you want and let the AI handle the rest.

## Features

- **MDX slides** -- Write slides as individual `.mdx` files with full Markdown + JSX support
- **16:9 widescreen** -- Slides render at a virtual 1920x1080 resolution and scale to fit any screen
- **Multi-deck** -- Manage multiple slide decks in a single project under `decks/`
- **Presenter mode** -- Open a separate fullscreen window for projector output, synced in real-time via BroadcastChannel
- **Keyboard navigation** -- Arrow keys, Space, Enter, Home, End; press `?` for shortcut help
- **Slide URL sync** -- URL updates with `?slide=N` as you navigate; supports browser back/forward and direct links
- **Speaker notes** -- Resizable notes panel with basic Markdown rendering (bold, italic, code, headings, lists); touch-friendly resize handle
- **Configurable overlays** -- Logo, copyright text, and page numbers with flexible positioning
- **Built-in components** -- Charts, icons, code blocks, tables, multi-column layouts, math equations, shapes, video embeds
- **PDF export** -- Export decks to PDF via Playwright
- **Tunnel sharing** -- Share your deck over the internet with a single click via Cloudflare Tunnel
- **Security headers** -- X-Content-Type-Options, X-Frame-Options, Referrer-Policy applied to all routes
- **Accessible** -- WCAG AA modal focus traps, aria-labels, focus-visible indicators
- **CLI-first workflow** -- The web UI is view-only; slides are authored and edited from the terminal
- **Hot reload** -- File changes are reflected instantly via Next.js HMR

## Requirements

- Node.js 20+
- npm

## Quick Start

```bash
git clone git@github.com:co-r-e/nipry.git
cd nipry
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the deck listing page. Click a deck to view it.

## Project Structure

```
nipry/
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
│   ├── hooks/                 # Custom React hooks
│   ├── lib/                   # Core utilities and loaders
│   ├── types/                 # TypeScript type definitions
│   └── scripts/               # CLI scripts (PDF export)
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
    src: "/nipry-logo.svg",  // or "./assets/my-logo.svg"
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
      background: "#FFFFFF",  // optional (default: #FFFFFF)
      text: "#1a1a1a",        // optional (default: #1a1a1a)
    },
    fonts: {
      heading: "Inter, sans-serif",
      body: "Noto Sans JP, sans-serif",
    },
  },
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
| `type` | `"cover"` \| `"section"` \| `"content"` | `"content"` | Slide type |
| `notes` | `string` | -- | Speaker notes (multi-line YAML) |
| `background` | `string` | -- | Override slide background color |

#### Slide types

- **`cover`** -- Title slides. Page number is hidden by default.
- **`section`** -- Section divider slides.
- **`content`** -- Standard content slides (default).

## Built-in MDX Components

All standard Markdown elements are styled for slide presentation (large fonts optimized for projection).

### Columns

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

### Chart

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

### Icon

Lucide icons:

```mdx
<Icon name="rocket" size={48} />
<Icon name="code" size={32} color="#4A90D9" />
```

See all available icons at [lucide.dev/icons](https://lucide.dev/icons). Use kebab-case names (e.g., `file-text`, `arrow-right`).

### Shape

SVG shapes:

```mdx
<Shape type="circle" size={100} fill="#4A90D9" />
<Shape type="rectangle" size={80} />
<Shape type="triangle" size={60} />
<Shape type="arrow" size={120} />
<Shape type="line" size={200} strokeWidth={3} />
```

### Video

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

## PDF Export

Export a deck to PDF using Playwright:

```bash
# Start the dev server first
npm run dev

# In another terminal
npm run export -- my-presentation
```

This captures each slide as a screenshot and combines them into a PDF at `output/my-presentation.pdf`.

**Note:** Playwright must have Chromium installed. Run `npx playwright install chromium` if needed.

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

- [Next.js 16](https://nextjs.org/) -- React framework with App Router and Turbopack
- [TypeScript](https://www.typescriptlang.org/) -- Type safety
- Native CSS Variables & CSS Modules -- Strict encapsulation for slide styling
- [Tailwind CSS 4](https://tailwindcss.com/) -- Dashboard and app UI styling
- [MDX](https://mdxjs.com/) -- Markdown + JSX for slide content
- [Recharts](https://recharts.org/) -- Charts and data visualization
- [Lucide](https://lucide.dev/) -- Icon library
- [KaTeX](https://katex.org/) -- Math equation rendering
- [Playwright](https://playwright.dev/) -- PDF export
- [gray-matter](https://github.com/jonschlinkert/gray-matter) -- YAML frontmatter parsing
- [jiti](https://github.com/unjs/jiti) -- Runtime TypeScript config loading

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run export -- <deck>` | Export a deck to PDF |

## License

[MIT](LICENSE)
