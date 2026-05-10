# Overflow Fix Patterns

Use this table to choose the first fix attempt. Keep heading design unchanged.

## Pattern table

| Symptom | Likely cause | First fix | Second fix | Last resort |
|---|---|---|---|---|
| Bottom clipping of text | Too much text for one slide | Convert to `Columns` or `CardGrid` | Reduce non-heading font size (min `1.8rem`) and tighten line-height | Split into two slides |
| Dense bullets feel crowded | Too many short list items | Group items into 2-3 thematic blocks | Replace list with `Steps`/`Timeline` | Split into continuation slide |
| Chart extends beyond content area | Chart height too large | Lower `Chart` `height` value | Move chart into one column with summary in another | Move details to next slide |
| Image + text cannot coexist | Media and text both oversized | Change slide type to `image-left`/`image-right` | Constrain image with `maxHeight`/`objectFit` and shorten copy | Separate into image slide + explanation slide |
| Table too wide | Too many columns or long labels | Reduce columns and abbreviate labels | Convert to comparison cards | Split table into two slides |
| Code block overflows | Long lines and too much code | Trim code to only key lines | Break into two code blocks with explanation | Move full code to next slide / notes |
| Custom JSX box pushes outside | Excessive padding/gap/margin | Reduce local `padding`/`gap`/`margin` | Re-layout using built-in components | Split content |

## Approved adjustment ranges

- Non-heading font size: `1.8rem` to `2.4rem`
- Body line-height: `1.35` to `1.7`
- Gap/margins: prefer `var(--slide-space-sm)` baseline
- Chart height: usually `280` to `380` depending on nearby text

## Guardrails

Do not do the following:

- Edit heading component files.
- Add inline style overrides on `h1`/`h2`/`h3`.
- Modify SlideFrame safe-zone padding values.
- Introduce Tailwind utility classes in MDX slide files.

## Quick snippets

### 1) Convert packed text into two columns

```mdx
<Columns>
  <Column>
  <p style={{ fontSize: "2rem", lineHeight: 1.45 }}>
    ...
  </p>
  </Column>
  <Column>
  <p style={{ fontSize: "2rem", lineHeight: 1.45 }}>
    ...
  </p>
  </Column>
</Columns>
```

### 2) Reduce chart footprint

```mdx
<Chart
  type="bar"
  data={data}
  xKey="name"
  yKey="value"
  height={320}
/>
```

### 3) Constrain image height without touching headings

```mdx
<img
  src="./assets/example.png"
  alt="example"
  style={{ width: "100%", maxHeight: "56%", objectFit: "contain" }}
/>
```
