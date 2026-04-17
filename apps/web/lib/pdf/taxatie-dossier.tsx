import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";

export type TaxatieProduct = {
  sticker_id: string | null;
  title: string | null;
  working_title: string | null;
  category_slug: string | null;
  condition: string | null;
  specs: Record<string, unknown> | null;
  defects: string[] | null;
  provenance_notes: string | null;
  estimated_value_min: number | null;
  estimated_value_max: number | null;
  recommended_price: number | null;
  photos: Array<{ url: string; photo_type: string | null }>;
};

export type TaxatieDossierProps = {
  recipient_name?: string;
  recipient_email?: string;
  notes?: string;
  seller_name?: string;
  products: TaxatieProduct[];
  generated_at: Date;
};

const styles = StyleSheet.create({
  page: {
    padding: "18mm",
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111111",
  },
  header: {
    borderBottom: "1pt solid #cccccc",
    paddingBottom: 8,
    marginBottom: 16,
  },
  h1: { fontSize: 20, fontWeight: 700 },
  muted: { color: "#666666", fontSize: 9 },
  introBlock: {
    marginBottom: 16,
    padding: 10,
    backgroundColor: "#f6f6f8",
    borderRadius: 4,
  },
  label: { fontSize: 8, color: "#666666", textTransform: "uppercase", letterSpacing: 0.5 },
  product: {
    marginBottom: 14,
    paddingBottom: 14,
    borderBottom: "0.5pt solid #eeeeee",
    // Probeer per-product op één pagina te houden.
    // @react-pdf respecteert `wrap={false}` op View.
  },
  productHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  productTitle: { fontSize: 12, fontWeight: 700 },
  stickerBadge: {
    fontFamily: "Courier-Bold",
    fontSize: 10,
    padding: "2 4",
    backgroundColor: "#111111",
    color: "#ffffff",
    borderRadius: 2,
  },
  photosRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 6,
  },
  photoWrap: {
    width: "32%",
    aspectRatio: 1,
    overflow: "hidden",
    borderRadius: 2,
  },
  photo: { width: "100%", height: "100%", objectFit: "cover" },
  detailsGrid: {
    flexDirection: "row",
    gap: 16,
    marginTop: 4,
  },
  detailsCol: { flex: 1 },
  keyValue: { flexDirection: "row", gap: 6, marginBottom: 2 },
  key: { color: "#666666", width: "35%", fontSize: 9 },
  value: { flex: 1, fontSize: 9 },
  footer: {
    position: "absolute",
    bottom: "10mm",
    left: "18mm",
    right: "18mm",
    paddingTop: 6,
    borderTop: "0.5pt solid #cccccc",
    fontSize: 8,
    color: "#888888",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

function fmtEur(n: number | null | undefined) {
  if (n == null) return "—";
  return `€ ${Number(n).toFixed(2).replace(".", ",")}`;
}

function ProductCard({ product, index }: { product: TaxatieProduct; index: number }) {
  const title = product.title ?? product.working_title ?? "(naamloos)";
  const specs = product.specs ?? {};
  const specEntries = Object.entries(specs).filter(
    ([, v]) => v != null && v !== "",
  );

  return (
    <View style={styles.product} wrap={false}>
      <View style={styles.productHeader}>
        <Text style={styles.productTitle}>
          {index + 1}. {title}
        </Text>
        {product.sticker_id && (
          <Text style={styles.stickerBadge}>{product.sticker_id}</Text>
        )}
      </View>

      {product.photos.length > 0 && (
        <View style={styles.photosRow}>
          {product.photos.slice(0, 6).map((p, i) => (
            <View key={i} style={styles.photoWrap}>
              <Image src={p.url} style={styles.photo} />
            </View>
          ))}
        </View>
      )}

      <View style={styles.detailsGrid}>
        <View style={styles.detailsCol}>
          <View style={styles.keyValue}>
            <Text style={styles.key}>Categorie</Text>
            <Text style={styles.value}>{product.category_slug ?? "—"}</Text>
          </View>
          {product.condition && (
            <View style={styles.keyValue}>
              <Text style={styles.key}>Conditie</Text>
              <Text style={styles.value}>{product.condition}</Text>
            </View>
          )}
          {specEntries.length > 0 &&
            specEntries.map(([k, v]) => (
              <View style={styles.keyValue} key={k}>
                <Text style={styles.key}>{k}</Text>
                <Text style={styles.value}>{String(v)}</Text>
              </View>
            ))}
        </View>

        <View style={styles.detailsCol}>
          {(product.estimated_value_min != null ||
            product.estimated_value_max != null) && (
            <View style={styles.keyValue}>
              <Text style={styles.key}>Waarde-indicatie</Text>
              <Text style={styles.value}>
                {fmtEur(product.estimated_value_min)} – {fmtEur(product.estimated_value_max)}
              </Text>
            </View>
          )}
          {product.recommended_price != null && (
            <View style={styles.keyValue}>
              <Text style={styles.key}>Adviesprijs</Text>
              <Text style={styles.value}>{fmtEur(product.recommended_price)}</Text>
            </View>
          )}
          {product.defects && product.defects.length > 0 && (
            <View style={styles.keyValue}>
              <Text style={styles.key}>Gebreken</Text>
              <Text style={styles.value}>{product.defects.join(", ")}</Text>
            </View>
          )}
          {product.provenance_notes && (
            <View style={styles.keyValue}>
              <Text style={styles.key}>Herkomst</Text>
              <Text style={styles.value}>{product.provenance_notes}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

export function TaxatieDossier(props: TaxatieDossierProps) {
  const { recipient_name, recipient_email, notes, seller_name, products, generated_at } = props;
  return (
    <Document
      title={`Taxatiedossier ${generated_at.toISOString().slice(0, 10)}`}
      creator="VerkoopAssistent"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.h1}>Taxatiedossier</Text>
          <Text style={styles.muted}>
            {products.length} {products.length === 1 ? "item" : "items"} · opgesteld{" "}
            {generated_at.toLocaleDateString("nl-NL", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </Text>
        </View>

        <View style={styles.introBlock}>
          <View style={styles.detailsGrid}>
            <View style={styles.detailsCol}>
              {seller_name && (
                <View style={styles.keyValue}>
                  <Text style={styles.key}>Aanbieder</Text>
                  <Text style={styles.value}>{seller_name}</Text>
                </View>
              )}
              {recipient_name && (
                <View style={styles.keyValue}>
                  <Text style={styles.key}>T.a.v.</Text>
                  <Text style={styles.value}>{recipient_name}</Text>
                </View>
              )}
              {recipient_email && (
                <View style={styles.keyValue}>
                  <Text style={styles.key}>E-mail</Text>
                  <Text style={styles.value}>{recipient_email}</Text>
                </View>
              )}
            </View>
            {notes && (
              <View style={styles.detailsCol}>
                <Text style={styles.label}>Notities</Text>
                <Text style={{ fontSize: 9, marginTop: 2 }}>{notes}</Text>
              </View>
            )}
          </View>
        </View>

        {products.map((p, i) => (
          <ProductCard key={i} product={p} index={i} />
        ))}

        <View style={styles.footer} fixed>
          <Text>VerkoopAssistent · persoonlijk taxatiedossier</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
