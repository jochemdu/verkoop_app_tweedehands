import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">VerkoopAssistent</h1>
        <LogoutButton />
      </header>

      <section className="rounded-lg border p-6">
        <p className="text-sm text-muted-foreground">Ingelogd als</p>
        <p className="text-lg font-medium">{user?.email ?? "onbekend"}</p>
      </section>

      <section className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Fase 1 — Foundation ✅</p>
        <p className="mt-1">
          De volgende fase implementeert het stickervel-systeem (zie PLAN (1).md sectie 3).
        </p>
      </section>
    </main>
  );
}
