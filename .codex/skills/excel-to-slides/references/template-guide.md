# Template Customization Guide

## Slide layout anatomy

Each content slide has this structure:

```
┌─────────────────────────────────────────────────┐
│ #NN  [badge: layer]  [badge: category]   [LOGO] │
│                                                  │
│ Japanese Title (h2, 2.8rem)                      │
│ English Subtitle (p, 1.8rem)                     │
│                                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │ Overview text (2rem, on #F5F7FA bg)          │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│ │ Col 1    │ │ Col 2    │ │ Col 3    │         │
│ │ heading  │ │ heading  │ │ heading  │         │
│ │ body     │ │ body     │ │ body     │         │
│ └──────────┘ └──────────┘ └──────────┘         │
│                                                  │
│ Source: hyperlinked URLs                         │
└─────────────────────────────────────────────────┘
```

## Color tokens

### Badge area
- Badge background: `#ECEDF0` (neutral grey)
- Badge text / number: `#02001A` (near-black)

### Three-column headings (navy gradient)
- Column 1: `#4A6FA5` (light navy)
- Column 2: `#1B3A5C` (navy)
- Column 3: `#0A1E3D` (dark navy)

### Card surface
- Card background: `#F5F7FA`
- Card border: `1px solid #E2E6EC`

### Theme (deck.config.ts)
- Primary: `#0097A7` (teal)
- Background: `#FFFFFF`
- Text: `#1A1A2E`
- Text muted: `#5A6B7D`

## Changing column count

To use 2 columns instead of 3, remove one `<div className="measure-card">` block
and adjust the data mapping in the `rows.forEach` callback.

To add a 4th column, duplicate a card block and add a new `COL` entry.

## Changing column colors

Edit the inline `color` style on each column heading `<p>`:

```jsx
// Example: switch to green/yellow/red
color: "#2E7D32"   // column 1
color: "#F57F17"   // column 2
color: "#C62828"   // column 3
```

## Changing badge style

Badges use inline styles. Edit these properties:

```jsx
background: "#ECEDF0"  // change to any color
color: "#02001A"        // text color
borderRadius: "4px"     // pill shape: use "99px"
```

## Cover slide

The cover uses `<ShowcaseCover>` with `variant="split-band"`. Available variants:
- `split-band` — left panel with title, right panel with details (default)
- `typography` — large centered title
- `minimal` — clean centered with accent line
- `creative` — decorative background elements
- `artistic` — grid pattern and orbital decorations
- `image-right` — text left, image right
- `overlay` — full-bleed image with text overlay

## Adapting for different Excel schemas

### Step 1: Change the COL mapping

```javascript
const COL = {
  attackName: "Your Column A Header",
  englishName: "Your Column B Header",
  targetLayer: "Your Column C Header",
  // ... etc
};
```

### Step 2: Update the MDX template

The template string inside `rows.forEach` uses `${escapeJsx(attackName)}` etc.
Match each variable to the data you want displayed.

### Step 3: Adjust the cover

Edit the `coverMdx` template string to match the new deck's content.

## Amaroad slide rules (from CLAUDE.md)

- No Tailwind in slides — use inline styles or CSS Modules
- Minimum font size: 1.8rem (except auxiliary text)
- No side accent borders
- No decorative icons
- Use `<p>` with `・` instead of `<ul><li>` inside JSX
- Maximize content area usage — minimize whitespace
