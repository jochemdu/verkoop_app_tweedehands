import { View, Text, Pressable, StyleSheet } from "react-native";
import { LOCALES, type Locale } from "@verkoopassistent/shared";
import { supabase } from "@/lib/supabase";
import { useLocale, useSetLocale, useTranslation } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

// Taalkiezer (fase 38). Zet de lokale taal direct én spiegelt de keuze naar
// profiles.display_language, zodat web en mobiel gesynchroniseerd blijven.
export function LanguagePicker() {
  const locale = useLocale();
  const setLocale = useSetLocale();
  const tm = useTranslation("mobile");
  const tl = useTranslation("langName");
  const c = useTheme().colors;

  async function choose(next: Locale) {
    if (next === locale) return;
    setLocale(next);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("profiles")
        .update({ display_language: next })
        .eq("id", user.id);
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: c.mutedForeground }]}>
        {tm("language")}
      </Text>
      <View style={styles.row}>
        {LOCALES.map((l) => {
          const active = l === locale;
          return (
            <Pressable
              key={l}
              onPress={() => choose(l)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={tl(l)}
              style={[
                styles.chip,
                { borderColor: c.border },
                active && { backgroundColor: c.accent, borderColor: c.accent },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: active ? c.accentForeground : c.foreground },
                ]}
              >
                {l.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 12 },
  row: { flexDirection: "row", gap: 6 },
  chip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  chipText: { fontSize: 13, fontWeight: "600" },
});
