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
import { LanguagePicker } from "@/components/language-picker";

export default function Dashboard() {
  const { session, signOut } = useSession();
  const t = useTranslation("mobile");
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
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.heading}>{t("dashboard")}</Text>
          <Text style={styles.email}>{session?.user.email}</Text>
        </View>

        <View style={styles.statsRow}>
          <Stat label={t("total")} value={totalCount} />
          <Stat label={t("readyForAnalysis")} value={indexedCount} />
        </View>

        <Pressable
          style={styles.primaryAction}
          onPress={() => router.push("/(tabs)/capture")}
        >
          <Text style={styles.primaryActionText}>{t("newProduct")}</Text>
        </Pressable>

        <View style={styles.footer}>
          <LanguagePicker />
          <Pressable style={styles.outlineAction} onPress={signOut}>
            <Text style={styles.outlineActionText}>{t("logout")}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value ?? "—"}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, gap: 16 },
  header: { marginBottom: 4 },
  heading: { fontSize: 24, fontWeight: "600" },
  email: { fontSize: 13, color: "#71717a", marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 12 },
  stat: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 12,
    padding: 16,
  },
  statValue: { fontSize: 28, fontWeight: "700" },
  statLabel: { fontSize: 12, color: "#71717a", marginTop: 4 },
  primaryAction: {
    backgroundColor: "#18181b",
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
  },
  primaryActionText: { color: "#fff", fontSize: 15, fontWeight: "500" },
  footer: { marginTop: "auto", gap: 12 },
  outlineAction: {
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  outlineActionText: { fontSize: 14 },
});
