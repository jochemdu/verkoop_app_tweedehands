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

type PricePoint = {
  label: string;
  low: number | null;
  avg: number | null;
  high: number | null;
};

export function PriceChart({ data }: { data: PricePoint[] }) {
  const t = useTranslations("product");

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
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
              <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} width={40} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="high"
                stroke="#c2410c"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="avg"
                stroke="#a16207"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="low"
                stroke="#78716c"
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
