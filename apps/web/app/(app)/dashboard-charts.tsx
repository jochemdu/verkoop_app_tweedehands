"use client";

import { useTranslations } from "next-intl";

import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useChartColors, chartTooltipProps } from "@/lib/chart-theme";

type CategoryCount = { label: string; value: number };
type StatusCount = { label: string; value: number };
type WeeklyPoint = { week: string; count: number };

export function DashboardCharts({
  category,
  status,
  weekly,
}: {
  category: CategoryCount[];
  status: StatusCount[];
  weekly: WeeklyPoint[];
}) {
  const t = useTranslations("charts");
  const c = useChartColors();
  const hasData = category.length > 0 || status.length > 0;
  const axisTick = { fontSize: 10, fill: c.axis };

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <ChartCard title={t("categories")}>
        {category.length === 0 ? (
          <EmptyHint />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={category}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={45}
                paddingAngle={2}
                stroke="var(--color-card)"
                label={(entry: { label?: string; value?: number }) =>
                  `${entry.label ?? ""} (${entry.value ?? 0})`
                }
              >
                {category.map((_, i) => (
                  <Cell key={i} fill={c.palette[i % c.palette.length]} />
                ))}
              </Pie>
              <Tooltip {...chartTooltipProps} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title={t("status")}>
        {status.length === 0 ? (
          <EmptyHint />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={status}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={c.grid} />
              <XAxis dataKey="label" tick={axisTick} angle={-15} stroke={c.grid} />
              <YAxis allowDecimals={false} tick={axisTick} stroke={c.grid} />
              <Tooltip {...chartTooltipProps} />
              <Bar dataKey="value" fill={c.accent} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title={t("weekly")} wide>
        {!hasData || weekly.every((w) => w.count === 0) ? (
          <EmptyHint />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={weekly}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={c.grid} />
              <XAxis dataKey="week" tick={axisTick} stroke={c.grid} />
              <YAxis allowDecimals={false} tick={axisTick} stroke={c.grid} />
              <Tooltip {...chartTooltipProps} />
              <Line
                type="monotone"
                dataKey="count"
                stroke={c.teal}
                strokeWidth={2}
                dot={{ r: 3, fill: c.teal }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </section>
  );
}

function ChartCard({
  title,
  wide,
  children,
}: {
  title: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`card p-5 ${wide ? "md:col-span-2" : ""}`}>
      <h3 className="section-title mb-3">{title}</h3>
      {children}
    </div>
  );
}

function EmptyHint() {
  const t = useTranslations("charts");
  return (
    <div className="flex h-[220px] items-center justify-center text-xs text-muted-foreground">
      {t("noData")}
    </div>
  );
}
