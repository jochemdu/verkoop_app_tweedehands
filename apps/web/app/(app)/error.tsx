"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";

// Foutgrens voor alle app-schermen: nette herstel-UI met retry i.p.v. de
// Next.js-default. Client-component (vereist door error.tsx-contract).
export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");
  return (
    <main className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-warning-soft text-warning">
        <AlertTriangle className="size-7" aria-hidden />
      </span>
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          {t("title")}
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {t("description")}
        </p>
      </div>
      <div className="flex gap-2">
        <button onClick={reset} className="btn btn-accent">
          {t("retry")}
        </button>
        <Link href="/" className="btn btn-outline">
          {t("home")}
        </Link>
      </div>
    </main>
  );
}
