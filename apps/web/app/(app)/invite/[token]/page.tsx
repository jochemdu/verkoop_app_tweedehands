import { getTranslations } from "next-intl/server";
import { InviteAccept } from "./accept";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const t = await getTranslations("invite");

  return (
    <main className="mx-auto max-w-md space-y-6 py-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <InviteAccept token={token} />
    </main>
  );
}
