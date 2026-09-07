/**
 * Browser-side readiness wait for the native single-slide route.
 *
 * This function is serialized by Playwright (`page.evaluate`) and executed
 * inside the page, so it must be fully self-contained: no imports, no
 * references to module scope. It mirrors `waitForSlideReady` in
 * `src/lib/export.ts` (mdx ready -> images -> fonts (with a Japanese probe)
 * -> DOM stable -> fonts again) so tooling sees the same "done" signal as the
 * PDF/PPTX exporter.
 */
export interface SlideReadyResult {
  status: "ready" | "error" | "timeout";
  message?: string;
}

export interface SlideReadyOptions {
  /** Selector of the element wrapping one slide. */
  rootSelector: string;
  mdxTimeoutMs?: number;
  imagesTimeoutMs?: number;
  fontsTimeoutMs?: number;
  quietMs?: number;
  stableTimeoutMs?: number;
}

export async function waitForNativeSlideReady(
  options: SlideReadyOptions,
): Promise<SlideReadyResult> {
  const rootSelector = options.rootSelector;
  const mdxTimeoutMs = options.mdxTimeoutMs ?? 20000;
  const imagesTimeoutMs = options.imagesTimeoutMs ?? 10000;
  const fontsTimeoutMs = options.fontsTimeoutMs ?? 10000;
  const quietMs = options.quietMs ?? 200;
  const stableTimeoutMs = options.stableTimeoutMs ?? 5000;

  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  const waitForRoot = async (): Promise<HTMLElement | null> => {
    const deadline = Date.now() + mdxTimeoutMs;
    while (Date.now() < deadline) {
      const el = document.querySelector<HTMLElement>(rootSelector);
      if (el) return el;
      await sleep(50);
    }
    return null;
  };

  const root = await waitForRoot();
  if (!root) {
    return { status: "timeout", message: `root ${rootSelector} not found` };
  }

  // 1. MDX module loaded (data-mdx-status="ready"), or surfaced an error.
  const mdxStatus = await new Promise<string>((resolve) => {
    const read = () =>
      root.querySelector("[data-mdx-status]")?.getAttribute("data-mdx-status") ?? null;
    const current = read();
    if (current === "ready" || current === "error") return resolve(current);

    const timer = setTimeout(() => {
      observer.disconnect();
      resolve(read() ?? "timeout");
    }, mdxTimeoutMs);

    const observer = new MutationObserver(() => {
      const next = read();
      if (next === "ready" || next === "error") {
        clearTimeout(timer);
        observer.disconnect();
        resolve(next);
      }
    });
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-mdx-status"],
    });
  });

  if (mdxStatus === "error") {
    const text = root.textContent?.trim().slice(0, 200) ?? "";
    return { status: "error", message: text || "MDX error" };
  }
  if (mdxStatus !== "ready") {
    return { status: "timeout", message: "data-mdx-status never became ready" };
  }

  // 2. Images.
  await new Promise<void>((resolve) => {
    const pending = Array.from(root.querySelectorAll("img")).filter((img) => !img.complete);
    if (pending.length === 0) return resolve();
    let settled = 0;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve();
    };
    const onDone = () => {
      settled++;
      if (settled >= pending.length) finish();
    };
    const timer = setTimeout(finish, imagesTimeoutMs);
    for (const img of pending) {
      img.addEventListener("load", onDone, { once: true });
      img.addEventListener("error", onDone, { once: true });
    }
  });

  // 3. Fonts (same probe string as the exporter so CJK subsets resolve).
  const waitForFonts = async (timeoutMs: number) => {
    const fontSet = document.fonts;
    if (!fontSet) return;
    const specs = new Set<string>();
    for (const node of [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))]) {
      const font = getComputedStyle(node).font?.trim();
      if (font) specs.add(font);
    }
    const tasks: Promise<unknown>[] = [fontSet.ready];
    for (const spec of specs) {
      try {
        tasks.push(fontSet.load(spec, "BESbswy あア亜"));
      } catch {
        // Unparseable shorthand; ignore.
      }
    }
    await Promise.race([Promise.allSettled(tasks), sleep(timeoutMs)]);
  };
  await waitForFonts(fontsTimeoutMs);

  // 4. DOM quiet window.
  await new Promise<void>((resolve) => {
    let quietTimer: ReturnType<typeof setTimeout> | undefined;
    const settle = () => {
      observer.disconnect();
      if (quietTimer) clearTimeout(quietTimer);
      clearTimeout(deadline);
      resolve();
    };
    const reset = () => {
      if (quietTimer) clearTimeout(quietTimer);
      quietTimer = setTimeout(settle, quietMs);
    };
    const observer = new MutationObserver(reset);
    const deadline = setTimeout(settle, stableTimeoutMs);
    observer.observe(root, { childList: true, subtree: true, attributes: true, characterData: true });
    reset();
  });

  // 5. Fonts again after layout settled.
  await waitForFonts(Math.min(fontsTimeoutMs, 3000));

  // Two animation frames so the compositor has painted the final layout.
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

  return { status: "ready" };
}
