import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspace";
import { BulkUpload } from "./bulk-upload";

export default async function UploadPage() {
  const supabase = await createClient();
  const t = await getTranslations("upload");
  const wsId = await getActiveWorkspaceId(supabase);
  const { data: settingRaw } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "last_sticker_number")
    .eq("workspace_id", wsId ?? "")
    .maybeSingle();
  const lastUsed = Number(settingRaw?.value ?? 0);
  const suggestedStart = lastUsed > 0 ? String(lastUsed + 1).padStart(4, "0") : "0001";

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("pageTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("pageSubtitle")}</p>
      </div>
      <BulkUpload suggestedStart={suggestedStart} />
    </main>
  );
}
