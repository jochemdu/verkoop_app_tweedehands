import { useColorScheme } from "react-native";

// Gedeeld mobiel thema (fase 56) — spiegelt de "Warm Atelier"-tokens van de
// web-app (globals.css) zodat mobiel en web visueel matchen. Warme inkt +
// terracotta i.p.v. koud zink. Reactief op licht/donker via useColorScheme.

const light = {
  background: "#faf9f7",
  card: "#ffffff",
  foreground: "#292524",
  mutedForeground: "#78716c",
  border: "#e7e2dc",
  muted: "#f2efeb",
  accent: "#c2410c",
  accentForeground: "#ffffff",
  accentSoft: "#fdf0e7",
  success: "#15803d",
  warning: "#b45309",
  destructive: "#dc2626",
};

const dark: typeof light = {
  background: "#171412",
  card: "#201c19",
  foreground: "#edeae6",
  mutedForeground: "#a8a29e",
  border: "#35302b",
  muted: "#282320",
  accent: "#fb923c",
  accentForeground: "#2a1204",
  accentSoft: "#33200e",
  success: "#4ade80",
  warning: "#fbbf24",
  destructive: "#f87171",
};

export type ThemeColors = typeof light;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 } as const;
export const radius = { sm: 8, md: 10, lg: 12, xl: 16, pill: 9999 } as const;
export const font = { mono: "Courier" } as const;

export type Theme = {
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  font: typeof font;
  shadow: {
    shadowColor: string;
    shadowOpacity: number;
    shadowRadius: number;
    shadowOffset: { width: number; height: number };
    elevation: number;
  };
  scheme: "light" | "dark";
};

export function useTheme(): Theme {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = scheme === "dark" ? dark : light;
  const shadow =
    scheme === "dark"
      ? {
          shadowColor: "#000",
          shadowOpacity: 0.5,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3,
        }
      : {
          shadowColor: "#292524",
          shadowOpacity: 0.06,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 2,
        };
  return { colors, spacing, radius, font, shadow, scheme };
}
