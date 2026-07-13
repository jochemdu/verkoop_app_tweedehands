import { createMMKV } from "react-native-mmkv";

// Offline-outbox (fase 33): captures die zonder internet gemaakt zijn worden
// hier bewaard tot ze gesynct kunnen worden. MMKV is sync + snel; voor een
// handvol queued items ruim voldoende (geen SQLite nodig).

const mmkv = createMMKV({ id: "verkoopassistent-outbox" });
const KEY = "queue";

export type QueuedPhoto = {
  // Persistent pad in documentDirectory (niet de vluchtige camera-cache).
  localPath: string;
  captureMode?: string | null;
  photoType?: string | null;
  width?: number | null;
  height?: number | null;
  stickerVisible?: boolean;
  detectedSticker?: string | null;
  ocrConfidence?: number | null;
};

export type QueuedCapture = {
  id: string;
  createdAt: string;
  stickerId?: string | null;
  stickerInputMethod?:
    | "ocr_inline"
    | "ocr_separate"
    | "manual"
    | "manual_increment"
    | null;
  stickerConfidence?: number | null;
  workingTitle?: string | null;
  indexingNotes?: string | null;
  ean?: string | null;
  photos: QueuedPhoto[];
  error?: string | null;
};

export function readQueue(): QueuedCapture[] {
  const raw = mmkv.getString(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedCapture[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedCapture[]): void {
  mmkv.set(KEY, JSON.stringify(items));
}

export function enqueue(item: QueuedCapture): void {
  writeQueue([...readQueue(), item]);
}

export function removeFromQueue(id: string): void {
  writeQueue(readQueue().filter((i) => i.id !== id));
}

export function updateItem(id: string, patch: Partial<QueuedCapture>): void {
  writeQueue(readQueue().map((i) => (i.id === id ? { ...i, ...patch } : i)));
}

export function queueCount(): number {
  return readQueue().length;
}
