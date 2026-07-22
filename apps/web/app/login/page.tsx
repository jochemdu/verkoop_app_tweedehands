import { Tag } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  const t = await getTranslations("login");
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      {/* Warme radial-gloed op de achtergrond. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60rem 40rem at 50% -10%, var(--color-accent-soft), transparent 70%)",
        }}
      />
      <div className="card w-full max-w-sm space-y-6 p-8 shadow-lg">
        <div className="space-y-3 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-accent text-accent-foreground shadow-sm">
            <Tag className="size-6" aria-hidden />
          </span>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
