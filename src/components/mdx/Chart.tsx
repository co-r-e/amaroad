"use client";

import type { ReactElement, ReactNode } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useExportMode } from "@/contexts/ExportContext";
import styles from "./Media.module.css";

type ChartType = "bar" | "line" | "pie" | "area";

interface ChartProps {
  type: ChartType;
  data: Record<string, unknown>[];
  xKey?: string;
  yKey?: string;
  colors?: string[];
  height?: number;
}

const DEFAULT_COLORS = [
  "var(--slide-primary)",
  "var(--slide-secondary)",
  "var(--slide-accent)",
  "var(--slide-text-subtle)",
  "var(--slide-text-muted)",
  "var(--slide-text)",
];

const AXIS_TICK = { fill: "var(--slide-text-muted)", fontSize: 14 };
const TOOLTIP_STYLE = {
  backgroundColor: "var(--slide-surface)",
  border: "1px solid var(--slide-border)",
  borderRadius: "12px",
  color: "var(--slide-text)",
};
const LEGEND_STYLE = { color: "var(--slide-text-muted)", fontSize: 14 };

export function Chart({
  type,
  data,
  xKey = "name",
  yKey = "value",
  colors = DEFAULT_COLORS,
  height = 400,
}: ChartProps): ReactNode {
  const isExporting = useExportMode();
  const animate = !isExporting;

  if (!data || data.length === 0) {
    return (
      <div
        data-growable=""
        className={styles.chartNoData}
        style={{ minHeight: height }}
      >
        No data
      </div>
    );
  }

  return (
    <div data-growable="" className={styles.chartContainer} style={{ minHeight: height }}>
      <ResponsiveContainer width="100%" height="100%">
        {renderChart({ type, data, xKey, yKey, colors, animate })}
      </ResponsiveContainer>
    </div>
  );
}

interface RenderChartParams {
  type: ChartType;
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
  colors: string[];
  animate: boolean;
}

function renderChart({
  type,
  data,
  xKey,
  yKey,
  colors,
  animate,
}: RenderChartParams): ReactElement {
  switch (type) {
    case "bar":
      return (
        <BarChart data={data}>
          <CartesianGrid stroke="var(--slide-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={xKey} tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={LEGEND_STYLE} />
          <Bar dataKey={yKey} fill={colors[0]} radius={[10, 10, 0, 0]} isAnimationActive={animate} />
        </BarChart>
      );
    case "line":
      return (
        <LineChart data={data}>
          <CartesianGrid stroke="var(--slide-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={xKey} tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={LEGEND_STYLE} />
          <Line
            type="monotone"
            dataKey={yKey}
            stroke={colors[0]}
            strokeWidth={3}
            dot={{ r: 4, fill: colors[0], strokeWidth: 0 }}
            activeDot={{ r: 6 }}
            isAnimationActive={animate}
          />
        </LineChart>
      );
    case "area":
      return (
        <AreaChart data={data}>
          <CartesianGrid stroke="var(--slide-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={xKey} tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={LEGEND_STYLE} />
          <Area
            type="monotone"
            dataKey={yKey}
            fill={colors[0]}
            stroke={colors[0]}
            strokeWidth={2.5}
            fillOpacity={0.18}
            isAnimationActive={animate}
          />
        </AreaChart>
      );
    case "pie":
      return (
        <PieChart>
          <Pie
            data={data}
            dataKey={yKey}
            nameKey={xKey}
            cx="50%"
            cy="50%"
            outerRadius="80%"
            label
            isAnimationActive={animate}
          >
            {data.map((_, index) => (
              <Cell key={index} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={LEGEND_STYLE} />
        </PieChart>
      );
  }
}
