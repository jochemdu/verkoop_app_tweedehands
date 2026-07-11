-- Storage buckets. Deze bestonden alleen via het dashboard — hier vastgelegd
-- zodat een verse omgeving (supabase db reset / nieuw project) ze ook krijgt.
-- Idempotent: bestaande buckets blijven ongemoeid.
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('product-photos', 'product-photos', false),
  ('bulk-uploads', 'bulk-uploads', false),
  ('sticker-sheets', 'sticker-sheets', false),
  ('taxatie-pdfs', 'taxatie-pdfs', false)
ON CONFLICT (id) DO NOTHING;
