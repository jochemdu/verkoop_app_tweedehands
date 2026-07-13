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

type CategoryCount = { label: string; value: number };
type StatusCount = { label: string; value: number };
type WeeklyPoint = { week: string; count: number };

// Categorie-palet dat onderscheid geeft zonder dat kleurenblinden het in de
// war raakt. Warm gestemd (fase 27) met terracotta voorop, voldoende
// luminance-verschil en geen pure-R/pure-G combinaties.
const PALETTE = [
  "#c2410c",
  "#0f766e",
  "#b45309",
  "#4338ca",
  "#be185d",
  "#4d7c0f",
  "#0369a1",
  "#a21caf",
  "#78716c",
  "#92400e",
  "#1d4ed8",
  "#15803d",
  "#9f1239",
  "#57534e",
  "#7c3aed",
];

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
  const hasData = category.length > 0 || status.length > 0;

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
                label={(entry: { label?: string; value?: number }) =>
                  `${entry.label ?? ""} (${entry.value ?? 0})`
                }
              >
                {category.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip />
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
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-15} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#c2410c" radius={[4, 4, 0, 0]} />
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
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#0f766e"
                strokeWidth={2}
                dot={{ r: 3 }}
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
