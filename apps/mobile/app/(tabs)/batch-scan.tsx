import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";
import NetInfo from "@react-native-community/netinfo";
import { supabase } from "@/lib/supabase";
import { createProductStub } from "@/lib/products/createProduct";
import { useTranslation } from "@/lib/i18n";

// Fase 47: batch-EAN-scan. Scan meerdere barcodes achter elkaar; elk wordt een
// fotoloos stub-product (met auto-lookup van titel). Sticker/foto's/analyse doe
// je later op de productpagina. Bespaart veel tijd bij dozen vol barcodeproducten.

type ScanStatus = "looking_up" | "ready" | "no_match";

type ScannedItem = {
  ean: string;
  title: string | null;
  status: ScanStatus;
};

async function lookupTitle(code: string): Promise<string | null> {
  const isIsbn = /^97[89]\d{10}$/.test(code) || /^\d{10}$/.test(code);
  const fn = isIsbn ? "lookup-book" : "lookup-ean";
  const key = isIsbn ? "isbn" : "ean";
  try {
    const { data } = await supabase.functions.invoke(fn, {
      body: { [key]: code },
    });
    if (!data?.match) return null;
    if (isIsbn && data.book) {
      const b = data.book;
      return b.title
        ? `${b.title}${b.authors?.[0] ? ` — ${b.authors[0]}` : ""}`
        : null;
    }
    if (!isIsbn && data.product?.name) {
      const brand = data.product.brand ? `${data.product.brand} ` : "";
      return `${brand}${data.product.name}`.trim();
    }
  } catch {
    // netwerk/lookup-fout → alleen barcode bewaren
  }
  return null;
}

export default function BatchScanScreen() {
  const t = useTranslation("mobile");
  const [permission, requestPermission] = useCameraPermissions();
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  // Snelle dedup zonder op state-updates te wachten (camera vuurt hoog freq).
  const seen = useRef<Set<string>>(new Set());
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showFlash(msg: string) {
    setFlash(msg);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 1200);
  }

  async function onScanned(result: BarcodeScanningResult) {
    const code = result.data?.trim();
    if (!code || saving) return;
    if (seen.current.has(code)) {
      showFlash(t("batchDuplicate"));
      return;
    }
    seen.current.add(code);
    setItems((prev) => [{ ean: code, title: null, status: "looking_up" }, ...prev]);
    showFlash(t("batchAdded"));

    const title = await lookupTitle(code);
    setItems((prev) =>
      prev.map((it) =>
        it.ean === code
          ? { ...it, title, status: title ? "ready" : "no_match" }
          : it,
      ),
    );
  }

  function remove(ean: string) {
    seen.current.delete(ean);
    setItems((prev) => prev.filter((it) => it.ean !== ean));
  }

  function clearAll() {
    seen.current.clear();
    setItems([]);
  }

  async function saveAll() {
    if (items.length === 0) return;
    const net = await NetInfo.fetch();
    if (net.isConnected === false) {
      Alert.alert(t("batchOfflineTitle"), t("batchOfflineMsg"));
      return;
    }
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error(t("notLoggedIn"));

      let ok = 0;
      let failed = 0;
      // Nieuwste bovenaan; opslaan in scanvolgorde (oud → nieuw).
      for (const it of [...items].reverse()) {
        try {
          await createProductStub({
            userId: user.id,
            ean: it.ean,
            workingTitle: it.title,
          });
          ok++;
        } catch {
          failed++;
        }
      }

      if (failed === 0) {
        Alert.alert(t("batchSaved"), t("batchSavedMsg", { count: ok }));
      } else {
        Alert.alert(
          t("batchSaved"),
          `${t("batchSavedMsg", { count: ok })} · ${t("batchItemFailed", { count: failed })}`,
        );
      }
      clearAll();
    } catch (err) {
      Alert.alert(
        t("batchSaveFailed"),
        err instanceof Error ? err.message : t("unknown"),
      );
    } finally {
      setSaving(false);
    }
  }

  if (!permission) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.permTitle}>{t("cameraPermTitle")}</Text>
        <Text style={styles.permText}>{t("cameraPermMsg")}</Text>
        <Pressable style={styles.primaryBtn} onPress={requestPermission}>
          <Text style={styles.primaryBtnText}>{t("allowAccess")}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.cameraWrap}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"],
          }}
          onBarcodeScanned={saving ? undefined : onScanned}
        />
        <View style={styles.scanHint}>
          <Text style={styles.scanHintText}>
            {flash ?? t("batchScanning")}
          </Text>
        </View>
        <View style={styles.counter}>
          <Text style={styles.counterText}>{items.length}</Text>
        </View>
      </View>

      <View style={styles.listWrap}>
        <FlatList
          data={items}
          keyExtractor={(it) => it.ean}
          ListEmptyComponent={<Text style={styles.empty}>{t("batchEmpty")}</Text>}
          renderItem={({ item }) => (
            <View style={styles.itemRow}>
              <View style={styles.itemMain}>
                <Text style={styles.itemEan}>{item.ean}</Text>
                <Text
                  style={[
                    styles.itemTitle,
                    item.status === "no_match" && styles.itemTitleMuted,
                  ]}
                  numberOfLines={1}
                >
                  {item.status === "looking_up"
                    ? t("batchLookingUp")
                    : item.status === "no_match"
                    ? t("batchNoMatch")
                    : item.title}
                </Text>
              </View>
              <Pressable onPress={() => remove(item.ean)} hitSlop={8}>
                <Text style={styles.removeX}>×</Text>
              </Pressable>
            </View>
          )}
        />
      </View>

      {items.length > 0 && (
        <View style={styles.actions}>
          <Pressable
            onPress={clearAll}
            disabled={saving}
            style={[styles.clearBtn, saving && styles.disabled]}
          >
            <Text style={styles.clearBtnText}>{t("batchClear")}</Text>
          </Pressable>
          <Pressable
            onPress={saveAll}
            disabled={saving}
            style={[styles.saveBtn, saving && styles.disabled]}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>
                {t("batchSaveN", { count: items.length })}
              </Text>
            )}
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  permTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  permText: { fontSize: 14, color: "#71717a", textAlign: "center", marginBottom: 16 },
  primaryBtn: {
    backgroundColor: "#18181b",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "500" },

  cameraWrap: { height: "42%", position: "relative" },
  camera: { flex: 1 },
  scanHint: {
    position: "absolute",
    bottom: 12,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  scanHintText: { color: "#fff", fontSize: 13, fontWeight: "500" },
  counter: {
    position: "absolute",
    top: 12,
    right: 12,
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#c2410c",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  counterText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  listWrap: { flex: 1, backgroundColor: "#faf9f7" },
  empty: { textAlign: "center", color: "#a8a29e", paddingVertical: 40 },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eae6e1",
    gap: 12,
  },
  itemMain: { flex: 1, gap: 2 },
  itemEan: { fontSize: 12, color: "#78716c", fontFamily: "Courier" },
  itemTitle: { fontSize: 14, color: "#292524" },
  itemTitleMuted: { color: "#a8a29e", fontStyle: "italic" },
  removeX: { fontSize: 22, color: "#dc2626", fontWeight: "700", paddingHorizontal: 4 },

  actions: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    backgroundColor: "#faf9f7",
    borderTopWidth: 1,
    borderTopColor: "#eae6e1",
  },
  clearBtn: {
    borderWidth: 1,
    borderColor: "#e7e2dc",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  clearBtnText: { color: "#78716c", fontSize: 15, fontWeight: "600" },
  saveBtn: {
    flex: 1,
    backgroundColor: "#c2410c",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  disabled: { opacity: 0.5 },
});
