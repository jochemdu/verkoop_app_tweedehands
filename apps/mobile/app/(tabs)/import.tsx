import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";
import {
  createProductWithPhotos,
  type PhotoInput,
} from "@/lib/products/createProduct";
import { useTranslation } from "@/lib/i18n";

// Fase 32: importeer bestaande foto's uit de camera-roll i.p.v. opnieuw
// fotograferen. Elke foto (of groep) wordt een stub-product; sticker plakken
// en analyseren doe je later. import_candidates houdt bij wat al geïmporteerd
// is (asset_id dedup) zodat je niet dubbel importeert.

type Picked = ImagePicker.ImagePickerAsset;

export default function ImportScreen() {
  const t = useTranslation("mobile");
  const [assets, setAssets] = useState<Picked[]>([]);
  const [onePerPhoto, setOnePerPhoto] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);

  async function pick() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t("noAccess"), t("noAccessMsg"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsMultipleSelection: true,
      selectionLimit: 30,
      quality: 0.9,
      exif: false,
    });
    if (!result.canceled) {
      setAssets(result.assets);
      setDone(0);
    }
  }

  async function recordCandidate(
    userId: string,
    asset: Picked,
    productId: string,
  ) {
    if (!asset.assetId) return; // niet uit de bibliotheek → geen stabiel id
    // Dedup op (user_id, asset_id); upsert markeert direct als geïmporteerd.
    await supabase.from("import_candidates").upsert(
      {
        user_id: userId,
        asset_id: asset.assetId,
        thumbnail_uri: asset.uri,
        imported: true,
        matches_product_id: productId,
      },
      { onConflict: "user_id,asset_id" },
    );
  }

  function toPhotoInput(asset: Picked): PhotoInput {
    return {
      uri: asset.uri,
      captureMode: "camera_roll",
      photoType: "general",
      width: asset.width ?? null,
      height: asset.height ?? null,
    };
  }

  async function runImport() {
    if (assets.length === 0) return;
    setBusy(true);
    setDone(0);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error(t("notLoggedIn"));

      if (onePerPhoto) {
        // Eén stub-product per foto.
        for (let i = 0; i < assets.length; i++) {
          const asset = assets[i]!;
          const { productId } = await createProductWithPhotos({
            userId: user.id,
            photos: [toPhotoInput(asset)],
          });
          await recordCandidate(user.id, asset, productId);
          setDone(i + 1);
        }
        Alert.alert(
          t("imported"),
          t("importedSeparate", { count: assets.length }),
        );
      } else {
        // Alle foto's samen één product.
        const { productId } = await createProductWithPhotos({
          userId: user.id,
          photos: assets.map(toPhotoInput),
        });
        for (const asset of assets) await recordCandidate(user.id, asset, productId);
        setDone(assets.length);
        Alert.alert(t("imported"), t("importedSingle", { count: assets.length }));
      }
      setAssets([]);
    } catch (err) {
      Alert.alert(t("importFailed"), err instanceof Error ? err.message : t("unknown"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("importTitle")}</Text>
        <Text style={styles.subtitle}>{t("importSubtitle")}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>{t("onePerPhoto")}</Text>
        <Switch value={onePerPhoto} onValueChange={setOnePerPhoto} disabled={busy} />
      </View>

      <Pressable
        onPress={pick}
        disabled={busy}
        style={({ pressed }) => [styles.pickBtn, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t("pickPhotosA11y")}
      >
        <Text style={styles.pickBtnText}>
          {assets.length > 0
            ? t("photosChosen", { count: assets.length })
            : t("pickPhotos")}
        </Text>
      </Pressable>

      <FlatList
        data={assets}
        keyExtractor={(a, i) => a.assetId ?? `${a.uri}-${i}`}
        numColumns={3}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => (
          <Image source={{ uri: item.uri }} style={styles.thumb} />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>{t("emptyPhotos")}</Text>
        }
      />

      {assets.length > 0 && (
        <Pressable
          onPress={runImport}
          disabled={busy}
          style={({ pressed }) => [
            styles.importBtn,
            (pressed || busy) && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t("importA11y")}
        >
          {busy ? (
            <View style={styles.busyRow}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.importBtnText}>
                {t("importing", { done, total: assets.length })}
              </Text>
            </View>
          ) : (
            <Text style={styles.importBtnText}>
              {t("importN", { count: assets.length })}
            </Text>
          )}
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#faf9f7", padding: 16, gap: 12 },
  header: { gap: 4 },
  title: { fontSize: 20, fontWeight: "700", color: "#292524" },
  subtitle: { fontSize: 13, color: "#78716c" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e7e2dc",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rowLabel: { fontSize: 14, color: "#292524" },
  pickBtn: {
    borderWidth: 1,
    borderColor: "#e7e2dc",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  pickBtnText: { fontSize: 15, fontWeight: "600", color: "#c2410c" },
  grid: { gap: 4, paddingVertical: 8 },
  thumb: {
    width: "32%",
    aspectRatio: 1,
    margin: "0.66%",
    borderRadius: 8,
    backgroundColor: "#f2efeb",
  },
  empty: { textAlign: "center", color: "#a8a29e", paddingVertical: 40 },
  importBtn: {
    backgroundColor: "#c2410c",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  importBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  busyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pressed: { opacity: 0.7 },
});
