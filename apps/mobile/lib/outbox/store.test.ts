import { describe, it, expect, beforeEach, vi } from "vitest";

// react-native-mmkv is native; mock met een in-memory Map zodat de store puur
// tegen JS draait (geen RN runtime nodig).
vi.mock("react-native-mmkv", () => ({
  createMMKV: () => {
    const m = new Map<string, string>();
    return {
      getString: (k: string) => m.get(k) ?? undefined,
      set: (k: string, v: string) => m.set(k, v),
      remove: (k: string) => m.delete(k),
    };
  },
}));

import {
  readQueue,
  enqueue,
  removeFromQueue,
  updateItem,
  queueCount,
  type QueuedCapture,
} from "./store";

function makeCapture(id: string): QueuedCapture {
  return {
    id,
    createdAt: "2026-07-14T00:00:00.000Z",
    photos: [{ localPath: `/docs/${id}.jpg` }],
  };
}

describe("outbox store", () => {
  beforeEach(() => {
    // Leeg de queue tussen tests (mock persisteert binnen één module-instance).
    for (const item of readQueue()) removeFromQueue(item.id);
  });

  it("start leeg", () => {
    expect(readQueue()).toEqual([]);
    expect(queueCount()).toBe(0);
  });

  it("enqueue voegt toe en queueCount telt mee", () => {
    enqueue(makeCapture("a"));
    expect(queueCount()).toBe(1);
    enqueue(makeCapture("b"));
    expect(queueCount()).toBe(2);
    expect(readQueue().map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("readQueue overleeft een JSON round-trip met alle velden", () => {
    const cap: QueuedCapture = {
      id: "x",
      createdAt: "2026-07-14T12:00:00.000Z",
      stickerId: "0042",
      stickerInputMethod: "manual",
      workingTitle: "Nintendo Switch",
      photos: [
        { localPath: "/docs/x.jpg", photoType: "general", width: 100, height: 200 },
      ],
    };
    enqueue(cap);
    expect(readQueue()[0]).toEqual(cap);
  });

  it("updateItem patcht alleen het juiste item", () => {
    enqueue(makeCapture("a"));
    enqueue(makeCapture("b"));
    updateItem("b", { error: "upload mislukt" });
    const q = readQueue();
    expect(q.find((i) => i.id === "a")?.error).toBeUndefined();
    expect(q.find((i) => i.id === "b")?.error).toBe("upload mislukt");
  });

  it("removeFromQueue verwijdert het item", () => {
    enqueue(makeCapture("a"));
    enqueue(makeCapture("b"));
    removeFromQueue("a");
    expect(readQueue().map((i) => i.id)).toEqual(["b"]);
    expect(queueCount()).toBe(1);
  });

  it("removeFromQueue op onbekend id laat de queue ongemoeid", () => {
    enqueue(makeCapture("a"));
    removeFromQueue("nope");
    expect(queueCount()).toBe(1);
  });
});
