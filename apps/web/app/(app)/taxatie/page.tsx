import { createClient } from "@/lib/supabase/server";
import { TaxatieForm } from "./taxatie-form";

export default async function TaxatiePage() {
  const supabase = await createClient();

  // Alle producten beschikbaar voor taxatie (bevat ook al-geanalyseerde items).
  const { data: products } = await supabase
    .from("products")
    .select("id, sticker_id, working_title, title, category_slug, status")
    .in("category_slug", ["antique_tin", "antique_silver", "antique_other"])
    .order("sticker_id", { ascending: true });

  // Eerder gegenereerde dossiers.
  const { data: exportsRaw } = await supabase
    .from("taxatie_exports")
    .select("id, recipient_name, recipient_email, exported_at, pdf_storage_path")
    .order("exported_at", { ascending: false })
    .limit(10);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Taxatiedossier</h1>
        <p className="text-sm text-muted-foreground">
          Selecteer antieke items → genereer PDF dossier voor de taxateur
          met foto&apos;s, specs, herkomst en waardering.
        </p>
      </div>

      <TaxatieForm products={products ?? []} />

      {exportsRaw && exportsRaw.length > 0 && (
        <section>
          <h2 className="section-title mb-3">
            Eerder gegenereerd
          </h2>
          <ul className="card divide-y divide-border">
            {exportsRaw.map((e) => (
              <li key={e.id} className="flex items-center justify-between p-3 text-sm">
                <span>
                  {e.recipient_name ?? "(geen ontvanger)"}
                  {e.recipient_email && (
                    <span className="ml-2 text-muted-foreground">
                      {e.recipient_email}
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {e.exported_at
                    ? new Date(e.exported_at).toLocaleString("nl-NL", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })
                    : "—"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
