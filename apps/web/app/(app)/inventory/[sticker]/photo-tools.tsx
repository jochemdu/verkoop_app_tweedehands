"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  ArrowRight,
  Eraser,
  Pencil,
  RotateCw,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { filenameFor } from "@/lib/image";

export type ToolPhoto = {
  id: string;
  url: string;
  storage_path: string;
  order_index: number;
  photo_type: string | null;
};

// Foto-gereedschap (fase 28): herordenen, hoofdfoto kiezen, bewerken
// (roteren/helderheid/contrast/vierkant) en achtergrond verwijderen.
// Bewerkte versies worden als níeuwe foto opgeslagen — origineel blijft.
export function PhotoTools({
  productId,
  userId,
  photos,
}: {
  productId: string;
  userId: string;
  photos: ToolPhoto[];
}) {
  const router = useRouter();
  const t = useTranslations("product");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<ToolPhoto | null>(null);
  const sorted = useMemo(
    () => [...photos].sort((a, b) => a.order_index - b.order_index),
    [photos],
  );

  async function persistOrder(next: ToolPhoto[]) {
    setBusy(true);
    try {
      const supabase = createClient();
      // RLS (own_photos) staat updates op eigen rijen toe.
      const results = await Promise.all(
        next.map((p, i) =>
          supabase.from("photos").update({ order_index: i }).eq("id", p.id),
        ),
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) toast.error(t("orderFailed", { msg: failed.error.message }));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function makePrimary(photo: ToolPhoto) {
    const next = [photo, ...sorted.filter((p) => p.id !== photo.id)];
    void persistOrder(next);
  }

  function move(photo: ToolPhoto, dir: -1 | 1) {
    const idx = sorted.findIndex((p) => p.id === photo.id);
    const target = idx + dir;
    if (target < 0 || target >= sorted.length) return;
    const next = [...sorted];
    [next[idx], next[target]] = [next[target]!, next[idx]!];
    void persistOrder(next);
  }

  async function removePhoto(photo: ToolPhoto) {
    if (!window.confirm(t("removePhotoConfirm"))) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("photos").delete().eq("id", photo.id);
      if (error) {
        toast.error(t("removeFailed", { msg: error.message }));
        return;
      }
      // Storage-object best-effort (legacy paden vallen buiten de user-map).
      await supabase.storage.from("product-photos").remove([photo.storage_path]);
      toast.success(t("photoRemoved"));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {sorted.map((photo, i) => (
          <figure key={photo.id} className="group relative">
            <a
              href={photo.url}
              target="_blank"
              rel="noreferrer"
              className="relative block aspect-square overflow-hidden rounded-lg border border-border bg-muted"
            >
              <Image src={photo.url} alt="" fill unoptimized className="object-cover" />
              {i === 0 && (
                <span className="badge absolute left-1 top-1 bg-accent text-accent-foreground">
                  <Star className="size-3" aria-hidden /> {t("primaryBadge")}
                </span>
              )}
              {photo.photo_type && photo.photo_type !== "general" && (
                <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
                  {photo.photo_type}
                </span>
              )}
            </a>
            <figcaption className="mt-1 flex items-center justify-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
              {i !== 0 && (
                <IconBtn label={t("makePrimary")} onClick={() => makePrimary(photo)} disabled={busy}>
                  <Star className="size-3.5" aria-hidden />
                </IconBtn>
              )}
              <IconBtn label={t("moveLeft")} onClick={() => move(photo, -1)} disabled={busy || i === 0}>
                <ArrowLeft className="size-3.5" aria-hidden />
              </IconBtn>
              <IconBtn label={t("moveRight")} onClick={() => move(photo, 1)} disabled={busy || i === sorted.length - 1}>
                <ArrowRight className="size-3.5" aria-hidden />
              </IconBtn>
              <IconBtn label={t("edit")} onClick={() => setEditing(photo)} disabled={busy}>
                <Pencil className="size-3.5" aria-hidden />
              </IconBtn>
              <IconBtn label={t("delete")} onClick={() => removePhoto(photo)} disabled={busy} danger>
                <Trash2 className="size-3.5" aria-hidden />
              </IconBtn>
            </figcaption>
          </figure>
        ))}
      </section>

      {editing && (
        <PhotoEditor
          photo={editing}
          productId={productId}
          userId={userId}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md border border-border bg-card p-1.5 transition-colors disabled:opacity-40 ${
        danger ? "text-destructive hover:bg-destructive/10" : "hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

/* ============================== Editor =============================== */

function PhotoEditor({
  photo,
  productId,
  userId,
  onClose,
  onSaved,
}: {
  photo: ToolPhoto;
  productId: string;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("product");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [source, setSource] = useState<ImageBitmap | null>(null);
  const [rotation, setRotation] = useState(0); // 0/90/180/270
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [square, setSquare] = useState(false);
  const [removingBg, setRemovingBg] = useState(false);
  const [bgMode, setBgMode] = useState<"white" | "transparent" | "gray">("white");
  const [hiQuality, setHiQuality] = useState(false);
  const [bgProgress, setBgProgress] = useState<number | null>(null);
  // Onthoudt of de huidige bron transparantie bevat (na 'Transparant'-modus),
  // zodat we bij het opslaan PNG i.p.v. JPEG exporteren.
  const [hasAlpha, setHasAlpha] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Bron laden via fetch → geen canvas-tainting (Supabase stuurt CORS *).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(photo.url);
        if (!res.ok) throw new Error(t("fetchError", { status: res.status }));
        const bitmap = await createImageBitmap(await res.blob());
        if (!cancelled) setSource(bitmap);
      } catch (err) {
        if (!cancelled)
          setLoadError(err instanceof Error ? err.message : t("loadFailed"));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo.url]);

  // Tekent de huidige bewerking; bij export op vol formaat, anders preview.
  // Roteren gebeurt om het middelpunt; vierkant = center-crop op de kortste
  // zijde (het canvas knipt zelf af wat buiten beeld valt).
  function draw(target: HTMLCanvasElement, forExport = false) {
    if (!source) return;
    const rotated = rotation % 180 !== 0;
    const srcW = source.width;
    const srcH = source.height;
    const contentW = rotated ? srcH : srcW;
    const contentH = rotated ? srcW : srcH;
    const cropW = square ? Math.min(contentW, contentH) : contentW;
    const cropH = square ? Math.min(contentW, contentH) : contentH;
    const maxDim = forExport ? 1920 : 520;
    const scale = Math.min(1, maxDim / Math.max(cropW, cropH));
    target.width = Math.round(cropW * scale);
    target.height = Math.round(cropH * scale);
    const ctx = target.getContext("2d");
    if (!ctx) return;
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
    ctx.save();
    ctx.translate(target.width / 2, target.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scale, scale);
    ctx.drawImage(source, -srcW / 2, -srcH / 2);
    ctx.restore();
    ctx.filter = "none";
  }

  // Preview bijwerken bij elke wijziging.
  useEffect(() => {
    const c = canvasRef.current;
    if (c && source) draw(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, rotation, brightness, contrast, square]);

  async function removeBg() {
    if (!source) return;
    setRemovingBg(true);
    setBgProgress(0);
    const tid = toast.loading(t("bgLoading"));
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      // Huidige bron → PNG → model haalt de achtergrond eruf (met alpha).
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = source.width;
      exportCanvas.height = source.height;
      exportCanvas.getContext("2d")!.drawImage(source, 0, 0);
      const blob: Blob = await new Promise((res, rej) =>
        exportCanvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob faalde"))), "image/png"),
      );
      const cutout = await removeBackground(blob, {
        // isnet = beste kwaliteit (groter/langzamer), isnet_fp16 = standaard.
        model: hiQuality ? "isnet" : "isnet_fp16",
        progress: (_key, current, total) => {
          if (total > 0) setBgProgress(Math.round((current / total) * 100));
        },
      });
      const cutoutBitmap = await createImageBitmap(cutout);
      const composed = document.createElement("canvas");
      composed.width = cutoutBitmap.width;
      composed.height = cutoutBitmap.height;
      const ctx = composed.getContext("2d")!;
      // Transparant = cutout behouden; anders vullen we een effen achtergrond.
      if (bgMode !== "transparent") {
        ctx.fillStyle = bgMode === "gray" ? "#f2f2f2" : "#ffffff";
        ctx.fillRect(0, 0, composed.width, composed.height);
      }
      ctx.drawImage(cutoutBitmap, 0, 0);
      const newBitmap = await createImageBitmap(composed);
      setSource(newBitmap);
      setHasAlpha(bgMode === "transparent");
      toast.success(t("bgDone"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("bgFailed"));
    } finally {
      toast.dismiss(tid);
      setRemovingBg(false);
      setBgProgress(null);
    }
  }

  async function save() {
    if (!source) return;
    setSaving(true);
    try {
      const exportCanvas = document.createElement("canvas");
      draw(exportCanvas, true);
      // Transparante uitsnede vereist PNG (JPEG kent geen alpha); anders JPEG.
      const mime = hasAlpha ? "image/png" : "image/jpeg";
      const ext = hasAlpha ? "png" : "jpg";
      const blob: Blob = await new Promise((res, rej) =>
        exportCanvas.toBlob(
          (b) => (b ? res(b) : rej(new Error("toBlob faalde"))),
          mime,
          0.9,
        ),
      );
      const supabase = createClient();
      const path = `${userId}/inbox/${filenameFor(0, `bewerkt.${ext}`)}`;
      const { error: upErr } = await supabase.storage
        .from("product-photos")
        .upload(path, blob, { contentType: mime });
      if (upErr) throw new Error(upErr.message);
      const res = await fetch(`/api/products/${productId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo_paths: [path] }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? t("editorSaveFailed"));
      toast.success(t("editorSaved"));
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("editorSaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card w-full max-w-xl space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("editTitle")}</h2>
          <button type="button" onClick={onClose} className="btn btn-ghost p-1.5" aria-label={t("close")}>
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="flex justify-center rounded-lg border border-border bg-muted/40 p-3">
          {loadError ? (
            <p className="py-16 text-sm text-destructive">{loadError}</p>
          ) : source ? (
            <canvas ref={canvasRef} className="max-h-[420px] max-w-full rounded" />
          ) : (
            <p className="py-16 text-sm text-muted-foreground">{t("loading")}</p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">{t("brightness", { value: brightness })}</span>
            <input
              type="range"
              min={50}
              max={160}
              value={brightness}
              onChange={(e) => setBrightness(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">{t("contrast", { value: contrast })}</span>
            <input
              type="range"
              min={50}
              max={160}
              value={contrast}
              onChange={(e) => setContrast(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="btn btn-outline"
            disabled={!source}
          >
            <RotateCw className="size-4" aria-hidden /> {t("rotate")}
          </button>
          <button
            type="button"
            onClick={() => setSquare((s) => !s)}
            className={`btn ${square ? "btn-primary" : "btn-outline"}`}
            disabled={!source}
          >
            {square ? t("squareOn") : t("squareOff")}
          </button>
          <button
            type="button"
            onClick={removeBg}
            disabled={!source || removingBg}
            className="btn btn-outline"
          >
            <Eraser className="size-4" aria-hidden />
            {removingBg
              ? bgProgress !== null
                ? t("bgProgress", { pct: bgProgress })
                : t("bgBusy")
              : t("removeBg")}
          </button>
        </div>

        {/* Opties voor achtergrond-verwijdering */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-muted/30 p-3 text-xs">
          <span className="font-medium text-muted-foreground">{t("bgLabel")}</span>
          <div className="flex gap-1">
            {(["white", "transparent", "gray"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setBgMode(mode)}
                disabled={removingBg}
                className={`rounded-md border px-2 py-1 transition-colors ${
                  bgMode === mode
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border bg-card hover:bg-muted"
                }`}
              >
                {t(
                  mode === "white"
                    ? "bgWhite"
                    : mode === "transparent"
                      ? "bgTransparent"
                      : "bgGray",
                )}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              className="size-3.5"
              checked={hiQuality}
              onChange={(e) => setHiQuality(e.target.checked)}
              disabled={removingBg}
            />
            {t("bgHiQuality")}
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-outline">
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!source || saving}
            className="btn btn-accent"
          >
            {saving ? t("editorSaving") : t("saveAsNew")}
          </button>
        </div>
      </div>
    </div>
  );
}
