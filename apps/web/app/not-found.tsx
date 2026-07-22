import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Compass } from "lucide-react";

// Globale 404 i.p.v. de kale Next.js-default.
export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Compass className="size-7" aria-hidden />
      </span>
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          {t("nfTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("nfDesc")}</p>
      </div>
      <Link href="/" className="btn btn-accent">
        {t("home")}
      </Link>
    </main>
  );
}
