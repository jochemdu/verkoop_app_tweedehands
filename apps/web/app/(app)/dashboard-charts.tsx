"use client";

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
// war raakt. Niet pure-R/pure-G combinaties en voldoende luminance-verschil.
const PALETTE = [
  "#3b82f6",
  "#f59e0b",
  "#10b981",
  "#ec4899",
  "#8b5cf6",
  "#06b6d4",
  "#ef4444",
  "#84cc16",
  "#f97316",
  "#6366f1",
  "#14b8a6",
  "#d946ef",
  "#64748b",
  "#78716c",
  "#0ea5e9",
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
  const hasData = category.length > 0 || status.length > 0;

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <ChartCard title="Categorieverdeling">
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

      <ChartCard title="Status verdeling">
        {status.length === 0 ? (
          <EmptyHint />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={status}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-15} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Geïndexeerd per week (laatste 12 weken)" wide>
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
                stroke="#10b981"
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
    <div className={`rounded-lg border p-5 ${wide ? "md:col-span-2" : ""}`}>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}

function EmptyHint() {
  return (
    <div className="flex h-[220px] items-center justify-center text-xs text-muted-foreground">
      Nog geen data
    </div>
  );
}
