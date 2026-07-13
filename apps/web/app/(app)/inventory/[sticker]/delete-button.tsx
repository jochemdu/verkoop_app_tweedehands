"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export function DeleteButton({ productId }: { productId: string }) {
  const router = useRouter();
  const t = useTranslations("product");

  async function onDelete() {
    if (!confirm(t("deleteConfirm"))) {
      return;
    }
    const res = await fetch(`/api/products/${productId}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? t("deleteFailed"));
      return;
    }
    toast.success(t("deleted"));
    router.push("/inventory");
    router.refresh();
  }

  return (
    <button
      onClick={onDelete}
      className="btn border border-destructive/40 bg-transparent text-destructive hover:bg-destructive/10"
    >
      {t("deleteBtn")}
    </button>
  );
}
