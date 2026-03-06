import {
  getLayoutSpec,
  isLayoutId,
  type LayoutDefinition,
  type LayoutId,
  type LayoutVariant,
  type SlotBlockType,
  type SlotDefinition,
} from "./layout-spec";

export interface StrictCardItem {
  label?: string;
  title?: string;
  body: string[];
  emphasis?: boolean;
}

export interface StrictStepItem {
  number?: string;
  title: string;
  body: string[];
  label?: string;
}

export interface StrictComparisonItem {
  label: string;
  body: string[];
}

export interface StrictTimelineItem {
  label: string;
  title: string;
  body: string[];
}

export type StrictSlotContent =
  | { kind: "text"; text: string }
  | { kind: "richText"; paragraphs: string[] }
  | { kind: "quote"; text: string; attribution?: string }
  | { kind: "stat"; value: string; label?: string; detail?: string }
  | { kind: "card"; item: StrictCardItem }
  | { kind: "cardList"; items: StrictCardItem[] }
  | { kind: "steps"; items: StrictStepItem[] }
  | { kind: "comparisonItems"; items: StrictComparisonItem[] }
  | { kind: "timelineItems"; items: StrictTimelineItem[] };

export interface LogicalSlideInput {
  layout: LayoutId;
  variantId?: string;
  sourceId?: string;
  slots: Record<string, StrictSlotContent | undefined>;
}

export interface StrictValidationIssue {
  path: string;
  code:
    | "unknown-layout"
    | "unknown-variant"
    | "missing-required-slot"
    | "unknown-slot"
    | "disallowed-block-type"
    | "too-many-items"
    | "too-many-characters"
    | "unsupported-content";
  message: string;
}

export function isHardValidationIssue(issue: StrictValidationIssue): boolean {
  return issue.code !== "too-many-items" && issue.code !== "too-many-characters";
}

export function parseLogicalSlideInput(raw: unknown): LogicalSlideInput {
  if (!isRecord(raw)) {
    throw new Error("Strict slide frontmatter must be an object.");
  }

  const layoutRaw = raw.layout;
  if (typeof layoutRaw !== "string" || !isLayoutId(layoutRaw)) {
    throw new Error(`Strict slide is missing a valid "layout". Received: ${String(layoutRaw)}`);
  }

  const variantId = raw.variantId;
  if (variantId !== undefined && typeof variantId !== "string") {
    throw new Error(`"variantId" must be a string when provided.`);
  }

  const sourceId = raw.sourceId;
  if (sourceId !== undefined && typeof sourceId !== "string") {
    throw new Error(`"sourceId" must be a string when provided.`);
  }

  const slotsRaw = raw.slots;
  if (!isRecord(slotsRaw)) {
    throw new Error(`Strict slide "${layoutRaw}" must define a "slots" object.`);
  }

  const slots: Record<string, StrictSlotContent | undefined> = {};
  for (const [slotName, slotValue] of Object.entries(slotsRaw)) {
    if (slotValue === undefined || slotValue === null) {
      slots[slotName] = undefined;
      continue;
    }
    slots[slotName] = parseStrictSlotContent(slotValue, slotName);
  }

  return {
    layout: layoutRaw,
    variantId,
    sourceId,
    slots,
  };
}

const KIND_TO_BLOCK_TYPE: Record<StrictSlotContent["kind"], SlotBlockType> = {
  text: "text",
  richText: "richText",
  quote: "quote",
  stat: "stat",
  card: "card",
  cardList: "cardList",
  steps: "steps",
  comparisonItems: "comparisonItems",
  timelineItems: "timelineItems",
};

export function validateLogicalSlideInput(
  input: LogicalSlideInput,
  spec: LayoutDefinition = getLayoutSpec(input.layout),
): StrictValidationIssue[] {
  const issues: StrictValidationIssue[] = [];

  if (input.variantId && !spec.supportedVariants.some((variant) => variant.id === input.variantId)) {
    issues.push({
      path: "variantId",
      code: "unknown-variant",
      message: `Variant "${input.variantId}" is not supported by layout "${spec.id}".`,
    });
  }

  for (const [slotName, slotSpec] of Object.entries(spec.slots)) {
    if (slotSpec.required && !input.slots[slotName]) {
      issues.push({
        path: `slots.${slotName}`,
        code: "missing-required-slot",
        message: `Required slot "${slotName}" is missing.`,
      });
    }
  }

  for (const [slotName, content] of Object.entries(input.slots)) {
    if (!content) continue;

    const slotSpec = spec.slots[slotName];
    if (!slotSpec) {
      issues.push({
        path: `slots.${slotName}`,
        code: "unknown-slot",
        message: `Slot "${slotName}" is not defined in layout "${spec.id}".`,
      });
      continue;
    }

    const blockType = KIND_TO_BLOCK_TYPE[content.kind];
    if (!slotSpec.allowed.includes(blockType)) {
      issues.push({
        path: `slots.${slotName}`,
        code: "disallowed-block-type",
        message: `Slot "${slotName}" does not allow block type "${content.kind}".`,
      });
      continue;
    }

    const itemCount = countSlotItems(content);
    if (slotSpec.maxItems !== undefined && itemCount > slotSpec.maxItems) {
      issues.push({
        path: `slots.${slotName}`,
        code: "too-many-items",
        message: `Slot "${slotName}" allows ${slotSpec.maxItems} item(s), but received ${itemCount}.`,
      });
    }

    const charCount = countSlotCharacters(content);
    if (slotSpec.maxChars !== undefined && charCount > slotSpec.maxChars) {
      issues.push({
        path: `slots.${slotName}`,
        code: "too-many-characters",
        message: `Slot "${slotName}" allows ${slotSpec.maxChars} characters, but received ${charCount}.`,
      });
    }
  }

  return issues;
}

export function isLogicalSlideInputValid(
  input: LogicalSlideInput,
  spec?: LayoutDefinition,
): boolean {
  return validateLogicalSlideInput(input, spec).length === 0;
}

export function countSlotItems(content: StrictSlotContent): number {
  switch (content.kind) {
    case "cardList":
    case "steps":
    case "comparisonItems":
    case "timelineItems":
      return content.items.length;
    default:
      return 1;
  }
}

export function countSlotCharacters(content: StrictSlotContent): number {
  switch (content.kind) {
    case "text":
      return content.text.length;
    case "richText":
      return content.paragraphs.join("").length;
    case "quote":
      return content.text.length + (content.attribution?.length ?? 0);
    case "stat":
      return content.value.length + (content.label?.length ?? 0) + (content.detail?.length ?? 0);
    case "card":
      return countCardCharacters(content.item);
    case "cardList":
      return content.items.reduce((sum, item) => sum + countCardCharacters(item), 0);
    case "steps":
      return content.items.reduce((sum, item) => sum + item.title.length + (item.label?.length ?? 0) + item.body.join("").length, 0);
    case "comparisonItems":
      return content.items.reduce((sum, item) => sum + item.label.length + item.body.join("").length, 0);
    case "timelineItems":
      return content.items.reduce((sum, item) => sum + item.label.length + item.title.length + item.body.join("").length, 0);
  }
}

function countCardCharacters(item: StrictCardItem): number {
  return (item.label?.length ?? 0) + (item.title?.length ?? 0) + item.body.join("").length;
}

export function cloneLogicalSlideInput(input: LogicalSlideInput): LogicalSlideInput {
  return JSON.parse(JSON.stringify(input)) as LogicalSlideInput;
}

export function cloneSlotContent<T extends StrictSlotContent>(content: T): T {
  return JSON.parse(JSON.stringify(content)) as T;
}

export function mergeSlotContent(
  existing: StrictSlotContent | undefined,
  incoming: StrictSlotContent,
): StrictSlotContent {
  if (!existing) return cloneSlotContent(incoming);
  if (existing.kind !== incoming.kind) {
    throw new Error(`Cannot merge slot content of different kinds: ${existing.kind} vs ${incoming.kind}`);
  }

  switch (existing.kind) {
    case "text":
      return {
        kind: "text",
        text: `${existing.text}\n${(incoming as { kind: "text"; text: string }).text}`,
      };
    case "richText":
      return {
        kind: "richText",
        paragraphs: [
          ...existing.paragraphs,
          ...(incoming as { kind: "richText"; paragraphs: string[] }).paragraphs,
        ],
      };
    case "quote":
    case "stat":
    case "card":
      throw new Error(`Slot kind "${existing.kind}" is not mergeable.`);
    case "cardList":
      return {
        kind: "cardList",
        items: [
          ...(incoming as { kind: "cardList"; items: StrictCardItem[] }).items,
          ...existing.items,
        ],
      };
    case "steps":
      return {
        kind: "steps",
        items: [
          ...(incoming as { kind: "steps"; items: StrictStepItem[] }).items,
          ...existing.items,
        ],
      };
    case "comparisonItems":
      return {
        kind: "comparisonItems",
        items: [
          ...(incoming as { kind: "comparisonItems"; items: StrictComparisonItem[] }).items,
          ...existing.items,
        ],
      };
    case "timelineItems":
      return {
        kind: "timelineItems",
        items: [
          ...(incoming as { kind: "timelineItems"; items: StrictTimelineItem[] }).items,
          ...existing.items,
        ],
      };
  }
}

export function estimateSlotLineUsage(
  slotSpec: SlotDefinition,
  content: StrictSlotContent,
): number {
  const blockType = KIND_TO_BLOCK_TYPE[content.kind];
  if (!slotSpec.allowed.includes(blockType)) return Number.POSITIVE_INFINITY;

  const widthFactor = Math.max(0.25, slotSpec.frame.w / 100);
  const charsPerLine = Math.max(
    8,
    Math.floor((slotSpec.typography.fontSize ? 42 / slotSpec.typography.fontSize : 1) * 60 * widthFactor),
  );

  switch (content.kind) {
    case "text":
      return roughLineCount(content.text, charsPerLine);
    case "richText":
      return content.paragraphs.reduce((sum, paragraph) => sum + roughLineCount(paragraph, charsPerLine), 0);
    case "quote":
      return roughLineCount(content.text, charsPerLine) + (content.attribution ? 1 : 0);
    case "stat":
      return 1 + (content.label ? 1 : 0) + (content.detail ? roughLineCount(content.detail, charsPerLine) : 0);
    case "card":
      return estimateCardItemLines(content.item, charsPerLine);
    case "cardList":
      return content.items.reduce((sum, item) => sum + estimateCardItemLines(item, charsPerLine), 0);
    case "steps":
      return content.items.reduce((sum, item) => sum + 1 + roughLineCount(item.title, charsPerLine) + item.body.reduce((bodySum, paragraph) => bodySum + roughLineCount(paragraph, charsPerLine), 0), 0);
    case "comparisonItems":
      return content.items.reduce((sum, item) => sum + 1 + item.body.reduce((bodySum, paragraph) => bodySum + roughLineCount(paragraph, charsPerLine), 0), 0);
    case "timelineItems":
      return content.items.reduce((sum, item) => sum + 2 + item.body.reduce((bodySum, paragraph) => bodySum + roughLineCount(paragraph, charsPerLine), 0), 0);
  }
}

function estimateCardItemLines(item: StrictCardItem, charsPerLine: number): number {
  return (item.label ? 1 : 0)
    + (item.title ? roughLineCount(item.title, charsPerLine) : 0)
    + item.body.reduce((sum, paragraph) => sum + roughLineCount(paragraph, charsPerLine), 0);
}

function roughLineCount(text: string, charsPerLine: number): number {
  if (!text.trim()) return 0;
  return text
    .split(/\n+/)
    .reduce((sum, segment) => sum + Math.max(1, Math.ceil(segment.length / charsPerLine)), 0);
}

export function getVariant(
  spec: LayoutDefinition,
  variantId?: string,
): LayoutVariant {
  if (variantId) {
    const variant = spec.supportedVariants.find((item) => item.id === variantId);
    if (!variant) {
      throw new Error(`Unknown variant "${variantId}" for layout "${spec.id}".`);
    }
    return variant;
  }
  return spec.supportedVariants[0];
}

function parseStrictSlotContent(value: unknown, slotName: string): StrictSlotContent {
  if (!isRecord(value)) {
    throw new Error(`Slot "${slotName}" must be an object.`);
  }

  const kind = value.kind;
  if (typeof kind !== "string") {
    throw new Error(`Slot "${slotName}" is missing required "kind".`);
  }

  switch (kind) {
    case "text":
      return { kind, text: requireString(value.text, slotName, "text") };
    case "richText":
      return { kind, paragraphs: requireStringArray(value.paragraphs, slotName, "paragraphs") };
    case "quote":
      return {
        kind,
        text: requireString(value.text, slotName, "text"),
        attribution: optionalString(value.attribution, slotName, "attribution"),
      };
    case "stat":
      return {
        kind,
        value: requireString(value.value, slotName, "value"),
        label: optionalString(value.label, slotName, "label"),
        detail: optionalString(value.detail, slotName, "detail"),
      };
    case "card":
      return {
        kind,
        item: parseCardItem(value.item, slotName),
      };
    case "cardList":
      return {
        kind,
        items: requireArray(value.items, slotName, "items").map((item, index) =>
          parseCardItem(item, `${slotName}.items[${index}]`),
        ),
      };
    case "steps":
      return {
        kind,
        items: requireArray(value.items, slotName, "items").map((item, index) =>
          parseStepItem(item, `${slotName}.items[${index}]`),
        ),
      };
    case "comparisonItems":
      return {
        kind,
        items: requireArray(value.items, slotName, "items").map((item, index) =>
          parseComparisonItem(item, `${slotName}.items[${index}]`),
        ),
      };
    case "timelineItems":
      return {
        kind,
        items: requireArray(value.items, slotName, "items").map((item, index) =>
          parseTimelineItem(item, `${slotName}.items[${index}]`),
        ),
      };
    default:
      throw new Error(`Slot "${slotName}" has unsupported kind "${kind}".`);
  }
}

function parseCardItem(value: unknown, path: string): StrictCardItem {
  if (!isRecord(value)) {
    throw new Error(`${path} must be an object.`);
  }
  return {
    label: optionalString(value.label, path, "label"),
    title: optionalString(value.title, path, "title"),
    body: requireStringArray(value.body, path, "body"),
    emphasis: optionalBoolean(value.emphasis, path, "emphasis"),
  };
}

function parseStepItem(value: unknown, path: string): StrictStepItem {
  if (!isRecord(value)) {
    throw new Error(`${path} must be an object.`);
  }
  return {
    number: optionalString(value.number, path, "number"),
    title: requireString(value.title, path, "title"),
    body: requireStringArray(value.body, path, "body"),
    label: optionalString(value.label, path, "label"),
  };
}

function parseComparisonItem(value: unknown, path: string): StrictComparisonItem {
  if (!isRecord(value)) {
    throw new Error(`${path} must be an object.`);
  }
  return {
    label: requireString(value.label, path, "label"),
    body: requireStringArray(value.body, path, "body"),
  };
}

function parseTimelineItem(value: unknown, path: string): StrictTimelineItem {
  if (!isRecord(value)) {
    throw new Error(`${path} must be an object.`);
  }
  return {
    label: requireString(value.label, path, "label"),
    title: requireString(value.title, path, "title"),
    body: requireStringArray(value.body, path, "body"),
  };
}

function requireString(value: unknown, path: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${path}.${field} must be a non-empty string.`);
  }
  return value;
}

function optionalString(value: unknown, path: string, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new Error(`${path}.${field} must be a string.`);
  }
  return value;
}

function optionalBoolean(value: unknown, path: string, field: string): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "boolean") {
    throw new Error(`${path}.${field} must be a boolean.`);
  }
  return value;
}

function requireStringArray(value: unknown, path: string, field: string): string[] {
  const arr = requireArray(value, path, field);
  return arr.map((item, index) => requireString(item, `${path}.${field}[${index}]`, "value"));
}

function requireArray(value: unknown, path: string, field: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${path}.${field} must be an array.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
