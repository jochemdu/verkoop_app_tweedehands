import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/auth/useSession";
import { useTranslation } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { LanguagePicker } from "@/components/language-picker";

export default function Dashboard() {
  const { session, signOut } = useSession();
  const t = useTranslation("mobile");
  const theme = useTheme();
  const c = theme.colors;
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [indexedCount, setIndexedCount] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const [total, indexed] = await Promise.all([
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase
          .from("products")
          .select("*", { count: "exact", head: true })
          .eq("status", "indexed"),
      ]);
      setTotalCount(total.count ?? 0);
      setIndexedCount(indexed.count ?? 0);
    })();
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={[styles.heading, { color: c.foreground }]}>
            {t("dashboard")}
          </Text>
          <Text style={[styles.email, { color: c.mutedForeground }]}>
            {session?.user.email}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <Stat label={t("total")} value={totalCount} />
          <Stat label={t("readyForAnalysis")} value={indexedCount} />
        </View>

        <Pressable
          style={[styles.primaryAction, { backgroundColor: c.accent }, theme.shadow]}
          onPress={() => router.push("/(tabs)/capture")}
        >
          <Text style={[styles.primaryActionText, { color: c.accentForeground }]}>
            {t("newProduct")}
          </Text>
        </Pressable>

        <View style={styles.footer}>
          <LanguagePicker />
          <Pressable
            style={[styles.outlineAction, { borderColor: c.border }]}
            onPress={signOut}
          >
            <Text style={[styles.outlineActionText, { color: c.foreground }]}>
              {t("logout")}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  function Stat({ label, value }: { label: string; value: number | null }) {
    return (
      <View
        style={[
          styles.stat,
          { backgroundColor: c.card, borderColor: c.border },
          theme.shadow,
        ]}
      >
        <Text style={[styles.statValue, { color: c.foreground }]}>
          {value ?? "—"}
        </Text>
        <Text style={[styles.statLabel, { color: c.mutedForeground }]}>
          {label}
        </Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, gap: 16, flexGrow: 1 },
  header: { marginBottom: 4 },
  heading: { fontSize: 24, fontWeight: "600" },
  email: { fontSize: 13, marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 12 },
  stat: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  statValue: { fontSize: 28, fontWeight: "700" },
  statLabel: { fontSize: 12, marginTop: 4 },
  primaryAction: {
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
  },
  primaryActionText: { fontSize: 15, fontWeight: "600" },
  footer: { marginTop: "auto", gap: 12 },
  outlineAction: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  outlineActionText: { fontSize: 14 },
});
