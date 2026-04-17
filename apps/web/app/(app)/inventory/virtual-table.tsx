"use client";

import { useRef } from "react";
import Link from "next/link";
import { useVirtualizer } from "@tanstack/react-virtual";

type Row = {
  id: string;
  sticker_id: string | null;
  working_title: string | null;
  title: string | null;
  category_slug: string | null;
  status: string | null;
  indexed_at: string | null;
};

export function VirtualTable({ rows }: { rows: Row[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 10,
  });

  if (rows.length === 0) return null;

  return (
    <div
      ref={parentRef}
      className="max-h-[70vh] overflow-auto rounded-lg border"
    >
      <div className="sticky top-0 z-10 grid grid-cols-[80px_1fr_140px_120px_120px_80px] gap-3 border-b bg-muted/80 px-3 py-2 text-xs uppercase text-muted-foreground backdrop-blur">
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
              className="grid grid-cols-[80px_1fr_140px_120px_120px_80px] items-center gap-3 border-b px-3 text-sm hover:bg-muted/30"
            >
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
  );
}
