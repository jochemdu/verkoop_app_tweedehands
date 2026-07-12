-- Fase 29: marktonderzoek via MCP.
-- Claude (Desktop/claude.ai) zoekt op het web naar vergelijkbare producten
-- en advertenties en slaat de gestructureerde vondsten hier op, gekoppeld
-- aan een product. De web-app en latere prijs-adviezen lezen hieruit.

CREATE TABLE IF NOT EXISTS market_comparables (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,

  source              TEXT NOT NULL,        -- marktplaats / vinted / ebay / tweakers / webshop / anders
  url                 TEXT,
  title               TEXT NOT NULL,
  price               NUMERIC(10,2),
  currency            TEXT NOT NULL DEFAULT 'EUR',
  is_sold             BOOLEAN,              -- true = daadwerkelijk verkocht, false/null = vraagprijs
  condition           TEXT,
  brand               TEXT,
  model               TEXT,
  color               TEXT,
  description_snippet TEXT,                 -- relevante zinnen uit de advertentie
  notes               TEXT,                 -- Claude's duiding (bijv. "incl. 2 controllers")

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_comparables_product
  ON market_comparables(product_id, created_at DESC);

ALTER TABLE market_comparables ENABLE ROW LEVEL SECURITY;

-- Zelfde model als de rest (fase 21): iedereen ziet alleen eigen rijen;
-- de MCP-server draait met service_role en passeert RLS.
CREATE POLICY "own_market_comparables" ON market_comparables
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
