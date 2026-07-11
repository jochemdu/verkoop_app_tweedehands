"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function DeleteButton({ productId }: { productId: string }) {
  const router = useRouter();

  async function onDelete() {
    if (!confirm("Product + foto's verwijderen? Dit kan niet ongedaan worden gemaakt.")) {
      return;
    }
    const res = await fetch(`/api/products/${productId}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "Verwijderen mislukt");
      return;
    }
    toast.success("Verwijderd");
    router.push("/inventory");
    router.refresh();
  }

  return (
    <button
      onClick={onDelete}
      className="btn border border-destructive/40 bg-transparent text-destructive hover:bg-destructive/10"
    >
      Verwijderen
    </button>
  );
}
