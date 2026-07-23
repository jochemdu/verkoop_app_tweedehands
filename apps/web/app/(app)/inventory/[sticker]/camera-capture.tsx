"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Camera, X, SwitchCamera, Trash2 } from "lucide-react";
import { uploadProductPhotos } from "@/lib/photo-upload";

// Live camera-opname bij een bestaand product. Werkt op mobiel én desktop
// (getUserMedia). Meerdere foto's achter elkaar maken, previewen, dan in één
// keer uploaden via dezelfde flow als de galerij-knop.
export function CameraCaptureButton({
  productId,
  userId,
}: {
  productId: string;
  userId: string;
}) {
  const router = useRouter();
  const t = useTranslations("product");
  const [open, setOpen] = useState(false);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [shots, setShots] = useState<Blob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  }, []);

  const startStream = useCallback(
    async (mode: "environment" | "user") => {
      setError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(t("cameraUnsupported"));
        return;
      }
      try {
        stopStream();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch {
        setError(t("cameraDenied"));
      }
    },
    [stopStream, t],
  );

  // Stream starten/stoppen op basis van open + gekozen camera. startStream zet
  // async foutstatus (camera-permissie/ondersteuning) — inherent aan een
  // effect-gedreven camera-init, vandaar de bewuste uitzondering.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) void startStream(facing);
    return () => stopStream();
  }, [open, facing, startStream, stopStream]);

  function snap() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) setShots((prev) => [...prev, blob]);
      },
      "image/jpeg",
      0.9,
    );
  }

  function close() {
    stopStream();
    setOpen(false);
    setShots([]);
    setError(null);
  }

  async function upload() {
    if (shots.length === 0) return;
    setBusy(true);
    try {
      const added = await uploadProductPhotos(
        productId,
        userId,
        shots.map((blob, i) => ({ blob, name: `camera-${i}.jpg` })),
      );
      toast.success(t("added", { count: added }));
      router.refresh();
      close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("addFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-outline">
        <Camera className="size-4" aria-hidden />
        {t("cameraOpen")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black"
          role="dialog"
          aria-modal="true"
          aria-label={t("cameraTitle")}
        >
          {/* Kop */}
          <div className="flex items-center justify-between p-3 text-white">
            <span className="text-sm font-medium">{t("cameraTitle")}</span>
            <button
              type="button"
              onClick={close}
              className="rounded-full p-2 hover:bg-white/10"
              aria-label={t("cameraClose")}
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>

          {/* Live preview / foutmelding */}
          <div className="relative flex-1 overflow-hidden">
            {error ? (
              <div className="flex h-full items-center justify-center p-6 text-center text-sm text-white/80">
                {error}
              </div>
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />
            )}

            {/* Camera wisselen */}
            {!error && (
              <button
                type="button"
                onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
                className="absolute right-3 top-3 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
                aria-label={t("cameraFlip")}
              >
                <SwitchCamera className="size-5" aria-hidden />
              </button>
            )}
          </div>

          {/* Gemaakte foto's */}
          {shots.length > 0 && (
            <div className="flex gap-2 overflow-x-auto bg-black/80 p-2">
              {shots.map((blob, i) => (
                <div key={i} className="relative shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={URL.createObjectURL(blob)}
                    alt=""
                    className="size-16 rounded object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setShots((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute -right-1 -top-1 rounded-full bg-black/80 p-0.5 text-white"
                    aria-label={t("cameraRemove")}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Bediening */}
          <div className="flex items-center justify-between gap-3 p-4">
            <button
              type="button"
              onClick={snap}
              disabled={!!error}
              className="flex-1 rounded-full bg-white py-3 text-center text-sm font-semibold text-black disabled:opacity-40"
            >
              {t("cameraSnap")}
            </button>
            <button
              type="button"
              onClick={upload}
              disabled={shots.length === 0 || busy}
              className="flex-1 rounded-full bg-[var(--accent)] py-3 text-center text-sm font-semibold text-[var(--accent-foreground)] disabled:opacity-40"
            >
              {busy ? t("uploading") : t("cameraUploadN", { count: shots.length })}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
