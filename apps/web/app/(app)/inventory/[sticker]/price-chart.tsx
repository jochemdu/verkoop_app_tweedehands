"use client";

import { useTranslations } from "next-intl";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useChartColors, chartTooltipProps } from "@/lib/chart-theme";

type PricePoint = {
  label: string;
  low: number | null;
  avg: number | null;
  high: number | null;
};

export function PriceChart({ data }: { data: PricePoint[] }) {
  const t = useTranslations("product");
  const c = useChartColors();
  const axisTick = { fontSize: 12, fill: c.axis };

  return (
    <section className="card p-5">
      <h2 className="section-title">{t("priceTrend")}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{t("priceSource")}</p>
      {data.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{t("priceNoData")}</p>
      ) : (
        <div className="mt-3">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} width={40} />
              <Tooltip {...chartTooltipProps} />
              <Line
                type="monotone"
                dataKey="high"
                stroke={c.palette[0]}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="avg"
                stroke={c.palette[2]}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="low"
                stroke={c.palette[7]}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
