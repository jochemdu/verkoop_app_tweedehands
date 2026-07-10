"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import { toast } from "sonner";
import { STICKER_PRESETS, type StickerPreset } from "@verkoopassistent/shared";
import { PRESET_LABELS } from "../stickers/sticker-form";

type Row = {
  id: string;
  sticker_id: string | null;
  working_title: string | null;
  title: string | null;
  category_slug: string | null;
  status: string | null;
  indexed_at: string | null;
};

const GRID_COLS = "grid-cols-[32px_80px_1fr_140px_120px_120px_80px]";

function PrintDialog({
  stickerIds,
  onClose,
}: {
  stickerIds: string[];
  onClose: () => void;
}) {
  const [preset, setPreset] = useState<StickerPreset>("medium_38x21");
  const [withQr, setWithQr] = useState(true);
  const [busy, setBusy] = useState(false);

  async function printSelection() {
    setBusy(true);
    try {
      const res = await fetch("/api/stickers/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stickerIds, preset, withQr }),
      });
      const json = (await res.json()) as { pdfUrl?: string; error?: string };
      if (!res.ok || !json.pdfUrl) {
        toast.error(json.error ?? "Genereren mislukt");
        return;
      }
      window.open(json.pdfUrl, "_blank", "noopener");
      toast.success(`${stickerIds.length} stickers gegenereerd`);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md space-y-4 rounded-lg border bg-background p-6 shadow-lg">
        <h2 className="text-lg font-semibold">
          Stickers printen ({stickerIds.length})
        </h2>
        <p className="font-mono text-xs text-muted-foreground">
          {stickerIds.slice(0, 12).join(", ")}
          {stickerIds.length > 12 ? ` … +${stickerIds.length - 12}` : ""}
        </p>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Formaat</span>
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as StickerPreset)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            {STICKER_PRESETS.map((p) => (
              <option key={p} value={p}>
                {PRESET_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={withQr}
            onChange={(e) => setWithQr(e.target.checked)}
          />
          <span>QR-code (scan opent de productpagina)</span>
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-3 py-1.5 text-sm"
          >
            Annuleren
          </button>
          <button
            type="button"
            onClick={printSelection}
            disabled={busy}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Genereren…" : "Genereer PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function VirtualTable({
  rows,
  enableActions = true,
}: {
  rows: Row[];
  enableActions?: boolean;
}) {
  const router = useRouter();
  const parentRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [printOpen, setPrintOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 10,
  });

  const selectedRows = useMemo(
    () => rows.filter((r) => selected.has(r.id)),
    [rows, selected],
  );
  const selectedStickerIds = useMemo(
    () =>
      selectedRows
        .map((r) => r.sticker_id)
        .filter((s): s is string => Boolean(s))
        .sort(),
    [selectedRows],
  );
  const allSelected = rows.length > 0 && selected.size === rows.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  async function bulkAnalyze() {
    const ids = [...selected];
    setAnalyzing(true);
    let ok = 0;
    let failed = 0;
    try {
      // Sequentieel: elke analyse is een zware vision-call; parallel zou
      // rate limits raken en de progress-toast betekenisloos maken.
      for (const [i, id] of ids.entries()) {
        toast.loading(`AI-analyse ${i + 1}/${ids.length}…`, { id: "bulk-analyze" });
        const res = await fetch(`/api/products/${id}/analyze`, { method: "POST" });
        if (res.ok) ok++;
        else failed++;
      }
      toast.dismiss("bulk-analyze");
      if (failed === 0) toast.success(`${ok} producten geanalyseerd`);
      else toast.warning(`${ok} gelukt, ${failed} mislukt (zie productpagina's)`);
      setSelected(new Set());
      router.refresh();
    } finally {
      toast.dismiss("bulk-analyze");
      setAnalyzing(false);
    }
  }

  async function bulkDelete() {
    const count = selected.size;
    if (
      !window.confirm(
        `${count} producten naar de prullenbak verplaatsen? (Herstellen kan via de Prullenbak-weergave.)`,
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch("/api/products/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_ids: [...selected] }),
      });
      const json = (await res.json()) as { soft_deleted?: number; error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Verwijderen mislukt");
        return;
      }
      toast.success(`${json.soft_deleted ?? count} producten naar prullenbak`);
      setSelected(new Set());
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  if (rows.length === 0) return null;

  return (
    <div className="space-y-2">
      <div
        ref={parentRef}
        className="max-h-[70vh] overflow-auto rounded-lg border"
      >
        <div
          className={`sticky top-0 z-10 grid ${GRID_COLS} gap-3 border-b bg-muted/80 px-3 py-2 text-xs uppercase text-muted-foreground backdrop-blur`}
        >
          <span>
            <input
              type="checkbox"
              className="size-4 align-middle"
              checked={allSelected}
              onChange={toggleAll}
              aria-label="Selecteer alles"
            />
          </span>
          <span>Sticker</span>
          <span>Titel</span>
          <span>Categorie</span>
          <span>Status</span>
          <span>Geïndexeerd</span>
          <span className="text-right">Actie</span>
        </div>
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index]!;
            const isSelected = selected.has(row.id);
            return (
              <div
                key={row.id}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className={`grid ${GRID_COLS} items-center gap-3 border-b px-3 text-sm hover:bg-muted/30 ${isSelected ? "bg-muted/40" : ""}`}
              >
                <span>
                  <input
                    type="checkbox"
                    className="size-4 align-middle"
                    checked={isSelected}
                    onChange={() => toggle(row.id)}
                    aria-label={`Selecteer ${row.sticker_id ?? row.id}`}
                  />
                </span>
                <span className="font-mono text-xs">{row.sticker_id ?? "—"}</span>
                <span className="truncate">
                  {row.title ?? row.working_title ?? (
                    <span className="italic text-muted-foreground">(geen titel)</span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">{row.category_slug}</span>
                <span>
                  <span className="inline-flex rounded-full border px-2 py-0.5 text-xs">
                    {row.status}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {row.indexed_at
                    ? new Date(row.indexed_at).toLocaleDateString("nl-NL", { dateStyle: "short" })
                    : "—"}
                </span>
                <span className="text-right">
                  <Link
                    href={`/inventory/${row.sticker_id ?? row.id}`}
                    className="text-xs underline"
                  >
                    Bekijk
                  </Link>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {enableActions && selected.size > 0 && (
        <div className="sticky bottom-4 z-20 flex items-center gap-3 rounded-lg border bg-background/95 px-4 py-3 shadow-lg backdrop-blur">
          <span className="text-sm font-medium">{selected.size} geselecteerd</span>
          <button
            type="button"
            onClick={() => setPrintOpen(true)}
            disabled={selectedStickerIds.length === 0}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
            title={
              selectedStickerIds.length === 0
                ? "Geen van de geselecteerde producten heeft een sticker-ID"
                : undefined
            }
          >
            Print stickers ({selectedStickerIds.length})
          </button>
          <button
            type="button"
            onClick={bulkAnalyze}
            disabled={analyzing}
            className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {analyzing ? "AI bezig…" : `✨ Analyseer (${selected.size})`}
          </button>
          <button
            type="button"
            onClick={bulkDelete}
            disabled={deleting}
            className="rounded-md border border-destructive px-3 py-1.5 text-sm text-destructive disabled:opacity-50"
          >
            {deleting ? "Verwijderen…" : "Verwijderen"}
          </button>
          {selectedStickerIds.length < selected.size && (
            <span className="text-xs text-muted-foreground">
              {selected.size - selectedStickerIds.length} zonder sticker-ID worden
              overgeslagen bij printen
            </span>
          )}
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs underline"
          >
            Selectie wissen
          </button>
        </div>
      )}

      {printOpen && (
        <PrintDialog
          stickerIds={selectedStickerIds}
          onClose={() => setPrintOpen(false)}
        />
      )}
    </div>
  );
}
