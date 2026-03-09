---
name: svg-diagram
description: |
  SVG diagram generation skill. Generates professional diagrams (flow, architecture,
  comparison, hierarchy, cycle, etc.) as SVG matching the slide's theme colors and fonts,
  saves them to the deck's assets directory, and inserts them into MDX.
  Text is kept minimal, prioritizing visual clarity.
  All arrows use orthogonal (right-angle) routing.
  Trigger: /svg-diagram
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
---

## Workflow

### Step 1: Gather Information

Identify the following from the user's request:

1. **Target deck**: Which deck to add the diagram to (directory name under `decks/`)
2. **Target slide**: Which MDX file to insert the diagram reference into
3. **Diagram content**: What to illustrate (concept, flow, architecture, etc.)
4. **Filename**: English kebab-case reflecting the content (e.g., `auth-flow.svg`, `system-architecture.svg`)

Ask for missing information if needed.

### Step 2: Theme Extraction

Retrieve the deck's theme colors:

```bash
npx tsx .claude/skills/svg-diagram/scripts/extract-theme.ts --deck <deck-name>
```

Use **all** the color and font values from the output JSON in subsequent SVG generation.

### Step 3: Layout Analysis (Optional)

If a target slide is specified, check the current slide layout to understand the available placement space:

1. Confirm the dev server is running (`npm run dev`)
2. Capture a screenshot:

```bash
npx tsx .claude/skills/nanobanana-image/scripts/capture-slide.ts \
  --deck <deck-name> \
  --slide <0-indexed> \
  --output /tmp/slide-layout.png
```

3. Read the captured image with the Read tool and check the size/shape of the empty area
4. Adjust the viewBox size based on the analysis

### Step 4: Select Diagram Type and Load Template

Determine the optimal diagram type from the user's request and **load the corresponding template file with the Read tool**.

| Type | Template File | Suitable Cases |
|------|---------------|----------------|
| Flowchart | `templates/flowchart.md` | Process flows, decision branches, workflows |
| Architecture | `templates/architecture.md` | System configurations, layer structures, tech stacks |
| Process Flow | `templates/process-flow.md` | Procedures, steps, pipelines |
| Comparison | `templates/comparison.md` | Side-by-side comparison of 2-3 items, Before/After |
| Hierarchy | `templates/hierarchy.md` | Org charts, classification trees, inheritance |
| Cycle | `templates/cycle.md` | Repeating processes, lifecycles, PDCA |
| Concept Grid | `templates/concept-grid.md` | Concept listings, feature overviews, category classifications |

```bash
# Load template (with Read tool)
.claude/skills/svg-diagram/templates/<type>.md
```

Each template contains complete SVG examples, layout rules, and detailed coordinate calculations.
**Follow the template instructions strictly** and combine them with the "SVG Generation Guidelines (Common)" below to generate the SVG.

### Step 5: SVG Generation

Generate the SVG following the template and common guidelines.
Output with the Write tool to:

```
decks/<deck>/assets/<filename>.svg
```

### Step 6: Insert into MDX

Insert the image reference into the target MDX file:

```mdx
![Description text](./assets/<filename>.svg)
```

- `resolveAssetPaths()` automatically converts to `/api/decks/<deck>/assets/<filename>.svg`
- Choose an appropriate insertion position based on the slide context

### Step 7: Report Results

Report the following to the user:

- File path of the generated SVG
- Diagram type and size
- Theme colors used
- How to verify on the dev server (`npm run dev` then navigate to the relevant slide)

---

## SVG Generation Guidelines (Common)

The following are rules common to all diagram types. Type-specific rules are documented in the template files.

### 1. Canvas Setup

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
```

| Use Case | viewBox | Notes |
|----------|---------|-------|
| Full-width diagram | `0 0 960 540` | 16:9, same ratio as slide |
| In-column diagram (50% width) | `0 0 480 540` | Half width |
| Square diagram | `0 0 600 600` | 1:1 |
| Portrait diagram | `0 0 640 720` | Portrait |

- Outer padding: **48px** (all sides)
- Usable area: 864 x 444 (from 48,48 to 912,492)

### 2. Grid System

Snap all elements to a 24px grid.

- **Node spacing**: Minimum 48px (2 grid units)
- **Gap between arrows and nodes**: 12px
- **Text padding inside nodes**: Horizontal 16px, vertical 12px

### 3. Node Drawing

#### Standard Node (Default)

```xml
<g transform="translate(x, y)">
  <rect width="W" height="H" rx="12"
        fill="{surface}" stroke="{border}" stroke-width="1.5"/>
  <text x="{W/2}" y="{H/2}" text-anchor="middle" dominant-baseline="central"
        font-family="{fontHeading}" font-size="18" font-weight="600" fill="{text}">
    Label
  </text>
</g>
```

#### Emphasis Node (primary)

```xml
<rect ... fill="{primary}" stroke="none"/>
<text ... fill="#FFFFFF" font-weight="700">Keyword</text>
```

#### Accent Node (light emphasis)

```xml
<rect ... fill="{primary}15" stroke="{primary}" stroke-width="1.5"/>
<text ... fill="{primary}">Sub-item</text>
```

**Common Node Rules**:
- Minimum width: 120px
- Minimum height: 56px
- Border radius: `rx="12"`
- Nodes at the same level should have uniform size
- Adjust node size to prevent text overflow

#### Group Background (layers, etc.)

```xml
<rect x="x" y="y" width="W" height="H" rx="16"
      fill="{surfaceAlt}" stroke="{border}" stroke-width="1" stroke-dasharray="6,3"
      opacity="0.5"/>
<text x="{x+16}" y="{y+24}" font-family="{fontBody}" font-size="14"
      font-weight="600" fill="{textMuted}">
  Group Name
</text>
```

### 4. Arrow Drawing (orthogonal / right-angle only)

**Most important rule: No curves or diagonal lines. All connections use horizontal (H) and vertical (V) segments only.**

#### Marker Definition (written once at the beginning of the SVG)

```xml
<defs>
  <marker id="arrow" viewBox="0 0 10 8" refX="10" refY="4"
          markerWidth="10" markerHeight="8" orient="auto-start-reverse">
    <path d="M 0 0 L 10 4 L 0 8 z" fill="{textMuted}"/>
  </marker>
  <marker id="arrow-primary" viewBox="0 0 10 8" refX="10" refY="4"
          markerWidth="10" markerHeight="8" orient="auto-start-reverse">
    <path d="M 0 0 L 10 4 L 0 8 z" fill="{primary}"/>
  </marker>
</defs>
```

#### Arrow Path Patterns

**Horizontal then Vertical (L-shape)**:
```xml
<path d="M {x1} {y1} H {midX} V {y2}" fill="none"
      stroke="{textMuted}" stroke-width="1.5" marker-end="url(#arrow)"/>
```

**Horizontal then Vertical then Horizontal (Z-shape)**:
```xml
<path d="M {x1} {y1} H {midX} V {y2} H {x2}" fill="none"
      stroke="{textMuted}" stroke-width="1.5" marker-end="url(#arrow)"/>
```

**Vertical then Horizontal (L-shape)**:
```xml
<path d="M {x1} {y1} V {midY} H {x2}" fill="none"
      stroke="{textMuted}" stroke-width="1.5" marker-end="url(#arrow)"/>
```

#### Routing Rules

1. Arrows enter and exit from the center of node edges (right center, left center, top center, bottom center)
2. Bends are limited to 1 (L-shape) or 2 (Z-shape) turns
3. Arrows must not pass through other nodes — reroute them
4. Parallel arrows must be spaced at least 24px apart
5. Multiple arrows from the same node should be distributed with 16px spacing

#### Direction Conventions

| Diagram Type | Flow Direction | Arrow Exit -> Entry |
|---|---|---|
| Flowchart | Top -> Bottom | Bottom edge -> Top edge |
| Architecture | Left -> Right | Right edge -> Left edge |
| Process Flow | Left -> Right | Right edge -> Left edge |
| Cycle | Clockwise | Select appropriate edges |

#### Arrow Labels (optional)

```xml
<text x="{midX}" y="{midY - 8}" text-anchor="middle"
      font-family="{fontBody}" font-size="13" fill="{textMuted}">
  Label
</text>
```

### 5. Theme Color Mapping

Apply values from the extract-theme.ts output JSON as follows:

| SVG Element | Theme Variable | Usage |
|-------------|---------------|-------|
| Standard node background | `surface` | Default box background |
| Standard node border | `border` | Default box border |
| Emphasis node background | `primary` | Key boxes |
| Emphasis node text | `#FFFFFF` | White text |
| Accent node background | `{primary}15` | 10% transparent light emphasis |
| Accent node border | `primary` | Accent border |
| Arrow lines | `textMuted` | Connecting lines |
| Arrow labels | `textMuted` | Small description text |
| Main labels | `text` | Text inside nodes |
| Sub-labels | `textMuted` | Supplementary text |
| Group background | `surfaceAlt` | Layer section background |
| Group border | `border` + dashed | Group boundary |

**How to specify transparent colors**: Append 2 hex digits to the end of a HEX color.
- 10% -> `{color}1A`
- 15% -> `{color}26`
- 20% -> `{color}33`
- 50% -> `{color}80`

### 6. Typography

- **Node labels**: `font-family="{fontHeading}"`, `font-size="16"-"18"`, `font-weight="600"`
- **Sub-labels**: `font-family="{fontBody}"`, `font-size="13"-"14"`, `font-weight="400"`
- **Diagram title** (if included): `font-size="22"-"24"`, `font-weight="700"`
- **Arrow labels**: `font-size="13"`, `fill="{textMuted}"`
- **Minimum font size**: 13px (nothing smaller allowed)
- Explicitly specify `font-family`, `font-size`, `font-weight`, and `fill` on all `<text>` elements (SVG does not inherit CSS variables)

### 7. Design Principles

- **Minimal text**: Keep node labels to 1-4 words. Leave explanatory text to the slide
- **Visual-first**: Express relationships through color coding, arrows, and layout
- **No unnecessary decoration**: No gradients, drop shadows, or decorative shapes (simple flat design)
- **Limit to 3-4 colors**: primary + surface + textMuted + 1 accent is sufficient
- **Transparent background**: Do not add a background `<rect>` to the SVG itself (let the slide background show through)

### 8. Quality Checklist

Verify the following before writing the SVG file:

- [ ] **Alignment**: Nodes at the same level are aligned on the same coordinate axis
- [ ] **Consistency**: Nodes of the same type have the same size and style
- [ ] **Equal spacing**: Spacing between nodes is uniform
- [ ] **No overlap**: No nodes overlap each other or overlap with arrows
- [ ] **Right-angle arrows**: All connecting lines consist of horizontal and vertical segments only
- [ ] **Readability**: Text is 13px or larger and node labels are 4 words or fewer
- [ ] **Color harmony**: No more than 4 colors used, all from theme variables
- [ ] **Visual balance**: The diagram is roughly centered within the viewBox
- [ ] **Padding**: 48px safe area is maintained around the perimeter

## Error Handling

- `extract-theme.ts` cannot find the deck -> Verify the deck name and retry
- `deck.config.ts` has no theme settings -> Display an error message
- SVG output directory does not exist -> Create `decks/{deck}/assets/` before writing

## File Naming Convention

```
{subject}-{diagram-type}.svg
```

Examples:
- `auth-flow.svg`
- `system-architecture.svg`
- `deploy-process.svg`
- `pricing-comparison.svg`
- `data-hierarchy.svg`
- `dev-cycle.svg`
- `feature-overview.svg`

Rules:
- All lowercase English
- Words separated by hyphens
- Maximum 40 characters
- Generic names like `diagram.svg` or `chart.svg` are prohibited
