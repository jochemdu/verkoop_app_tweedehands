import { useEffect, useRef, useState } from "react";
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
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";
import TextRecognition from "@react-native-ml-kit/text-recognition";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
  type ExpoSpeechRecognitionResultEvent,
} from "expo-speech-recognition";
import { supabase } from "@/lib/supabase";
import { stickerIdSchema } from "@verkoopassistent/shared";
import { parseClothingLabel } from "@/lib/clothing-parser";

type CapturedPhoto = {
  uri: string;
  width?: number;
  height?: number;
  source: "sticker_ocr" | "product" | "barcode";
};

type Mode = "ocr_separate" | "ocr_inline" | "manual";

export default function CaptureScreen() {
  const [permission, requestPermission] = useCameraPermissions();

  const [mode, setMode] = useState<Mode>("ocr_separate");
  const [stickerId, setStickerId] = useState("");
  const [stickerConfidence, setStickerConfidence] = useState<number | null>(null);
  const [workingTitle, setWorkingTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [ean, setEan] = useState("");
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [saving, setSaving] = useState(false);
  const [lastUsed, setLastUsed] = useState<number | null>(null);

  // Phase tracks waar de gebruiker zit in de flow.
  // 'configure' = instellen mode + sticker, 'capture' = foto's maken, 'done' = klaar om op te slaan.
  const [phase, setPhase] = useState<"configure" | "capture">("configure");
  const [cameraMode, setCameraMode] = useState<
    "sticker" | "product" | "barcode" | "clothing_label"
  >("sticker");
  const [recording, setRecording] = useState(false);
  // Feat 18: kledingkast-bulk — auto-detectie uit OCR label.
  const [clothingBrand, setClothingBrand] = useState<string | null>(null);
  const [clothingSize, setClothingSize] = useState<string | null>(null);
  const [clothingMaterial, setClothingMaterial] = useState<string | null>(null);

  // Voice-to-text: append transcribed speech to notes (Feat 1).
  useSpeechRecognitionEvent("result", (event: ExpoSpeechRecognitionResultEvent) => {
    const transcript = event.results?.[0]?.transcript;
    if (transcript && event.isFinal) {
      setNotes((prev) => (prev ? `${prev} ${transcript}` : transcript));
    }
  });
  useSpeechRecognitionEvent("end", () => setRecording(false));
  useSpeechRecognitionEvent("error", () => setRecording(false));

  async function startVoice() {
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Microfoon-toegang nodig", "Geef permissie in instellingen.");
        return;
      }
      ExpoSpeechRecognitionModule.start({
        lang: "nl-NL",
        interimResults: false,
        continuous: false,
      });
      setRecording(true);
    } catch (err) {
      Alert.alert("Voice fout", err instanceof Error ? err.message : "onbekend");
    }
  }

  function stopVoice() {
    ExpoSpeechRecognitionModule.stop();
    setRecording(false);
  }
  const [ocrProcessing, setOcrProcessing] = useState(false);

  const cameraRef = useRef<CameraView>(null);

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

  async function runOcr(uri: string): Promise<string[]> {
    const result = await TextRecognition.recognize(uri);
    // Zoek alle 4-cijferige sequenties met word boundary.
    const candidates = new Set<string>();
    for (const block of result.blocks) {
      const matches = block.text.match(/\b\d{4}\b/g);
      if (matches) matches.forEach((m) => candidates.add(m));
    }
    return Array.from(candidates);
  }

  async function captureStickerPhoto() {
    if (!cameraRef.current) return;
    setOcrProcessing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: false,
      });
      if (!photo) return;

      const candidates = await runOcr(photo.uri);
      if (candidates.length === 0) {
        Alert.alert(
          "Geen 4-cijferig nummer gevonden",
          "Probeer de foto dichter op de sticker te nemen, of schakel naar Handmatig mode.",
        );
        return;
      }

      // Bij meerdere kandidaten: vraag user te kiezen.
      if (candidates.length > 1) {
        Alert.alert(
          "Meerdere nummers gevonden",
          `Gevonden: ${candidates.join(", ")}. Welke is de sticker?`,
          candidates.map((c) => ({
            text: c,
            onPress: () => {
              setStickerId(c);
              setStickerConfidence(0.85);
              setPhotos((p) => [...p, { uri: photo.uri, source: "sticker_ocr" }]);
              if (mode === "ocr_separate") setCameraMode("product");
            },
          })),
        );
      } else {
        setStickerId(candidates[0]!);
        setStickerConfidence(0.95);
        setPhotos((p) => [...p, { uri: photo.uri, source: "sticker_ocr" }]);
        if (mode === "ocr_separate") setCameraMode("product");
      }
    } catch (err) {
      Alert.alert("OCR fout", err instanceof Error ? err.message : "onbekend");
    } finally {
      setOcrProcessing(false);
    }
  }

  async function captureProductPhoto() {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!photo) return;

      // Bij ocr_inline: probeer ook OCR op deze productfoto zodat sticker
      // automatisch herkend wordt als hij in beeld staat.
      if (mode === "ocr_inline" && !stickerId) {
        setOcrProcessing(true);
        const candidates = await runOcr(photo.uri);
        if (candidates.length === 1) {
          setStickerId(candidates[0]!);
          setStickerConfidence(0.75);
        } else if (candidates.length > 1) {
          Alert.alert(
            "Meerdere nummers in beeld",
            `Kies de sticker: ${candidates.join(", ")}`,
            candidates.map((c) => ({
              text: c,
              onPress: () => {
                setStickerId(c);
                setStickerConfidence(0.7);
              },
            })),
          );
        }
        setOcrProcessing(false);
      }

      setPhotos((p) => [...p, { uri: photo.uri, source: "product" }]);
    } catch (err) {
      Alert.alert("Foto fout", err instanceof Error ? err.message : "onbekend");
    }
  }

  // Feat 18: kledingkast-bulk — macro-foto van label → OCR → parse brand/size.
  async function captureClothingLabel() {
    if (!cameraRef.current) return;
    setOcrProcessing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (!photo) return;
      const result = await TextRecognition.recognize(photo.uri);
      const allText = result.blocks.map((b) => b.text).join(" ");
      const parsed = parseClothingLabel(allText);

      if (parsed.brand) setClothingBrand(parsed.brand);
      if (parsed.size) setClothingSize(parsed.size);
      if (parsed.material) setClothingMaterial(parsed.material);

      // Combineer in werktitel als die nog leeg is.
      const parts = [parsed.brand, parsed.size].filter(Boolean);
      if (parts.length > 0 && !workingTitle) {
        setWorkingTitle(parts.join(" — "));
      }
      const extraNote = [
        parsed.material ? `Materiaal: ${parsed.material}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      if (extraNote) setNotes((prev) => (prev ? `${prev}\n${extraNote}` : extraNote));

      setPhotos((p) => [...p, { uri: photo.uri, source: "product" }]);
      setCameraMode("product");
    } catch (err) {
      Alert.alert("Label OCR fout", err instanceof Error ? err.message : "onbekend");
    } finally {
      setOcrProcessing(false);
    }
  }

  async function handleBarcodeScanned(result: BarcodeScanningResult) {
    if (ean) return;
    setEan(result.data);
    setCameraMode("product");
    // Feat 3 + 19: auto-lookup. ISBN-13 begint met 978/979. Verder alles als EAN.
    try {
      const isIsbn = /^97[89]\d{10}$/.test(result.data) || /^\d{10}$/.test(result.data);
      const fn = isIsbn ? "lookup-book" : "lookup-ean";
      const key = isIsbn ? "isbn" : "ean";
      const { data } = await supabase.functions.invoke(fn, { body: { [key]: result.data } });
      if (!data?.match) return;
      if (isIsbn && data.book) {
        const b = data.book;
        const t = b.title ? `${b.title}${b.authors?.[0] ? ` — ${b.authors[0]}` : ""}` : "";
        if (t && !workingTitle) setWorkingTitle(t);
        const extra = [b.publisher && `Uitgever: ${b.publisher}`, b.year && `Jaar: ${b.year}`, b.language && `Taal: ${b.language}`].filter(Boolean).join(" · ");
        if (extra) setNotes((prev) => (prev ? `${prev}\n${extra}` : extra));
      } else if (!isIsbn && data.product) {
        if (data.product.name && !workingTitle) {
          const brand = data.product.brand ? `${data.product.brand} ` : "";
          setWorkingTitle(`${brand}${data.product.name}`.trim());
        }
      }
    } catch {
      // silent
    }
  }

  async function save() {
    if (photos.length === 0) {
      Alert.alert("Voeg eerst minstens één foto toe");
      return;
    }
    const parsed = stickerIdSchema.optional().safeParse(stickerId || undefined);
    if (!parsed.success) {
      Alert.alert("Ongeldig sticker-ID", "Moet exact 4 cijfers zijn.");
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Niet ingelogd");
      const paths: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i]!;
        const response = await fetch(photo.uri);
        const blob = await response.blob();
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        const path = `${user.id}/inbox/${ts}_${i}_${photo.source}.jpg`;
        const { error } = await supabase.storage
          .from("product-photos")
          .upload(path, blob, { contentType: "image/jpeg" });
        if (error) throw new Error(`Upload faalde: ${error.message}`);
        paths.push(path);
      }

      const inputMethod =
        mode === "manual"
          ? "manual"
          : mode === "ocr_separate"
          ? "ocr_separate"
          : "ocr_inline";

      const { data: product, error: productErr } = await supabase
        .from("products")
        .insert({
          sticker_id: stickerId || null,
          sticker_input_method: stickerId ? inputMethod : null,
          sticker_confidence: stickerConfidence,
          working_title: workingTitle || null,
          indexing_notes: notes || null,
          ean: ean || null,
        })
        .select()
        .single();
      if (productErr) {
        await supabase.storage.from("product-photos").remove(paths);
        throw new Error(productErr.message);
      }

      await supabase.from("photos").insert(
        paths.map((path, idx) => ({
          product_id: product.id,
          storage_path: path,
          order_index: idx,
          photo_type:
            photos[idx]?.source === "sticker_ocr" ? ("sticker" as const) : ("general" as const),
          capture_mode: photos[idx]?.source,
          sticker_visible: photos[idx]?.source === "sticker_ocr",
          detected_sticker:
            photos[idx]?.source === "sticker_ocr" ? stickerId : null,
          ocr_confidence:
            photos[idx]?.source === "sticker_ocr" ? stickerConfidence : null,
        })),
      );

      if (stickerId) {
        await supabase
          .from("app_settings")
          .update({ value: parseInt(stickerId, 10) })
          .eq("key", "last_sticker_number");
      }

      Alert.alert(
        "Opgeslagen",
        `${photos.length} foto('s) onder ${stickerId || "(zonder sticker)"}.`,
      );

      // Reset voor volgende sessie
      setPhotos([]);
      setWorkingTitle("");
      setNotes("");
      setEan("");
      setStickerConfidence(null);
      if (stickerId) {
        const next = parseInt(stickerId, 10) + 1;
        setStickerId(String(next).padStart(4, "0"));
        setLastUsed(parseInt(stickerId, 10));
      }
      setPhase("configure");
      setCameraMode("sticker");
    } catch (err) {
      Alert.alert("Fout", err instanceof Error ? err.message : "onbekend");
    } finally {
      setSaving(false);
    }
  }

  // Permission handling
  if (!permission) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.permissionTitle}>Camera-toegang nodig</Text>
        <Text style={styles.permissionText}>
          VerkoopAssistent heeft de camera nodig voor product- en stickerfoto's.
        </Text>
        <Pressable style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>Toegang toestaan</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // Configure phase: mode, sticker, context invullen
  if (phase === "configure") {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.card}>
            <Text style={styles.label}>Sticker-modus</Text>
            <View style={styles.modeRow}>
              <ModeChip
                active={mode === "ocr_separate"}
                onPress={() => setMode("ocr_separate")}
                label="Eerst sticker-foto"
                hint="Hoge OCR zekerheid"
              />
              <ModeChip
                active={mode === "ocr_inline"}
                onPress={() => setMode("ocr_inline")}
                label="OCR in productfoto"
                hint="Sneller"
              />
              <ModeChip
                active={mode === "manual"}
                onPress={() => setMode("manual")}
                label="Handmatig"
                hint="Offline"
              />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Sticker-ID</Text>
            <TextInput
              value={stickerId}
              onChangeText={(v) => {
                setStickerId(v);
                setStickerConfidence(null);
              }}
              placeholder="0042 (of laat leeg voor OCR)"
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
              placeholder="bijv. DDR2 SODIMM"
              style={styles.input}
            />
          </View>

          <View style={styles.card}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Notitie (optioneel)</Text>
              <Pressable
                onPress={recording ? stopVoice : startVoice}
                style={[styles.micButton, recording && styles.micButtonActive]}
              >
                <Text style={recording ? styles.micTextActive : styles.micText}>
                  {recording ? "● Stop" : "🎤 Spreek"}
                </Text>
              </Pressable>
            </View>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="kast in garage links (of tik mic om te dicteren)"
              multiline
              style={[styles.input, { minHeight: 60 }]}
            />
          </View>

          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              setPhase("capture");
              if (mode === "manual" || stickerId) setCameraMode("product");
              else setCameraMode("sticker");
            }}
          >
            <Text style={styles.primaryButtonText}>Naar camera →</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Capture phase: live camera view
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => setPhase("configure")}>
          <Text style={styles.backText}>← Terug</Text>
        </Pressable>
        <Text style={styles.topBarTitle}>
          {stickerId ? `Sticker ${stickerId}` : "Geen sticker"}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.cameraModeRow}>
        <CameraModeChip
          active={cameraMode === "sticker"}
          onPress={() => setCameraMode("sticker")}
          label="Sticker"
          disabled={mode === "manual" || !!stickerId}
        />
        <CameraModeChip
          active={cameraMode === "product"}
          onPress={() => setCameraMode("product")}
          label="Product"
        />
        <CameraModeChip
          active={cameraMode === "barcode"}
          onPress={() => setCameraMode("barcode")}
          label="Barcode"
        />
        <CameraModeChip
          active={cameraMode === "clothing_label"}
          onPress={() => setCameraMode("clothing_label")}
          label="Label"
        />
      </View>

      <View style={styles.cameraWrap}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "qr"],
          }}
          onBarcodeScanned={cameraMode === "barcode" ? handleBarcodeScanned : undefined}
        />
        {ocrProcessing && (
          <View style={styles.ocrOverlay}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.ocrText}>
              {cameraMode === "clothing_label" ? "Label lezen…" : "Sticker lezen…"}
            </Text>
          </View>
        )}
        {(clothingBrand || clothingSize) && (
          <View style={styles.clothingBadge}>
            <Text style={styles.clothingBadgeText}>
              {[clothingBrand, clothingSize, clothingMaterial].filter(Boolean).join(" · ")}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.bottomBar}>
        {photos.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbStrip}>
            {photos.map((p, i) => (
              <View key={i} style={styles.thumbWrap}>
                <Image source={{ uri: p.uri }} style={styles.thumb} />
                <Pressable
                  style={styles.removeBtn}
                  onPress={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                >
                  <Text style={styles.removeBtnText}>×</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}

        <View style={styles.actionRow}>
          {cameraMode !== "barcode" && (
            <Pressable
              style={styles.shutterButton}
              onPress={
                cameraMode === "sticker"
                  ? captureStickerPhoto
                  : cameraMode === "clothing_label"
                  ? captureClothingLabel
                  : captureProductPhoto
              }
              disabled={ocrProcessing}
            >
              <View style={styles.shutterInner} />
            </Pressable>
          )}
          <Pressable
            style={[styles.saveButton, saving && { opacity: 0.5 }]}
            onPress={save}
            disabled={saving || photos.length === 0}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>
                Opslaan ({photos.length})
              </Text>
            )}
          </Pressable>
        </View>

        {ean && (
          <Text style={styles.eanHint}>Barcode: {ean}</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

function ModeChip({
  active,
  onPress,
  label,
  hint,
}: {
  active: boolean;
  onPress: () => void;
  label: string;
  hint: string;
}) {
  return (
    <Pressable
      style={[styles.modeChip, active && styles.modeChipActive]}
      onPress={onPress}
    >
      <Text style={[styles.modeChipLabel, active && styles.modeChipLabelActive]}>
        {label}
      </Text>
      <Text style={[styles.modeChipHint, active && styles.modeChipHintActive]}>
        {hint}
      </Text>
    </Pressable>
  );
}

function CameraModeChip({
  active,
  onPress,
  label,
  disabled,
}: {
  active: boolean;
  onPress: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[
        styles.camModeChip,
        active && styles.camModeChipActive,
        disabled && { opacity: 0.4 },
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.camModeChipText, active && styles.camModeChipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  scroll: { padding: 16, gap: 12, paddingBottom: 40, backgroundColor: "#fff", flexGrow: 1 },
  card: { borderWidth: 1, borderColor: "#e4e4e7", borderRadius: 10, padding: 12 },
  label: { fontSize: 12, color: "#71717a", marginBottom: 6 },
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
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  micButton: {
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  micButtonActive: { backgroundColor: "#dc2626", borderColor: "#dc2626" },
  micText: { fontSize: 12, color: "#18181b" },
  micTextActive: { fontSize: 12, color: "#fff", fontWeight: "600" },

  modeRow: { flexDirection: "row", gap: 6 },
  modeChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 8,
    padding: 8,
    alignItems: "center",
  },
  modeChipActive: { backgroundColor: "#18181b", borderColor: "#18181b" },
  modeChipLabel: { fontSize: 12, fontWeight: "600", color: "#18181b" },
  modeChipLabelActive: { color: "#fff" },
  modeChipHint: { fontSize: 10, color: "#71717a", marginTop: 2 },
  modeChipHintActive: { color: "#a1a1aa" },

  primaryButton: {
    backgroundColor: "#18181b",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  primaryButtonText: { color: "#fff", fontSize: 15, fontWeight: "500" },

  permissionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  permissionText: { fontSize: 14, color: "#71717a", textAlign: "center", marginBottom: 16 },

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#000",
  },
  backText: { color: "#fff", fontSize: 15 },
  topBarTitle: { color: "#fff", fontSize: 15, fontFamily: "Courier", fontWeight: "700" },

  cameraModeRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: "#000",
  },
  camModeChip: {
    flex: 1,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 6,
    alignItems: "center",
  },
  camModeChipActive: { backgroundColor: "#fff", borderColor: "#fff" },
  camModeChipText: { color: "#fff", fontSize: 12, fontWeight: "500" },
  camModeChipTextActive: { color: "#000" },

  cameraWrap: { flex: 1, position: "relative" },
  camera: { flex: 1 },
  ocrOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  ocrText: { color: "#fff", fontSize: 14 },
  clothingBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: "rgba(22,163,74,0.9)",
    padding: 8,
    borderRadius: 6,
  },
  clothingBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },

  bottomBar: { padding: 16, gap: 10, backgroundColor: "#000" },
  thumbStrip: { maxHeight: 80 },
  thumbWrap: { marginRight: 8, position: "relative" },
  thumb: { width: 70, height: 70, borderRadius: 6 },
  removeBtn: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtnText: { color: "#fff", fontSize: 13, fontWeight: "700", lineHeight: 14 },

  actionRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  shutterButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.3)",
  },
  shutterInner: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#fff" },
  saveButton: {
    flex: 1,
    backgroundColor: "#16a34a",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
  },
  saveButtonText: { color: "#fff", fontSize: 15, fontWeight: "600" },

  eanHint: {
    color: "#a1a1aa",
    fontSize: 11,
    textAlign: "center",
    fontFamily: "Courier",
  },
});
