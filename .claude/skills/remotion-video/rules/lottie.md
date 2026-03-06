---
name: lottie
description: Embedding Lottie animations in Remotion
metadata:
  tags: lottie, animation, json
---

# Lottie Animations in Remotion

## Prerequisites

```bash
npx remotion add @remotion/lottie # If project uses npm
bunx remotion add @remotion/lottie # If project uses bun
yarn remotion add @remotion/lottie # If project uses yarn
pnpm exec remotion add @remotion/lottie # If project uses pnpm
```

## Usage

Fetch the Lottie asset, wrap loading in `delayRender()`/`continueRender()`, and render with the Lottie component:

```tsx
import { Lottie, LottieAnimationData } from "@remotion/lottie";
import { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";

export const MyLottie: React.FC = () => {
  const [handle] = useState(() => delayRender("Loading Lottie animation"));
  const [animationData, setAnimationData] =
    useState<LottieAnimationData | null>(null);

  useEffect(() => {
    fetch("https://assets.lottiefiles.com/packages/lf20_example.json")
      .then((res) => res.json())
      .then((data) => {
        setAnimationData(data);
        continueRender(handle);
      })
      .catch((err) => {
        cancelRender(err);
      });
  }, [handle]);

  if (!animationData) {
    return null;
  }

  return <Lottie animationData={animationData} style={{ width: 500 }} />;
};
```

## Styling

Lottie supports the `style` prop to control dimensions and apply CSS:

```tsx
<Lottie animationData={animationData} style={{ width: 300, height: 300 }} />
```
