import { useEffect, useState } from "react";
import { AppState } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import NetInfo from "@react-native-community/netinfo";
import { supabase } from "../supabase";
import { createProductWithPhotos } from "../products/createProduct";
import {
  enqueue,
  queueCount,
  readQueue,
  removeFromQueue,
  updateItem,
  type QueuedCapture,
  type QueuedPhoto,
} from "./store";

const OUTBOX_DIR = FileSystem.documentDirectory + "outbox/";

// Kopieer een foto uit de (vluchtige) camera-cache naar documentDirectory,
// zodat hij een offline-wachtrij overleeft (cache kan door het OS gepurged
// worden vóór de sync draait).
async function persistPhoto(
  uri: string,
  itemId: string,
  index: number,
): Promise<string> {
  await FileSystem.makeDirectoryAsync(OUTBOX_DIR, { intermediates: true }).catch(
    () => {},
  );
  const dest = `${OUTBOX_DIR}${itemId}_${index}.jpg`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

export type EnqueueInput = Omit<QueuedCapture, "id" | "createdAt" | "photos"> & {
  photos: Array<Omit<QueuedPhoto, "localPath"> & { uri: string }>;
};

// Zet een capture in de wachtrij (foto's eerst persistent maken).
export async function enqueueCapture(input: EnqueueInput): Promise<void> {
  const id = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const photos: QueuedPhoto[] = [];
  try {
    for (let i = 0; i < input.photos.length; i++) {
      const p = input.photos[i]!;
      const localPath = await persistPhoto(p.uri, id, i);
      photos.push({ ...p, localPath });
    }
  } catch (err) {
    // Faalt een kopie halverwege, ruim dan de reeds gekopieerde bestanden op —
    // anders blijven ze in OUTBOX_DIR staan zonder wachtrij-item dat ernaar
    // verwijst (en dus zonder iets dat ze ooit opruimt).
    await Promise.all(
      photos.map((p) =>
        FileSystem.deleteAsync(p.localPath, { idempotent: true }).catch(() => {}),
      ),
    );
    throw err;
  }
  enqueue({ id, createdAt: new Date().toISOString(), ...input, photos });
}

let flushing = false;

// Verwerk de wachtrij. Idempotent-ish: bij succes wordt het item + z'n
// bestanden verwijderd; bij falen blijft het staan met een foutmelding
// (bijv. een sticker-nummer dat al bestaat) zodat de gebruiker kan ingrijpen.
export async function flushOutbox(): Promise<{ done: number; failed: number }> {
  if (flushing) return { done: 0, failed: 0 };
  flushing = true;
  try {
    const net = await NetInfo.fetch();
    if (net.isConnected === false) return { done: 0, failed: 0 };
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { done: 0, failed: 0 };

    let done = 0;
    let failed = 0;
    for (const item of readQueue()) {
      try {
        await createProductWithPhotos({
          userId: user.id,
          stickerId: item.stickerId ?? null,
          stickerInputMethod: item.stickerInputMethod ?? null,
          stickerConfidence: item.stickerConfidence ?? null,
          workingTitle: item.workingTitle ?? null,
          indexingNotes: item.indexingNotes ?? null,
          ean: item.ean ?? null,
          photos: item.photos.map((p) => ({
            uri: p.localPath,
            captureMode: p.captureMode,
            photoType: p.photoType,
            width: p.width,
            height: p.height,
            stickerVisible: p.stickerVisible,
            detectedSticker: p.detectedSticker,
            ocrConfidence: p.ocrConfidence,
          })),
        });
        await Promise.all(
          item.photos.map((p) =>
            FileSystem.deleteAsync(p.localPath, { idempotent: true }).catch(
              () => {},
            ),
          ),
        );
        removeFromQueue(item.id);
        done++;
      } catch (err) {
        updateItem(item.id, {
          error: err instanceof Error ? err.message : "sync mislukt",
        });
        failed++;
      }
    }
    return { done, failed };
  } finally {
    flushing = false;
  }
}

// Hook: flush bij online-worden en bij app-foreground, en houd de teller bij.
export function useOutboxSync(): { pending: number } {
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const refresh = () => setPending(queueCount());
    refresh();

    const doFlush = async () => {
      const before = queueCount();
      if (before === 0) return;
      await flushOutbox();
      refresh();
    };

    const netSub = NetInfo.addEventListener((state) => {
      if (state.isConnected) void doFlush();
      refresh();
    });
    const appSub = AppState.addEventListener("change", (s) => {
      if (s === "active") void doFlush();
    });
    void doFlush();
    const interval = setInterval(refresh, 3000);

    return () => {
      netSub();
      appSub.remove();
      clearInterval(interval);
    };
  }, []);

  return { pending };
}
