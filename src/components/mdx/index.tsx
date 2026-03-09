import type { MDXComponents } from "mdx/types";

import { SlideH1, SlideH2, SlideH3 } from "./typography/Headings";
import { SlideBlockquote } from "./typography/Blockquote";
import { SlideHr, SlideAnchor } from "./typography/InlineElements";
import { SlideUl, SlideOl, SlideLi } from "./typography/Lists";
import { SlideParagraph } from "./typography/Paragraph";
import { SlideCode, SlidePreCode } from "./CodeBlock";
import { SlideImage } from "./SlideImage";
import { SlideTable, SlideTh, SlideTd } from "./SlideTable";
import { ShowcaseCover } from "./ShowcaseCover";
import { ShowcaseSection } from "./ShowcaseSection";
import { FigureShowcase } from "./FigureShowcase";
import { KpiStrip } from "./KpiStrip";
import { ScreenshotCallouts } from "./ScreenshotCallouts";
import { LogoWall } from "./LogoWall";
import { ShowcaseAgenda } from "./ShowcaseAgenda";
import { ShowcaseVideo } from "./ShowcaseVideo";
import { ShowcaseFAQ } from "./ShowcaseFAQ";
import { ShowcaseComparisonTable } from "./ShowcaseComparisonTable";
import { ShowcaseFeatureGrid } from "./ShowcaseFeatureGrid";
import { ShowcaseMetric } from "./ShowcaseMetric";
import { ShowcaseTeamGrid } from "./ShowcaseTeamGrid";
import { ShowcaseQuote } from "./ShowcaseQuote";
import { ShowcasePricing } from "./ShowcasePricing";
import { ShowcaseComparison } from "./ShowcaseComparison";
import { ShowcaseEndSlide } from "./ShowcaseEndSlide";
import { ShowcaseSplit } from "./ShowcaseSplit";
import { ShowcaseColumnText } from "./ShowcaseColumnText";
import { ShowcaseLayerStack } from "./ShowcaseLayerStack";
import { ShowcaseDashboard } from "./ShowcaseDashboard";
import { ShowcaseMatrix } from "./ShowcaseMatrix";
import { ShowcaseDiagram } from "./ShowcaseDiagram";
import { ShowcaseStatGrid } from "./ShowcaseStatGrid";
import { ShowcaseIconGrid } from "./ShowcaseIconGrid";
import { ShowcaseShapeGrid, ShapeItem } from "./ShowcaseShapeGrid";

import { Center } from "./layout/Center";
import { Columns, Column } from "./layout/Columns";

import { Card } from "./Card";
import { Chart } from "./Chart";
import { Icon } from "./Icon";
import { Shape } from "./Shape";
import { Steps, Step } from "./Steps";
import { Timeline, TimelineItem } from "./Timeline";

export const slideComponents: MDXComponents = {
  // Typography
  h1: SlideH1,
  h2: SlideH2,
  h3: SlideH3,
  p: SlideParagraph,
  blockquote: SlideBlockquote,
  code: SlideCode,
  pre: SlidePreCode,
  img: SlideImage,
  table: SlideTable,
  th: SlideTh,
  td: SlideTd,
  ul: SlideUl,
  ol: SlideOl,
  li: SlideLi,
  hr: SlideHr,
  a: SlideAnchor,
  // Layout
  Columns,
  Column,
  Center,
  // Content
  Card,
  Timeline,
  TimelineItem,
  Steps,
  Step,
  // Media & Data
  Chart,
  Icon,
  Shape,
  // Showcase
  ShowcaseCover,
  ShowcaseSection,
  FigureShowcase,
  KpiStrip,
  ScreenshotCallouts,
  LogoWall,
  ShowcaseAgenda,
  ShowcaseVideo,
  ShowcaseFAQ,
  ShowcaseComparisonTable,
  ShowcaseFeatureGrid,
  ShowcaseMetric,
  ShowcaseTeamGrid,
  ShowcaseQuote,
  ShowcasePricing,
  ShowcaseComparison,
  ShowcaseEndSlide,
  ShowcaseSplit,
  ShowcaseColumnText,
  ShowcaseLayerStack,
  ShowcaseDashboard,
  ShowcaseMatrix,
  ShowcaseDiagram,
  ShowcaseStatGrid,
  ShowcaseIconGrid,
  ShowcaseShapeGrid,
  ShapeItem,
};
