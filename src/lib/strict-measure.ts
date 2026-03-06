export interface StrictSlotMeasure {
  slot: string;
  overflowX: number;
  overflowY: number;
  fits: boolean;
}

export interface StrictMeasureResult {
  fits: boolean;
  slots: StrictSlotMeasure[];
}

const EPSILON = 1;

export function measureStrictSlideElement(root: HTMLElement): StrictMeasureResult {
  const slots = Array.from(
    root.querySelectorAll<HTMLElement>("[data-strict-slot]"),
  ).map((element) => {
    const overflowX = Math.max(0, element.scrollWidth - element.clientWidth);
    const overflowY = Math.max(0, element.scrollHeight - element.clientHeight);
    return {
      slot: element.dataset.strictSlot ?? "unknown",
      overflowX,
      overflowY,
      fits: overflowX <= EPSILON && overflowY <= EPSILON,
    };
  });

  return {
    fits: slots.every((slot) => slot.fits),
    slots,
  };
}
