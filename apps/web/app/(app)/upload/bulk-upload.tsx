"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { resizeImage, filenameFor } from "@/lib/image";

type QueuedFile = {
  file: File;
  status: "pending" | "uploading" | "uploaded" | "error";
  path?: string;
  error?: string;
};

type Mode = "per_photo" | "single";

export function BulkUpload({ suggestedStart }: { suggestedStart: string }) {
  const router = useRouter();
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [mode, setMode] = useState<Mode>("per_photo");
  const [startSticker, setStartSticker] = useState(suggestedStart);
  const [workingTitle, setWorkingTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const onDrop = useCallback((accepted: File[]) => {
    setQueue((q) => [
      ...q,
      ...accepted.map((file) => ({
        file,
        status: "pending" as const,
      })),
    ]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    multiple: true,
  });

  async function submit() {
    if (queue.length === 0) return;
    setBusy(true);
    const supabase = createClient();
    const uploadedPaths: string[] = [];

    // Upload alle files naar storage, update status per file.
    for (let i = 0; i < queue.length; i++) {
      setQueue((q) => q.map((f, j) => (j === i ? { ...f, status: "uploading" } : f)));
      try {
        const resized = await resizeImage(queue[i]!.file);
        const path = `inbox/${filenameFor(i, queue[i]!.file.name)}`;
        const { error } = await supabase.storage
          .from("product-photos")
          .upload(path, resized, { contentType: "image/jpeg" });
        if (error) throw new Error(error.message);
        uploadedPaths.push(path);
        setQueue((q) =>
          q.map((f, j) => (j === i ? { ...f, status: "uploaded", path } : f)),
        );
      } catch (err) {
        setQueue((q) =>
          q.map((f, j) =>
            j === i
              ? {
                  ...f,
                  status: "error",
                  error: err instanceof Error ? err.message : "onbekend",
                }
              : f,
          ),
        );
      }
    }

    if (uploadedPaths.length === 0) {
      setBusy(false);
      toast.error("Geen foto's succesvol geüpload");
      return;
    }

    // Call bulk API om producten aan te maken.
    const res = await fetch("/api/products/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        photo_paths: uploadedPaths,
        startSticker: startSticker || undefined,
        mode,
        workingTitle: workingTitle || undefined,
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      toast.error(json.error ?? "Bulk aanmaken mislukt");
      return;
    }

    toast.success(
      mode === "single"
        ? `1 product met ${uploadedPaths.length} foto's aangemaakt`
        : `${json.created} producten aangemaakt`,
    );
    setQueue([]);
    router.refresh();
    if (mode === "single") {
      router.push("/inventory");
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Instellingen
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-xs">
            <span className="font-medium">Modus</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
              className="w-full rounded-md border px-2 py-1.5 text-sm"
            >
              <option value="per_photo">
                Eén product per foto (auto-sticker)
              </option>
              <option value="single">
                Alle foto's → één product
              </option>
            </select>
          </label>
          <label className="space-y-1 text-xs">
            <span className="font-medium">
              {mode === "per_photo" ? "Start sticker" : "Sticker-ID"}
            </span>
            <input
              value={startSticker}
              onChange={(e) => setStartSticker(e.target.value)}
              placeholder="0042"
              className="w-full rounded-md border px-2 py-1.5 text-sm font-mono"
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="font-medium">Werktitel (optioneel)</span>
            <input
              value={workingTitle}
              onChange={(e) => setWorkingTitle(e.target.value)}
              placeholder="wordt op alle producten gezet"
              className="w-full rounded-md border px-2 py-1.5 text-sm"
            />
          </label>
        </div>
      </div>

      <div
        {...getRootProps()}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-10 text-center transition ${
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/30 hover:border-primary/50"
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-sm font-medium">
          {isDragActive ? "Laat hier los…" : "Sleep foto's hier, of klik om te kiezen"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          JPG / PNG / WebP — worden automatisch gecomprimeerd tot max 1920px
        </p>
      </div>

      {queue.length > 0 && (
        <div className="space-y-3 rounded-lg border p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {queue.length} foto's in wachtrij
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setQueue([])}
                disabled={busy}
                className="rounded-md border px-3 py-1.5 text-sm"
              >
                Wissen
              </button>
              <button
                onClick={submit}
                disabled={busy}
                className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
              >
                {busy ? "Bezig…" : `Upload & maak ${mode === "single" ? "1 product" : "producten"}`}
              </button>
            </div>
          </div>
          <ul className="max-h-60 space-y-1 overflow-y-auto text-xs">
            {queue.map((q, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded border px-2 py-1"
              >
                <span className="truncate">{q.file.name}</span>
                <StatusBadge status={q.status} error={q.error} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatusBadge({
  status,
  error,
}: {
  status: QueuedFile["status"];
  error?: string;
}) {
  if (status === "error") {
    return (
      <span title={error} className="text-destructive">
        ✗ fout
      </span>
    );
  }
  if (status === "uploaded") return <span className="text-green-600">✓</span>;
  if (status === "uploading") return <span>…</span>;
  return <span className="text-muted-foreground">pending</span>;
}
