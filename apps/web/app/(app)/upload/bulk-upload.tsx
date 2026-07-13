"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("upload");
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      return;
    }
    const uploadedPaths: string[] = [];

    // Upload alle files naar storage, update status per file.
    for (let i = 0; i < queue.length; i++) {
      setQueue((q) => q.map((f, j) => (j === i ? { ...f, status: "uploading" } : f)));
      try {
        const resized = await resizeImage(queue[i]!.file);
        const path = `${user.id}/inbox/${filenameFor(i, queue[i]!.file.name)}`;
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
      toast.error(t("noUpload"));
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
      toast.error(json.error ?? t("bulkFailed"));
      return;
    }

    toast.success(
      mode === "single"
        ? t("createdSingle", { count: uploadedPaths.length })
        : t("createdMulti", { count: json.created }),
    );
    setQueue([]);
    router.refresh();
    if (mode === "single") {
      router.push("/inventory");
    }
  }

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h2 className="section-title mb-3">{t("settings")}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-xs">
            <span className="font-medium">{t("mode")}</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
              className="input"
            >
              <option value="per_photo">{t("modePerPhoto")}</option>
              <option value="single">{t("modeSingle")}</option>
            </select>
          </label>
          <label className="space-y-1 text-xs">
            <span className="font-medium">
              {mode === "per_photo" ? t("startSticker") : t("stickerId")}
            </span>
            <input
              value={startSticker}
              onChange={(e) => setStartSticker(e.target.value)}
              placeholder="0042"
              className="input font-mono"
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="font-medium">{t("workingTitle")}</span>
            <input
              value={workingTitle}
              onChange={(e) => setWorkingTitle(e.target.value)}
              placeholder={t("workingTitlePlaceholder")}
              className="input"
            />
          </label>
        </div>
      </div>

      <div
        {...getRootProps()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
          isDragActive
            ? "border-accent bg-accent-soft"
            : "border-border bg-card hover:border-accent"
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-sm font-medium">
          {isDragActive ? t("dropActive") : t("dropIdle")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{t("dropHint")}</p>
      </div>

      {queue.length > 0 && (
        <div className="card space-y-3 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {t("inQueue", { count: queue.length })}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setQueue([])}
                disabled={busy}
                className="btn btn-outline"
              >
                {t("clear")}
              </button>
              <button
                onClick={submit}
                disabled={busy}
                className="btn btn-accent"
              >
                {busy
                  ? t("busy")
                  : mode === "single"
                    ? t("submitSingle")
                    : t("submitMulti")}
              </button>
            </div>
          </div>
          <ul className="max-h-60 space-y-1 overflow-y-auto text-xs">
            {queue.map((q, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-md border border-border px-2 py-1"
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
  const t = useTranslations("upload");
  if (status === "error") {
    return (
      <span title={error} className="text-destructive">
        {t("statusError")}
      </span>
    );
  }
  if (status === "uploaded") return <span className="font-medium text-accent">✓</span>;
  if (status === "uploading") return <span>…</span>;
  return <span className="text-muted-foreground">{t("statusPending")}</span>;
}
