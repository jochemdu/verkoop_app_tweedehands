"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { resizeImage } from "@/lib/image";
import type { RoomAudit } from "@/lib/ai/room-audit";

const MAX_PHOTOS = 4;

const CONFIDENCE_LABEL: Record<string, string> = {
  high: "zeker",
  medium: "redelijk zeker",
  low: "gok",
};

export function RoomAuditSection({ userId }: { userId: string }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [roomName, setRoomName] = useState("");
  const [busy, setBusy] = useState(false);
  const [audit, setAudit] = useState<RoomAudit | null>(null);
  // Aangevinkt = stub maken. Default: alles wat nog niet geïndexeerd lijkt.
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [creating, setCreating] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);

  function pickFiles(list: FileList | null) {
    if (!list) return;
    const imgs = Array.from(list)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, MAX_PHOTOS);
    setFiles(imgs);
  }

  async function runScan() {
    if (files.length === 0) {
      toast.error("Kies eerst één of meer kamerfoto's");
      return;
    }
    setBusy(true);
    setAudit(null);
    setCreatedCount(0);
    const t = toast.loading("AI scant de kamer… (kan ~1 min duren)");
    const supabase = createClient();
    const uploadedPaths: string[] = [];
    try {
      // Upload (verkleind) naar een eigen map; na de scan ruimen we ze op.
      for (let i = 0; i < files.length; i++) {
        const resized = await resizeImage(files[i]!);
        const path = `${userId}/room-audits/${Date.now()}_${i}.jpg`;
        const { error } = await supabase.storage
          .from("product-photos")
          .upload(path, resized, { contentType: "image/jpeg" });
        if (error) throw new Error(`Upload mislukt: ${error.message}`);
        uploadedPaths.push(path);
      }

      const res = await fetch("/api/suggestions/room-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photo_paths: uploadedPaths,
          room_name: roomName.trim() || undefined,
        }),
      });
      const json = (await res.json()) as { audit?: RoomAudit; error?: string };
      if (!res.ok || !json.audit) {
        toast.error(json.error ?? "Room audit mislukt");
        return;
      }
      setAudit(json.audit);
      setSelected(
        new Set(
          json.audit.items
            .map((item, i) => (item.probably_indexed ? -1 : i))
            .filter((i) => i >= 0),
        ),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Room audit mislukt");
      // De API-route ruimt de kamerfoto's op; dit vangt alleen het geval
      // dat de upload of het request zelf strandde vóór de route draaide.
      if (uploadedPaths.length > 0) {
        await supabase.storage.from("product-photos").remove(uploadedPaths);
      }
    } finally {
      toast.dismiss(t);
      setBusy(false);
    }
  }

  function toggle(i: number) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function createStubs() {
    if (!audit || selected.size === 0) return;
    setCreating(true);
    try {
      const supabase = createClient();
      const rows = audit.items
        .filter((_, i) => selected.has(i))
        .map((item) => ({
          working_title: item.name,
          category_slug: item.category_slug,
          indexing_notes: [
            `Geschatte waarde: ${item.estimated_value} (${CONFIDENCE_LABEL[item.confidence] ?? item.confidence})`,
            `[locatie] ${roomName.trim() ? `${roomName.trim()} — ` : ""}${item.location_hint}`,
            "[stub] Aangemaakt via room-foto-scan, nog fysiek lokaliseren + sticker plakken + foto's maken.",
          ].join("\n"),
          status: "indexed",
          user_id: userId,
        }));
      const { error } = await supabase.from("products").insert(rows);
      if (error) {
        toast.error(`Stubs aanmaken mislukt: ${error.message}`);
        return;
      }
      setCreatedCount(rows.length);
      setSelected(new Set());
      toast.success(`${rows.length} stub-product(en) aangemaakt`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        📷 Kamer-scan
      </h2>
      <p className="text-xs text-muted-foreground">
        Maak een foto van een kamer, zolder of schuur — de AI benoemt alle
        verkoopbare items en checkt wat je al geïndexeerd hebt. Van gemiste
        items maak je met één klik een stub-product (sticker + foto&apos;s doe je
        later fysiek).
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-sm">
          <span className="text-xs text-muted-foreground">Ruimte (optioneel)</span>
          <input
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="bijv. zolder, garage…"
            className="block w-44 rounded-md border px-3 py-1.5 text-sm"
          />
        </label>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => pickFiles(e.target.files)}
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="rounded-md border px-3 py-1.5 text-sm"
        >
          {files.length > 0
            ? `${files.length} foto('s) gekozen`
            : `Kies foto's (max ${MAX_PHOTOS})`}
        </button>
        <button
          type="button"
          onClick={runScan}
          disabled={busy || files.length === 0}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
        >
          {busy ? "AI scant…" : "✨ Scan kamer"}
        </button>
      </div>

      {audit && (
        <div className="space-y-3">
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <p className="font-medium">{audit.room_guess}</p>
            <p className="mt-1 text-xs text-muted-foreground">{audit.summary}</p>
          </div>

          <ul className="grid gap-2 sm:grid-cols-2">
            {audit.items.map((item, i) => (
              <li
                key={i}
                className={`rounded-md border p-3 ${item.probably_indexed ? "opacity-70" : ""}`}
              >
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4"
                    checked={selected.has(i)}
                    onChange={() => toggle(i)}
                  />
                  <span className="min-w-0 flex-1 space-y-0.5">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{item.name}</span>
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        {item.estimated_value}
                      </span>
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      📍 {item.location_hint} · {item.category_slug} ·{" "}
                      {CONFIDENCE_LABEL[item.confidence] ?? item.confidence}
                      {item.probably_indexed && (
                        <span className="ml-1 rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                          al geïndexeerd?
                        </span>
                      )}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={createStubs}
              disabled={creating || selected.size === 0}
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
            >
              {creating
                ? "Aanmaken…"
                : `Maak ${selected.size} stub-product(en)`}
            </button>
            {createdCount > 0 && (
              <Link href="/inventory" className="text-sm underline">
                Bekijk {createdCount} nieuwe stub(s) in inventaris →
              </Link>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
