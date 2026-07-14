"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Check, CheckCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// RLS (own_price_alerts) beperkt de update tot eigen rijen, dus een user-filter
// is niet nodig.
export function MarkReadButton({ id }: { id: string }) {
  const t = useTranslations("alerts");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function mark() {
    setBusy(true);
    const { error } = await createClient()
      .from("price_alerts")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    setBusy(false);
    if (error) {
      toast.error(t("markFailed"));
      return;
    }
    router.refresh();
  }
  return (
    <button
      type="button"
      onClick={mark}
      disabled={busy}
      className="btn btn-ghost px-2 py-1 text-xs"
    >
      <Check className="size-3.5" aria-hidden /> {t("markRead")}
    </button>
  );
}

export function MarkAllReadButton() {
  const t = useTranslations("alerts");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function mark() {
    setBusy(true);
    const { error } = await createClient()
      .from("price_alerts")
      .update({ read_at: new Date().toISOString() })
      .is("read_at", null);
    setBusy(false);
    if (error) {
      toast.error(t("markFailed"));
      return;
    }
    router.refresh();
  }
  return (
    <button
      type="button"
      onClick={mark}
      disabled={busy}
      className="btn btn-outline"
    >
      <CheckCheck className="size-4" aria-hidden /> {t("markAllRead")}
    </button>
  );
}
