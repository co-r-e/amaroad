---
name: measuring-text
description: Measuring text dimensions, fitting text to containers, and checking overflow
metadata:
  tags: measure, text, layout, dimensions, fitText, fillTextBox
---

# Measuring text in Remotion

## Prerequisites

```bash
npx remotion add @remotion/layout-utils
```

## Measuring text dimensions

```tsx
import { measureText } from "@remotion/layout-utils";

const { width, height } = measureText({
  text: "Hello World",
  fontFamily: "Arial",
  fontSize: 32,
  fontWeight: "bold",
});
```

## Fitting text to a width

```tsx
import { fitText } from "@remotion/layout-utils";

const { fontSize } = fitText({
  text: "Hello World",
  withinWidth: 600,
  fontFamily: "Inter",
  fontWeight: "bold",
});

return (
  <div style={{ fontSize: Math.min(fontSize, 80), fontFamily: "Inter", fontWeight: "bold" }}>
    Hello World
  </div>
);
```

## Checking text overflow

```tsx
import { fillTextBox } from "@remotion/layout-utils";

const box = fillTextBox({ maxBoxWidth: 400, maxLines: 3 });

const words = ["Hello", "World", "This", "is", "a", "test"];
for (const word of words) {
  const { exceedsBox } = box.add({
    text: word + " ",
    fontFamily: "Arial",
    fontSize: 24,
  });
  if (exceedsBox) break;
}
```

## Best practices

- **Load fonts first:** Only call measurement functions after fonts are loaded.
- **Use `validateFontIsLoaded: true`** to catch font loading issues early.
- **Match font properties** between measurement and rendering.
- **Use `outline` instead of `border`** to prevent layout differences.
