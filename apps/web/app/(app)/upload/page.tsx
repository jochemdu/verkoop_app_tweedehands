import { createClient } from "@/lib/supabase/server";
import { BulkUpload } from "./bulk-upload";

export default async function UploadPage() {
  const supabase = await createClient();
  const { data: settingRaw } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "last_sticker_number")
    .maybeSingle();
  const lastUsed = Number(settingRaw?.value ?? 0);
  const suggestedStart = lastUsed > 0 ? String(lastUsed + 1).padStart(4, "0") : "0001";

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bulk foto upload</h1>
        <p className="text-sm text-muted-foreground">
          Sleep meerdere foto&apos;s hierin. Elke foto wordt een apart product
          met een oplopende sticker-ID.
        </p>
      </div>
      <BulkUpload suggestedStart={suggestedStart} />
    </main>
  );
}
