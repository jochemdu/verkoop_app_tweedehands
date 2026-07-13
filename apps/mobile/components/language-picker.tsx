import { View, Text, Pressable, StyleSheet } from "react-native";
import { LOCALES, type Locale } from "@verkoopassistent/shared";
import { supabase } from "@/lib/supabase";
import { useLocale, useSetLocale, useTranslation } from "@/lib/i18n";

// Taalkiezer (fase 38). Zet de lokale taal direct én spiegelt de keuze naar
// profiles.display_language, zodat web en mobiel gesynchroniseerd blijven.
export function LanguagePicker() {
  const locale = useLocale();
  const setLocale = useSetLocale();
  const tm = useTranslation("mobile");
  const tl = useTranslation("langName");

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
      <Text style={styles.label}>{tm("language")}</Text>
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
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
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
  label: { fontSize: 12, color: "#71717a" },
  row: { flexDirection: "row", gap: 6 },
  chip: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  chipActive: { backgroundColor: "#18181b", borderColor: "#18181b" },
  chipText: { fontSize: 13, fontWeight: "600", color: "#18181b" },
  chipTextActive: { color: "#fff" },
});
