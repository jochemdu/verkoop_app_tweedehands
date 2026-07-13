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

type ListingRow = {
  id: string;
  status: string | null;
  price: number;
  final_title: string | null;
  generated_title: string | null;
  listing_url: string | null;
  created_at: string | null;
  products:
    | { sticker_id: string | null; working_title: string | null; title: string | null }
    | Array<{ sticker_id: string | null; working_title: string | null; title: string | null }>
    | null;
  platforms: { name: string } | Array<{ name: string }> | null;
};

export default function ListingsScreen() {
  const t = useTranslation("mobile");
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    const { data } = await supabase
      .from("listings")
      .select(
        "id, status, price, final_title, generated_title, listing_url, created_at, products(sticker_id, working_title, title), platforms(name)",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    setListings((data ?? []) as ListingRow[]);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <SafeAreaView style={styles.container}>
      {loading && listings.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />
          }
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>{t("lstEmptyTitle")}</Text>
              <Text style={styles.emptyText}>
                {t("lstEmptyPre")}
                <Text style={{ fontFamily: "Courier" }}>create_listing</Text>
                {t("lstEmptyPost")}
              </Text>
            </View>
          }
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const product = Array.isArray(item.products)
              ? item.products[0]
              : item.products;
            const platform = Array.isArray(item.platforms)
              ? item.platforms[0]
              : item.platforms;
            return (
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>
                    {item.final_title ?? item.generated_title ?? "(geen titel)"}
                  </Text>
                  <Text style={styles.meta}>
                    {product?.sticker_id ?? "—"} · {platform?.name} · €
                    {Number(item.price).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.badgeWrap}>
                  <Text style={statusStyle(item.status)}>{item.status}</Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

function statusStyle(status: string | null) {
  if (status === "published") return styles.badgeGreen;
  if (status === "approved") return styles.badgeBlue;
  if (status === "error") return styles.badgeRed;
  return styles.badgeGray;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { padding: 16 },
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
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 10,
  },
  title: { fontSize: 14, fontWeight: "500" },
  meta: { fontSize: 11, color: "#71717a", marginTop: 2 },
  badgeWrap: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeGray: {
    fontSize: 10,
    color: "#52525b",
    backgroundColor: "#f4f4f5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  badgeBlue: {
    fontSize: 10,
    color: "#1e40af",
    backgroundColor: "#dbeafe",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  badgeGreen: {
    fontSize: 10,
    color: "#166534",
    backgroundColor: "#dcfce7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  badgeRed: {
    fontSize: 10,
    color: "#991b1b",
    backgroundColor: "#fee2e2",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
});
