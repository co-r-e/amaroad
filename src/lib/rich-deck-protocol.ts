import type { RichDeckCapabilities, RichDeckPosition, RichDeckSlide, RichDeckState } from "@/types/rich-deck";

export interface RichDeckEvent {
  type: "amaroad:rich:event";
  token: string;
  state: RichDeckState | null;
  capabilities: RichDeckCapabilities;
  slides: RichDeckSlide[];
  error?: string;
}

export function parseRichDeckEvent(value: unknown, token: string): RichDeckEvent | null {
  if (!value || typeof value !== "object") return null;
  const message = value as Record<string, unknown>;
  if (message.type !== "amaroad:rich:event" || message.token !== token) return null;
  const capabilities = message.capabilities as Record<string, unknown> | undefined;
  if (!capabilities || ["next", "previous", "goTo"].some((key) => typeof capabilities[key] !== "boolean")) return null;
  let state: RichDeckState | null = null;
  if (message.state !== null) {
    if (!message.state || typeof message.state !== "object") return null;
    const candidate = message.state as Record<string, unknown>;
    if (["slideIndex", "stepIndex", "slideCount", "stepCount"].some((key) =>
      !Number.isSafeInteger(candidate[key]) || (candidate[key] as number) < 0)) return null;
    const { slideIndex, stepIndex, slideCount, stepCount } = candidate as unknown as RichDeckState;
    if (slideCount < 1 || stepCount < 1 || slideIndex >= slideCount || stepIndex >= stepCount) return null;
    state = { slideIndex, stepIndex, slideCount, stepCount };
  }
  if (message.error !== undefined && typeof message.error !== "string") return null;
  const slides: RichDeckSlide[] = [];
  if (message.slides !== undefined) {
    if (!Array.isArray(message.slides) || message.slides.length > 1000 ||
      (message.slides.length > 0 && message.slides.length !== state?.slideCount)) return null;
    for (const slide of message.slides) {
      if (!slide || typeof slide !== "object" || typeof slide.title !== "string" ||
        (slide.notes !== undefined && typeof slide.notes !== "string")) return null;
      slides.push({ title: slide.title.slice(0, 1000), notes: slide.notes?.slice(0, 50000) });
    }
  }
  return {
    type: "amaroad:rich:event", token, state,
    capabilities: capabilities as unknown as RichDeckCapabilities,
    slides,
    error: typeof message.error === "string" ? message.error.slice(0, 500) : undefined,
  };
}

export function readRichPosition(query: { slide?: string; step?: string }): RichDeckPosition | undefined {
  const slide = Number(query.slide);
  const step = query.step === undefined ? 0 : Number(query.step);
  if (!Number.isSafeInteger(slide) || slide < 1 || !Number.isSafeInteger(step) || step < 0) return undefined;
  return { slideIndex: slide - 1, stepIndex: step };
}
