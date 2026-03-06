import {
  getLayoutSpec,
  type LayoutDefinition,
  type LayoutId,
  type SplitUnit,
} from "./layout-spec";
import {
  cloneLogicalSlideInput,
  cloneSlotContent,
  countSlotCharacters,
  countSlotItems,
  estimateSlotLineUsage,
  getVariant,
  isHardValidationIssue,
  mergeSlotContent,
  validateLogicalSlideInput,
  type LogicalSlideInput,
  type StrictCardItem,
  type StrictSlotContent,
  type StrictValidationIssue,
} from "./strict-schema";

export interface SlideMeasureResult {
  fits: boolean;
  failingSlots: string[];
  overflowX?: number;
  overflowY?: number;
  reason?: string;
}

export type SlideMeasureFn = (
  slide: PaginatedSlidePage,
  spec: LayoutDefinition,
) => Promise<SlideMeasureResult> | SlideMeasureResult;

export interface PaginationMeasurement {
  pageIndex: number;
  layout: LayoutId;
  result: SlideMeasureResult;
}

export interface PaginatedSlidePage {
  layout: LayoutId;
  variantId: string;
  sourceLayout: LayoutId;
  sourceId?: string;
  pageIndex: number;
  continuationIndex: number;
  slots: Record<string, StrictSlotContent | undefined>;
}

export interface PaginationError {
  pageIndex: number;
  slot?: string;
  message: string;
}

export interface PaginationResult {
  pages: PaginatedSlidePage[];
  validationIssues: StrictValidationIssue[];
  measurements: PaginationMeasurement[];
  errors: PaginationError[];
}

export interface PaginateOptions {
  measure?: SlideMeasureFn;
  maxPages?: number;
}

export async function paginateLogicalSlide(
  input: LogicalSlideInput,
  options: PaginateOptions = {},
): Promise<PaginationResult> {
  const baseSpec = getLayoutSpec(input.layout);
  const validationIssues = validateLogicalSlideInput(input, baseSpec);
  const hardValidationIssues = validationIssues.filter(isHardValidationIssue);
  const errors: PaginationError[] = [];
  const measurements: PaginationMeasurement[] = [];

  if (hardValidationIssues.length > 0) {
    return {
      pages: [],
      validationIssues,
      measurements,
      errors,
    };
  }

  const pages: PaginatedSlidePage[] = [];
  const maxPages = options.maxPages ?? 12;
  let currentInput = cloneLogicalSlideInput(input);
  let continuationIndex = 0;

  while (true) {
    if (pages.length >= maxPages) {
      errors.push({
        pageIndex: pages.length,
        message: `Pagination exceeded maxPages (${maxPages}).`,
      });
      break;
    }

    const currentSpec = getLayoutSpec(currentInput.layout);
    const currentPage: PaginatedSlidePage = {
      layout: currentSpec.id,
      variantId: getVariant(currentSpec, currentInput.variantId).id,
      sourceLayout: input.layout,
      sourceId: input.sourceId,
      pageIndex: pages.length,
      continuationIndex,
      slots: cloneLogicalSlideInput(currentInput).slots,
    };

    const carrySlots: Record<string, StrictSlotContent | undefined> = {};

    while (true) {
      const measurement = await measureSlide(
        currentPage,
        currentSpec,
        options.measure,
      );
      measurements.push({
        pageIndex: currentPage.pageIndex,
        layout: currentPage.layout,
        result: measurement,
      });

      if (measurement.fits) break;

      const moved = moveOneUnitToContinuation(
        currentPage,
        currentSpec,
        carrySlots,
      );

      if (!moved) {
        errors.push({
          pageIndex: currentPage.pageIndex,
          message:
            measurement.reason ??
            `Slide could not be paginated further for layout "${currentPage.layout}".`,
        });
        return {
          pages,
          validationIssues,
          measurements,
          errors,
        };
      }
    }

    pages.push(currentPage);

    if (Object.keys(carrySlots).length === 0) break;

    continuationIndex += 1;
    const repeatedSlots = Object.fromEntries(
      (currentSpec.split.repeatSlots ?? [])
        .map((slotName) => [slotName, currentPage.slots[slotName] ? cloneSlotContent(currentPage.slots[slotName]!) : undefined]),
    );
    currentInput = {
      layout: currentSpec.split.continuationLayout ?? currentSpec.id,
      variantId: currentInput.variantId,
      sourceId: currentInput.sourceId,
      slots: {
        ...repeatedSlots,
        ...carrySlots,
      },
    };
  }

  return {
    pages,
    validationIssues,
    measurements,
    errors,
  };
}

async function measureSlide(
  page: PaginatedSlidePage,
  spec: LayoutDefinition,
  measure: SlideMeasureFn | undefined,
): Promise<SlideMeasureResult> {
  if (measure) return measure(page, spec);
  return heuristicMeasure(page, spec);
}

function heuristicMeasure(
  page: PaginatedSlidePage,
  spec: LayoutDefinition,
): SlideMeasureResult {
  const failingSlots: string[] = [];

  for (const [slotName, slotSpec] of Object.entries(spec.slots)) {
    const content = page.slots[slotName];
    if (!content) continue;

    const itemCount = countSlotItems(content);
    if (slotSpec.maxItems !== undefined && itemCount > slotSpec.maxItems) {
      failingSlots.push(slotName);
      continue;
    }

    const charCount = countSlotCharacters(content);
    if (slotSpec.maxChars !== undefined && charCount > slotSpec.maxChars) {
      failingSlots.push(slotName);
      continue;
    }

    const estimatedLines = estimateSlotLineUsage(slotSpec, content);
    if (slotSpec.maxLines !== undefined && estimatedLines > slotSpec.maxLines) {
      failingSlots.push(slotName);
    }
  }

  return {
    fits: failingSlots.length === 0,
    failingSlots,
    reason:
      failingSlots.length > 0
        ? `Heuristic overflow in slot(s): ${failingSlots.join(", ")}`
        : undefined,
  };
}

function moveOneUnitToContinuation(
  page: PaginatedSlidePage,
  spec: LayoutDefinition,
  carrySlots: Record<string, StrictSlotContent | undefined>,
): boolean {
  for (const slotName of spec.split.order) {
    const content = page.slots[slotName];
    if (!content) continue;

    const splitUnit = spec.split.unitBySlot[slotName] ?? "none";
    const splitResult = splitSlotContent(content, splitUnit);
    if (!splitResult) continue;

    page.slots[slotName] = splitResult.current;
    if (splitResult.moved) {
      carrySlots[slotName] = mergeSlotContent(carrySlots[slotName], splitResult.moved);
    }
    return true;
  }

  return false;
}

interface SplitResult {
  current: StrictSlotContent | undefined;
  moved?: StrictSlotContent;
}

function splitSlotContent(
  content: StrictSlotContent,
  unit: SplitUnit,
): SplitResult | null {
  switch (unit) {
    case "none":
      return null;
    case "paragraph":
      return splitParagraphUnit(content);
    case "card":
      return splitCardUnit(content);
    case "step":
      return splitStepUnit(content);
    case "item":
      return splitItemUnit(content);
  }
}

function splitParagraphUnit(content: StrictSlotContent): SplitResult | null {
  switch (content.kind) {
    case "richText": {
      if (content.paragraphs.length <= 1) return null;
      const nextParagraphs = [...content.paragraphs];
      const movedParagraph = nextParagraphs.pop();
      if (!movedParagraph) return null;
      return {
        current: { kind: "richText", paragraphs: nextParagraphs },
        moved: { kind: "richText", paragraphs: [movedParagraph] },
      };
    }
    case "card": {
      if (content.item.body.length <= 1) return null;
      const body = [...content.item.body];
      const movedParagraph = body.pop();
      if (!movedParagraph) return null;
      return {
        current: {
          kind: "card",
          item: { ...content.item, body },
        },
        moved: {
          kind: "card",
          item: { ...content.item, body: [movedParagraph] },
        },
      };
    }
    default:
      return null;
  }
}

function splitCardUnit(content: StrictSlotContent): SplitResult | null {
  if (content.kind !== "cardList" || content.items.length <= 1) return null;
  const items = [...content.items];
  const movedItem = items.pop();
  if (!movedItem) return null;
  return {
    current: { kind: "cardList", items },
    moved: { kind: "cardList", items: [cloneCardItem(movedItem)] },
  };
}

function splitStepUnit(content: StrictSlotContent): SplitResult | null {
  if (content.kind !== "steps" || content.items.length <= 1) return null;
  const items = [...content.items];
  const movedItem = items.pop();
  if (!movedItem) return null;
  return {
    current: { kind: "steps", items },
    moved: { kind: "steps", items: [JSON.parse(JSON.stringify(movedItem))] },
  };
}

function splitItemUnit(content: StrictSlotContent): SplitResult | null {
  switch (content.kind) {
    case "comparisonItems": {
      if (content.items.length <= 1) return null;
      const items = [...content.items];
      const movedItem = items.pop();
      if (!movedItem) return null;
      return {
        current: { kind: "comparisonItems", items },
        moved: {
          kind: "comparisonItems",
          items: [JSON.parse(JSON.stringify(movedItem))],
        },
      };
    }
    case "timelineItems": {
      if (content.items.length <= 1) return null;
      const items = [...content.items];
      const movedItem = items.pop();
      if (!movedItem) return null;
      return {
        current: { kind: "timelineItems", items },
        moved: {
          kind: "timelineItems",
          items: [JSON.parse(JSON.stringify(movedItem))],
        },
      };
    }
    default:
      return null;
  }
}

function cloneCardItem(item: StrictCardItem): StrictCardItem {
  return JSON.parse(JSON.stringify(item)) as StrictCardItem;
}
