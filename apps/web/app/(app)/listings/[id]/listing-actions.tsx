"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import type { ListingStatus } from "@verkoopassistent/shared";

type Listing = {
  id: string;
  status: ListingStatus | null;
  price: number;
  shipping_price: number;
  final_title: string;
  final_description: string;
  listing_url: string | null;
  external_id: string | null;
};

export function ListingActions({
  listing,
  platformName,
  productStickerId,
}: {
  listing: Listing;
  platformName: string;
  productStickerId: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    final_title: listing.final_title,
    final_description: listing.final_description,
    price: listing.price,
    shipping_price: listing.shipping_price,
  });
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [listingUrl, setListingUrl] = useState(listing.listing_url ?? "");

  async function patch(payload: Record<string, unknown>) {
    const res = await fetch(`/api/listings/${listing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Update faalde");
    return json;
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await patch(form);
      toast.success("Opgeslagen");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "onbekend");
    } finally {
      setSaving(false);
    }
  }

  async function approve() {
    setSaving(true);
    try {
      await patch({ status: "approved", ...form });
      toast.success("Goedgekeurd — nu kun je hem op " + platformName + " plaatsen.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "onbekend");
    } finally {
      setSaving(false);
    }
  }

  async function markPublished() {
    if (!listingUrl) {
      toast.error("Plak eerst de URL van de geplaatste advertentie.");
      return;
    }
    setPublishing(true);
    try {
      await patch({ status: "published", listing_url: listingUrl });
      toast.success("Gemarkeerd als gepubliceerd");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "onbekend");
    } finally {
      setPublishing(false);
    }
  }

  async function copyToClipboard() {
    const full = `${form.final_title}\n\n${form.final_description}\n\nPrijs: €${form.price.toFixed(
      2,
    )}\nVerzending: €${form.shipping_price.toFixed(2)}\n\nSticker-ID: ${productStickerId}`;
    try {
      await navigator.clipboard.writeText(full);
      toast.success("Gekopieerd — plak op " + platformName);
    } catch {
      toast.error("Clipboard niet beschikbaar");
    }
  }

  const isPublished = listing.status === "published";
  const isApproved = listing.status === "approved";

  return (
    <div className="space-y-6">
      {/* Edit form */}
      <form onSubmit={saveEdit} className="card space-y-4 p-5">
        <h2 className="section-title">
          Advertentie-tekst
        </h2>

        <label className="block space-y-1 text-sm">
          <span className="font-medium">Titel</span>
          <input
            value={form.final_title}
            onChange={(e) => setForm({ ...form, final_title: e.target.value })}
            className="input"
            disabled={isPublished}
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium">Omschrijving</span>
          <textarea
            rows={10}
            value={form.final_description}
            onChange={(e) =>
              setForm({ ...form, final_description: e.target.value })
            }
            className="input font-mono"
            disabled={isPublished}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Prijs €</span>
            <input
              type="number"
              step="0.01"
              value={form.price}
              onChange={(e) =>
                setForm({ ...form, price: Number(e.target.value) })
              }
              className="input"
              disabled={isPublished}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Verzending €</span>
            <input
              type="number"
              step="0.01"
              value={form.shipping_price}
              onChange={(e) =>
                setForm({ ...form, shipping_price: Number(e.target.value) })
              }
              className="input"
              disabled={isPublished}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={saving || isPublished}
            className="btn btn-outline"
          >
            Wijzigingen opslaan
          </button>
          <button
            type="button"
            onClick={copyToClipboard}
            className="btn btn-outline"
          >
            Kopieer tekst
          </button>
        </div>
      </form>

      {/* Status flow */}
      {!isPublished && (
        <div className="card p-5 space-y-4">
          <h2 className="section-title">
            Workflow
          </h2>

          {!isApproved ? (
            <div className="space-y-2">
              <p className="text-sm">
                Review de tekst hierboven. Klaar? Goedkeuren als volgende stap.
              </p>
              <button
                onClick={approve}
                disabled={saving}
                className="btn btn-accent"
              >
                {saving ? "Bezig…" : "Goedkeuren"}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-md bg-muted p-3 text-sm">
                <p className="font-medium">Volgende stap op {platformName}:</p>
                <ol className="mt-2 list-decimal pl-5 text-xs text-muted-foreground">
                  <li>Klik <em>Kopieer tekst</em> hierboven</li>
                  <li>Plaats de advertentie op {platformName}</li>
                  <li>Kopieer de URL van de geplaatste advertentie</li>
                  <li>Plak hieronder en klik <em>Markeer gepubliceerd</em></li>
                </ol>
              </div>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">URL geplaatste advertentie</span>
                <input
                  type="url"
                  value={listingUrl}
                  onChange={(e) => setListingUrl(e.target.value)}
                  placeholder="https://www.marktplaats.nl/a/..."
                  className="input"
                />
              </label>
              <button
                onClick={markPublished}
                disabled={publishing}
                className="btn btn-accent"
              >
                {publishing ? "Bezig…" : "Markeer gepubliceerd"}
              </button>
            </div>
          )}
        </div>
      )}

      {isPublished && listing.listing_url && (
        <div className="rounded-xl border border-accent bg-accent-soft p-5 text-sm">
          <p className="flex items-center gap-1.5 font-medium text-accent">
            <CheckCircle2 className="size-4" aria-hidden />
            Gepubliceerd
          </p>
          <a
            href={listing.listing_url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block break-all text-xs text-accent underline"
          >
            {listing.listing_url}
          </a>
        </div>
      )}
    </div>
  );
}
