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
  "#02001A",
  "#4A90D9",
  "#50C878",
  "#FF6B6B",
  "#FFD93D",
  "#6C5CE7",
];

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
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey={yKey} fill={colors[0]} isAnimationActive={animate} />
        </BarChart>
      );
    case "line":
      return (
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey={yKey}
            stroke={colors[0]}
            strokeWidth={2}
            isAnimationActive={animate}
          />
        </LineChart>
      );
    case "area":
      return (
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Area
            type="monotone"
            dataKey={yKey}
            fill={colors[0]}
            stroke={colors[0]}
            fillOpacity={0.3}
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
          <Tooltip />
          <Legend />
        </PieChart>
      );
  }
}
