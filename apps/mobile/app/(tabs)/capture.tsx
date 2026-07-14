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
import NetInfo from "@react-native-community/netinfo";
import { supabase } from "@/lib/supabase";
import { createProductWithPhotos } from "@/lib/products/createProduct";
import { enqueueCapture } from "@/lib/outbox/sync";
import { stickerIdSchema, localeTag } from "@verkoopassistent/shared";
import { parseClothingLabel } from "@/lib/clothing-parser";
import { useTranslation, useLocale } from "@/lib/i18n";

type CapturedPhoto = {
  uri: string;
  width?: number;
  height?: number;
  source: "sticker_ocr" | "product" | "barcode";
};

type Mode = "ocr_separate" | "ocr_inline" | "manual";

export default function CaptureScreen() {
  const t = useTranslation("mobile");
  const locale = useLocale();
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
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

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
        Alert.alert(t("micPermTitle"), t("micPermMsg"));
        return;
      }
      ExpoSpeechRecognitionModule.start({
        lang: localeTag(locale),
        interimResults: false,
        continuous: false,
      });
      setRecording(true);
    } catch (err) {
      Alert.alert(t("voiceError"), err instanceof Error ? err.message : t("unknown"));
    }
  }

  function stopVoice() {
    ExpoSpeechRecognitionModule.stop();
    setRecording(false);
  }
  const [ocrProcessing, setOcrProcessing] = useState(false);

  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    (async () => {
      // Sticker-teller is per workspace (fase 48): eerst de actieve workspace.
      const { data: prof } = await supabase
        .from("profiles")
        .select("active_workspace_id")
        .maybeSingle();
      const ws = prof?.active_workspace_id ?? null;
      setWorkspaceId(ws);
      if (!ws) return;
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "last_sticker_number")
        .eq("workspace_id", ws)
        .maybeSingle();
      const n = Number(data?.value ?? 0);
      if (n > 0) {
        setLastUsed(n);
        setStickerId(String(n + 1).padStart(4, "0"));
      }
    })();
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
        Alert.alert(t("noNumberTitle"), t("noNumberMsg"));
        return;
      }

      // Bij meerdere kandidaten: vraag user te kiezen.
      if (candidates.length > 1) {
        Alert.alert(
          t("multiNumberTitle"),
          t("multiNumberMsg", { list: candidates.join(", ") }),
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
      Alert.alert(t("ocrError"), err instanceof Error ? err.message : t("unknown"));
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
            t("multiInViewTitle"),
            t("multiInViewMsg", { list: candidates.join(", ") }),
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
      Alert.alert(t("photoError"), err instanceof Error ? err.message : t("unknown"));
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
        parsed.material ? t("materialNote", { material: parsed.material }) : null,
      ]
        .filter(Boolean)
        .join(" · ");
      if (extraNote) setNotes((prev) => (prev ? `${prev}\n${extraNote}` : extraNote));

      setPhotos((p) => [...p, { uri: photo.uri, source: "product" }]);
      setCameraMode("product");
    } catch (err) {
      Alert.alert(t("labelOcrError"), err instanceof Error ? err.message : t("unknown"));
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
        const bookTitle = b.title ? `${b.title}${b.authors?.[0] ? ` — ${b.authors[0]}` : ""}` : "";
        if (bookTitle && !workingTitle) setWorkingTitle(bookTitle);
        const extra = [b.publisher && t("bookPublisher", { value: b.publisher }), b.year && t("bookYear", { value: b.year }), b.language && t("bookLanguage", { value: b.language })].filter(Boolean).join(" · ");
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
      Alert.alert(t("addPhotoFirst"));
      return;
    }
    const parsed = stickerIdSchema.optional().safeParse(stickerId || undefined);
    if (!parsed.success) {
      Alert.alert(t("invalidSticker"), t("invalidStickerMsg"));
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error(t("notLoggedIn"));

      const inputMethod =
        mode === "manual"
          ? "manual"
          : mode === "ocr_separate"
          ? "ocr_separate"
          : "ocr_inline";

      const photoInputs = photos.map((p) => ({
        uri: p.uri,
        captureMode: p.source,
        photoType: p.source === "sticker_ocr" ? "sticker" : "general",
        width: p.width ?? null,
        height: p.height ?? null,
        stickerVisible: p.source === "sticker_ocr",
        detectedSticker: p.source === "sticker_ocr" ? stickerId : null,
        ocrConfidence: p.source === "sticker_ocr" ? stickerConfidence : null,
      }));
      const captureData = {
        stickerId: stickerId || null,
        stickerInputMethod: inputMethod as
          | "ocr_inline"
          | "ocr_separate"
          | "manual",
        stickerConfidence,
        workingTitle: workingTitle || null,
        indexingNotes: notes || null,
        ean: ean || null,
      };

      // Offline? → in de wachtrij; sync gebeurt automatisch zodra er weer
      // verbinding is (fase 33). Foto's worden persistent gemaakt.
      let savedOnline = false;
      const net = await NetInfo.fetch();
      if (net.isConnected !== false) {
        try {
          // Gedeelde helper (fase 32): upload + product + photos met rollback.
          await createProductWithPhotos({
            userId: user.id,
            ...captureData,
            photos: photoInputs,
          });
          savedOnline = true;
        } catch (onlineErr) {
          // Verbinding halverwege weggevallen? De helper heeft z'n eigen
          // uploads/rijen teruggerold, dus veilig om alsnog te queuen. Bij een
          // andere fout (mét verbinding) laten we hem doorschieten.
          const recheck = await NetInfo.fetch();
          if (recheck.isConnected !== false) throw onlineErr;
        }
      }

      if (savedOnline) {
        if (stickerId && workspaceId) {
          await supabase.from("app_settings").upsert(
            {
              key: "last_sticker_number",
              value: parseInt(stickerId, 10),
              user_id: user.id,
              workspace_id: workspaceId,
            },
            { onConflict: "key,workspace_id" },
          );
        }
        Alert.alert(
          t("saved"),
          t("savedMsg", {
            count: photos.length,
            sticker: stickerId || t("noStickerValue"),
          }),
        );
      } else {
        await enqueueCapture({ ...captureData, photos: photoInputs });
        Alert.alert(t("savedOffline"), t("savedOfflineMsg"));
      }

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
      Alert.alert(t("errorTitle"), err instanceof Error ? err.message : t("unknown"));
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
        <Text style={styles.permissionTitle}>{t("cameraPermTitle")}</Text>
        <Text style={styles.permissionText}>{t("cameraPermMsg")}</Text>
        <Pressable style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>{t("allowAccess")}</Text>
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
            <Text style={styles.label}>{t("stickerMode")}</Text>
            <View style={styles.modeRow}>
              <ModeChip
                active={mode === "ocr_separate"}
                onPress={() => setMode("ocr_separate")}
                label={t("modeFirstSticker")}
                hint={t("modeFirstStickerHint")}
              />
              <ModeChip
                active={mode === "ocr_inline"}
                onPress={() => setMode("ocr_inline")}
                label={t("modeOcrInline")}
                hint={t("modeOcrInlineHint")}
              />
              <ModeChip
                active={mode === "manual"}
                onPress={() => setMode("manual")}
                label={t("modeManual")}
                hint={t("modeManualHint")}
              />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>{t("stickerIdLabel")}</Text>
            <TextInput
              value={stickerId}
              onChangeText={(v) => {
                setStickerId(v);
                setStickerConfidence(null);
              }}
              placeholder={t("stickerIdPlaceholder")}
              keyboardType="number-pad"
              maxLength={4}
              style={styles.inputMono}
            />
            {lastUsed !== null && (
              <Text style={styles.hint}>
                {t("lastUsedLabel", { value: String(lastUsed).padStart(4, "0") })}
              </Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>{t("workingTitleLabel")}</Text>
            <TextInput
              value={workingTitle}
              onChangeText={setWorkingTitle}
              placeholder={t("workingTitlePlaceholder")}
              style={styles.input}
            />
          </View>

          <View style={styles.card}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>{t("noteLabel")}</Text>
              <Pressable
                onPress={recording ? stopVoice : startVoice}
                style={[styles.micButton, recording && styles.micButtonActive]}
              >
                <Text style={recording ? styles.micTextActive : styles.micText}>
                  {recording ? t("micStop") : t("micSpeak")}
                </Text>
              </Pressable>
            </View>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder={t("notePlaceholder")}
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
            <Text style={styles.primaryButtonText}>{t("toCamera")}</Text>
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
          <Text style={styles.backText}>{t("back")}</Text>
        </Pressable>
        <Text style={styles.topBarTitle}>
          {stickerId ? t("stickerN", { id: stickerId }) : t("noSticker")}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.cameraModeRow}>
        <CameraModeChip
          active={cameraMode === "sticker"}
          onPress={() => setCameraMode("sticker")}
          label={t("camSticker")}
          disabled={mode === "manual" || !!stickerId}
        />
        <CameraModeChip
          active={cameraMode === "product"}
          onPress={() => setCameraMode("product")}
          label={t("camProduct")}
        />
        <CameraModeChip
          active={cameraMode === "barcode"}
          onPress={() => setCameraMode("barcode")}
          label={t("camBarcode")}
        />
        <CameraModeChip
          active={cameraMode === "clothing_label"}
          onPress={() => setCameraMode("clothing_label")}
          label={t("camLabel")}
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
              {cameraMode === "clothing_label" ? t("readingLabel") : t("readingSticker")}
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
                {t("saveN", { count: photos.length })}
              </Text>
            )}
          </Pressable>
        </View>

        {ean && (
          <Text style={styles.eanHint}>{t("barcodeHint", { ean })}</Text>
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
