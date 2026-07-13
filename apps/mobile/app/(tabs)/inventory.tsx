import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "@/lib/i18n";

type ProductRow = {
  id: string;
  sticker_id: string | null;
  working_title: string | null;
  title: string | null;
  category_slug: string | null;
  status: string | null;
  indexed_at: string | null;
};

export default function InventoryScreen() {
  const t = useTranslation("mobile");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    const { data } = await supabase
      .from("products")
      .select(
        "id, sticker_id, working_title, title, category_slug, status, indexed_at",
      )
      .order("indexed_at", { ascending: false })
      .limit(100);
    setProducts(data ?? []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  // Reload elke keer dat het scherm focus krijgt.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <SafeAreaView style={styles.container}>
      {loading && products.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>{t("invEmptyTitle")}</Text>
              <Text style={styles.emptyText}>{t("invEmptyText")}</Text>
            </View>
          }
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.sticker}>
                {item.sticker_id ?? "—"}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>
                  {item.title ?? item.working_title ?? t("noTitle")}
                </Text>
                <Text style={styles.meta}>
                  {item.category_slug} · {item.status}
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { padding: 16, gap: 0 },
  separator: { height: 8 },
  emptyCard: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#d4d4d8",
    borderRadius: 10,
    padding: 20,
    marginTop: 20,
  },
  emptyTitle: { fontSize: 15, fontWeight: "600", marginBottom: 4 },
  emptyText: { fontSize: 13, color: "#71717a" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 10,
  },
  sticker: {
    fontFamily: "Courier",
    fontWeight: "700",
    width: 50,
    fontSize: 14,
  },
  title: { fontSize: 14, fontWeight: "500" },
  meta: { fontSize: 11, color: "#71717a", marginTop: 2 },
});
