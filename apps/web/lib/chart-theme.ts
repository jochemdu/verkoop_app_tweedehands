"use client";

import { useEffect, useState } from "react";

// Gedeeld grafiek-thema (fase 52). Recharts zet kleuren als SVG-presentatie-
// attributen (fill/stroke) waarin CSS-variabelen NIET resolven; daarom lezen we
// de --color-chart-n tokens at-runtime uit en herberekenen we bij een
// licht/donker-wissel. De tooltip is HTML, dus die gebruikt gewoon var(...).

const CHART_VARS = [
  "--color-chart-1",
  "--color-chart-2",
  "--color-chart-3",
  "--color-chart-4",
  "--color-chart-5",
  "--color-chart-6",
  "--color-chart-7",
  "--color-chart-8",
] as const;

export type ChartColors = {
  palette: string[];
  accent: string;
  teal: string;
  grid: string;
  axis: string;
};

// Light-mode fallback zodat de eerste render (pre-mount) niet zwart flitst.
const FALLBACK: ChartColors = {
  palette: [
    "#c2410c",
    "#0f766e",
    "#a16207",
    "#9333ea",
    "#2563eb",
    "#be123c",
    "#4d7c0f",
    "#78716c",
  ],
  accent: "#c2410c",
  teal: "#0f766e",
  grid: "#e7e2dc",
  axis: "#78716c",
};

function readColors(): ChartColors | null {
  if (typeof window === "undefined") return null;
  const s = getComputedStyle(document.documentElement);
  const get = (v: string, fallback: string) =>
    s.getPropertyValue(v).trim() || fallback;
  return {
    palette: CHART_VARS.map((v, i) => get(v, FALLBACK.palette[i]!)),
    accent: get("--color-chart-1", FALLBACK.accent),
    teal: get("--color-chart-2", FALLBACK.teal),
    grid: get("--color-border", FALLBACK.grid),
    axis: get("--color-muted-foreground", FALLBACK.axis),
  };
}

export function useChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>(FALLBACK);
  useEffect(() => {
    const update = () => {
      const c = readColors();
      if (c) setColors(c);
    };
    update();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return colors;
}

// Gethemede tooltip — CSS-vars resolven wél in HTML inline-styles.
export const chartTooltipProps = {
  contentStyle: {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: "0.5rem",
    color: "var(--color-foreground)",
    fontSize: "0.8125rem",
    boxShadow: "var(--shadow-md)",
    padding: "0.5rem 0.75rem",
  },
  itemStyle: { color: "var(--color-foreground)" },
  labelStyle: { color: "var(--color-muted-foreground)", marginBottom: "0.25rem" },
  cursor: { fill: "var(--color-muted)", opacity: 0.5 },
} as const;
