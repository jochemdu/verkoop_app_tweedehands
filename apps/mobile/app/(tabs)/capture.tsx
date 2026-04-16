import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";
import { stickerIdSchema } from "@verkoopassistent/shared";

type CapturedPhoto = {
  uri: string;
  fileName: string;
};

export default function CaptureScreen() {
  const [stickerId, setStickerId] = useState("");
  const [workingTitle, setWorkingTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [saving, setSaving] = useState(false);
  const [lastUsed, setLastUsed] = useState<number | null>(null);

  // Haal laatst gebruikte sticker-ID op om een suggestie te kunnen tonen.
  useEffect(() => {
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "last_sticker_number")
      .maybeSingle()
      .then(({ data }) => {
        const n = Number(data?.value ?? 0);
        if (n > 0) {
          setLastUsed(n);
          setStickerId(String(n + 1).padStart(4, "0"));
        }
      });
  }, []);

  async function launchCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Camera toegang nodig", "Geef toestemming via instellingen.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: false,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPhotos((p) => [
        ...p,
        {
          uri: asset.uri,
          fileName: asset.fileName ?? `capture_${Date.now()}.jpg`,
        },
      ]);
    }
  }

  async function launchGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 8,
    });
    if (!result.canceled) {
      setPhotos((p) => [
        ...p,
        ...result.assets.map((a) => ({
          uri: a.uri,
          fileName: a.fileName ?? `gallery_${Date.now()}.jpg`,
        })),
      ]);
    }
  }

  async function save() {
    if (photos.length === 0) {
      Alert.alert("Voeg eerst minstens één foto toe");
      return;
    }
    const parsed = stickerIdSchema.optional().safeParse(stickerId || undefined);
    if (!parsed.success) {
      Alert.alert("Ongeldig sticker-ID", "Moet exact 4 cijfers zijn (bijv. 0042).");
      return;
    }

    setSaving(true);
    try {
      // Upload foto's naar Storage via fetch → blob.
      const paths: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i]!;
        const response = await fetch(photo.uri);
        const blob = await response.blob();
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        const path = `inbox/${ts}_${i}_${photo.fileName}`;
        const { error } = await supabase.storage
          .from("product-photos")
          .upload(path, blob, { contentType: "image/jpeg" });
        if (error) throw new Error(`Upload faalde: ${error.message}`);
        paths.push(path);
      }

      // Maak product + photos via Supabase client (RLS staat insert toe).
      const { data: product, error: productErr } = await supabase
        .from("products")
        .insert({
          sticker_id: stickerId || null,
          sticker_input_method: stickerId ? "manual" : null,
          working_title: workingTitle || null,
          indexing_notes: notes || null,
        })
        .select()
        .single();
      if (productErr) {
        // Cleanup bij fout.
        await supabase.storage.from("product-photos").remove(paths);
        throw new Error(productErr.message);
      }

      await supabase.from("photos").insert(
        paths.map((path, idx) => ({
          product_id: product.id,
          storage_path: path,
          order_index: idx,
          photo_type: "general" as const,
        })),
      );

      // Bump teller.
      if (stickerId) {
        await supabase
          .from("app_settings")
          .update({ value: parseInt(stickerId, 10) })
          .eq("key", "last_sticker_number");
      }

      Alert.alert(
        "Opgeslagen",
        `${photos.length} foto('s) vastgelegd onder ${stickerId || "(zonder sticker)"}.`,
      );

      // Reset form, auto-increment sticker voor volgende sessie.
      setPhotos([]);
      setWorkingTitle("");
      setNotes("");
      if (stickerId) {
        const next = parseInt(stickerId, 10) + 1;
        setStickerId(String(next).padStart(4, "0"));
        setLastUsed(parseInt(stickerId, 10));
      }
    } catch (err) {
      Alert.alert("Fout", err instanceof Error ? err.message : "onbekend");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.label}>Sticker-ID</Text>
          <TextInput
            value={stickerId}
            onChangeText={setStickerId}
            placeholder="0042"
            keyboardType="number-pad"
            maxLength={4}
            style={styles.inputMono}
          />
          {lastUsed !== null && (
            <Text style={styles.hint}>
              Laatst gebruikt: {String(lastUsed).padStart(4, "0")}
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Werktitel (optioneel)</Text>
          <TextInput
            value={workingTitle}
            onChangeText={setWorkingTitle}
            placeholder="bv. DDR2 SODIMM"
            style={styles.input}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Notitie (optioneel)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="bv. kast in garage links"
            multiline
            style={[styles.input, { minHeight: 60 }]}
          />
        </View>

        <View style={styles.buttonRow}>
          <Pressable style={styles.buttonHalf} onPress={launchCamera}>
            <Text style={styles.buttonText}>📸 Camera</Text>
          </Pressable>
          <Pressable style={styles.buttonHalfAlt} onPress={launchGallery}>
            <Text style={styles.buttonTextAlt}>🖼 Galerij</Text>
          </Pressable>
        </View>

        {photos.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.label}>Foto's ({photos.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {photos.map((p, i) => (
                <View key={i} style={styles.thumbWrap}>
                  <Image source={{ uri: p.uri }} style={styles.thumb} />
                  <Pressable
                    style={styles.removeBtn}
                    onPress={() =>
                      setPhotos((prev) => prev.filter((_, j) => j !== i))
                    }
                  >
                    <Text style={styles.removeBtnText}>×</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        <Pressable
          style={[styles.saveButton, saving && { opacity: 0.5 }]}
          disabled={saving || photos.length === 0}
          onPress={save}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Opslaan</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 12, paddingBottom: 40 },
  card: { borderWidth: 1, borderColor: "#e4e4e7", borderRadius: 10, padding: 12 },
  label: { fontSize: 12, color: "#71717a", marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
  },
  inputMono: {
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 8,
    padding: 10,
    fontSize: 18,
    fontFamily: "Courier",
    letterSpacing: 2,
  },
  hint: { fontSize: 11, color: "#a1a1aa", marginTop: 4 },
  buttonRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  buttonHalf: {
    flex: 1,
    backgroundColor: "#18181b",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  buttonHalfAlt: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "500" },
  buttonTextAlt: { color: "#18181b", fontSize: 15, fontWeight: "500" },
  thumbWrap: { marginRight: 8, position: "relative" },
  thumb: { width: 90, height: 90, borderRadius: 6 },
  removeBtn: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtnText: { color: "#fff", fontSize: 14, fontWeight: "700", lineHeight: 16 },
  saveButton: {
    backgroundColor: "#16a34a",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
