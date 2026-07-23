import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";
import { addPhotosToProduct } from "@/lib/products/createProduct";
import { useTranslation } from "@/lib/i18n";
import { useTheme, font } from "@/lib/theme";

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
  const theme = useTheme();
  const c = theme.colors;
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // Foto's toevoegen aan een bestaand product: camera of galerij, dan direct
  // uploaden en de rij verversen.
  async function pickAndUpload(productId: string, source: "camera" | "gallery") {
    try {
      let result: ImagePicker.ImagePickerResult;
      if (source === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(t("cameraPermTitle"), t("cameraPermMsg"));
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: "images",
          quality: 0.8,
        });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(t("cameraPermTitle"), t("cameraPermMsg"));
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: "images",
          allowsMultipleSelection: true,
          selectionLimit: 10,
          quality: 0.8,
        });
      }
      if (result.canceled) return;
      const assets = result.assets ?? [];
      if (assets.length === 0) return;

      setUploadingId(productId);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error(t("notLoggedIn"));
      const { added } = await addPhotosToProduct({
        userId: user.id,
        productId,
        photos: assets.map((a) => ({
          uri: a.uri,
          captureMode: source,
          width: a.width ?? null,
          height: a.height ?? null,
        })),
      });
      Alert.alert(t("addPhotoTitle"), t("addPhotoDone", { count: added }));
    } catch (err) {
      Alert.alert(
        t("addPhotoFail"),
        err instanceof Error ? err.message : t("unknown"),
      );
    } finally {
      setUploadingId(null);
    }
  }

  function onRowPress(productId: string) {
    Alert.alert(t("addPhotoTitle"), undefined, [
      { text: t("addPhotoCamera"), onPress: () => pickAndUpload(productId, "camera") },
      { text: t("addPhotoGallery"), onPress: () => pickAndUpload(productId, "gallery") },
      { text: t("addPhotoCancel"), style: "cancel" },
    ]);
  }

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    const { data, error: err } = await supabase
      .from("products")
      .select(
        "id, sticker_id, working_title, title, category_slug, status, indexed_at",
      )
      .order("indexed_at", { ascending: false })
      .limit(100);
    // Onderscheid een echte fout van een lege lijst: anders toont het scherm
    // "geen producten" terwijl de query faalde (netwerk/RLS).
    if (err) {
      setError(true);
    } else {
      setError(false);
      setProducts(data ?? []);
    }
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
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      {loading && products.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.accent} />
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
              tintColor={c.accent}
            />
          }
          ListEmptyComponent={
            error ? (
              <View style={[styles.emptyCard, { borderColor: c.destructive }]}>
                <Text style={[styles.emptyTitle, { color: c.foreground }]}>
                  {t("loadErrorTitle")}
                </Text>
                <Text style={[styles.emptyText, { color: c.mutedForeground }]}>
                  {t("loadErrorText")}
                </Text>
              </View>
            ) : (
              <View style={[styles.emptyCard, { borderColor: c.border }]}>
                <Text style={[styles.emptyTitle, { color: c.foreground }]}>
                  {t("invEmptyTitle")}
                </Text>
                <Text style={[styles.emptyText, { color: c.mutedForeground }]}>
                  {t("invEmptyText")}
                </Text>
              </View>
            )
          }
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onRowPress(item.id)}
              disabled={uploadingId === item.id}
              accessibilityRole="button"
              accessibilityLabel={t("addPhotoTitle")}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: c.card, borderColor: c.border },
                theme.shadow,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[styles.sticker, { color: c.accent }]}>
                {item.sticker_id ?? "—"}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: c.foreground }]}>
                  {item.title ?? item.working_title ?? t("noTitle")}
                </Text>
                <Text style={[styles.meta, { color: c.mutedForeground }]}>
                  {item.category_slug} · {item.status}
                </Text>
              </View>
              {uploadingId === item.id ? (
                <ActivityIndicator color={c.accent} />
              ) : (
                <Text style={[styles.addPhoto, { color: c.accent }]}>＋📷</Text>
              )}
            </Pressable>
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
  emptyText: { fontSize: 13, color: "#78716c" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e7e2dc",
    borderRadius: 10,
  },
  sticker: {
    fontFamily: font.mono,
    fontWeight: "700",
    width: 50,
    fontSize: 14,
  },
  title: { fontSize: 14, fontWeight: "500" },
  meta: { fontSize: 11, color: "#78716c", marginTop: 2 },
  addPhoto: { fontSize: 16, fontWeight: "600", paddingLeft: 4 },
});
