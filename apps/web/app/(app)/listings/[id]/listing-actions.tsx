"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { CheckCircle2, ExternalLink } from "lucide-react";
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

// Deep-links naar de "plaats advertentie"-flow per platform. De officiële
// Marktplaats-API vereist een partner-contract, dus posten we niet via API maar
// openen we de plaats-pagina zodat de gebruiker de gekopieerde tekst plakt.
const SELL_URLS: Record<string, string> = {
  marktplaats: "https://www.marktplaats.nl/plaats",
  "2dehands": "https://www.2dehands.be/plaats",
  vinted: "https://www.vinted.nl/items/new",
  ebay: "https://www.ebay.nl/sl/sell",
};

export function ListingActions({
  listing,
  platformName,
  platformSlug,
  platformBaseUrl,
  productStickerId,
}: {
  listing: Listing;
  platformName: string;
  platformSlug: string;
  platformBaseUrl: string | null;
  productStickerId: string;
}) {
  const router = useRouter();
  const t = useTranslations("listings");
  const sellUrl = SELL_URLS[platformSlug] ?? platformBaseUrl ?? null;
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
    if (!res.ok) throw new Error(json.error ?? t("updateFailed"));
    return json;
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await patch(form);
      toast.success(t("saved"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("unknown"));
    } finally {
      setSaving(false);
    }
  }

  async function approve() {
    setSaving(true);
    try {
      await patch({ status: "approved", ...form });
      toast.success(t("approved", { platform: platformName }));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("unknown"));
    } finally {
      setSaving(false);
    }
  }

  async function markPublished() {
    if (!listingUrl) {
      toast.error(t("needUrl"));
      return;
    }
    setPublishing(true);
    try {
      await patch({ status: "published", listing_url: listingUrl });
      toast.success(t("markedPublished"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("unknown"));
    } finally {
      setPublishing(false);
    }
  }

  async function copyToClipboard() {
    const full = `${form.final_title}\n\n${form.final_description}\n\n${t("copyPriceLabel")}: €${form.price.toFixed(
      2,
    )}\n${t("copyShippingLabel")}: €${form.shipping_price.toFixed(2)}\n\n${t("copyStickerLabel")}: ${productStickerId}`;
    try {
      await navigator.clipboard.writeText(full);
      toast.success(t("copied", { platform: platformName }));
    } catch {
      toast.error(t("clipboardUnavailable"));
    }
  }

  const isPublished = listing.status === "published";
  const isApproved = listing.status === "approved";

  return (
    <div className="space-y-6">
      {/* Edit form */}
      <form onSubmit={saveEdit} className="card space-y-4 p-5">
        <h2 className="section-title">{t("adText")}</h2>

        <label className="block space-y-1 text-sm">
          <span className="font-medium">{t("titleLabel")}</span>
          <input
            value={form.final_title}
            onChange={(e) => setForm({ ...form, final_title: e.target.value })}
            className="input"
            disabled={isPublished}
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium">{t("descLabel")}</span>
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
            <span className="font-medium">{t("priceLabel")}</span>
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
            <span className="font-medium">{t("shipLabel")}</span>
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
            {t("saveChanges")}
          </button>
          <button
            type="button"
            onClick={copyToClipboard}
            className="btn btn-outline"
          >
            {t("copyText")}
          </button>
          {sellUrl && !isPublished && (
            <a
              href={sellUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => void copyToClipboard()}
              className="btn btn-accent"
            >
              <ExternalLink className="size-4" aria-hidden />
              {t("openPlatform", { platform: platformName })}
            </a>
          )}
        </div>
      </form>

      {/* Status flow */}
      {!isPublished && (
        <div className="card p-5 space-y-4">
          <h2 className="section-title">{t("workflow")}</h2>

          {!isApproved ? (
            <div className="space-y-2">
              <p className="text-sm">{t("reviewPrompt")}</p>
              <button
                onClick={approve}
                disabled={saving}
                className="btn btn-accent"
              >
                {saving ? t("busy") : t("approve")}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-md bg-muted p-3 text-sm">
                <p className="font-medium">{t("nextStepOn", { platform: platformName })}</p>
                <ol className="mt-2 list-decimal pl-5 text-xs text-muted-foreground">
                  <li>{t("step1")}</li>
                  <li>{t("step2", { platform: platformName })}</li>
                  <li>{t("step3")}</li>
                  <li>{t("step4")}</li>
                </ol>
              </div>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">{t("urlLabel")}</span>
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
                {publishing ? t("busy") : t("markPublished")}
              </button>
            </div>
          )}
        </div>
      )}

      {isPublished && listing.listing_url && (
        <div className="rounded-xl border border-accent bg-accent-soft p-5 text-sm">
          <p className="flex items-center gap-1.5 font-medium text-accent">
            <CheckCircle2 className="size-4" aria-hidden />
            {t("publishedTitle")}
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
