-- Phase 21: multi-tenant hardening
-- 1. Sticker-nummerruimte per gebruiker i.p.v. globaal
-- 2. app_settings per gebruiker (PK was alleen key → 1 teller voor iedereen)
-- 3. DEFAULT auth.uid() op alle user-tabellen (vangnet: inserts zonder
--    expliciete user_id faalden stil op de WITH CHECK policy)
-- 4. reserve_next_sticker: per-user ON CONFLICT
-- 5. profiles tabel + auto-aanmaak bij signup
-- 6. Storage isolatie: per-user mappen, legacy bestanden via owning-record

-- 1. Per-user sticker uniqueness
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sticker_id_key;
ALTER TABLE products ADD CONSTRAINT products_user_sticker_unique UNIQUE (user_id, sticker_id);
ALTER TABLE sticker_sheets DROP CONSTRAINT IF EXISTS sticker_sheets_start_number_key;
ALTER TABLE sticker_sheets ADD CONSTRAINT sticker_sheets_user_start_unique UNIQUE (user_id, start_number);

-- 2. app_settings per user
UPDATE app_settings SET user_id = (SELECT id FROM auth.users ORDER BY created_at LIMIT 1)
WHERE user_id IS NULL;
ALTER TABLE app_settings ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_pkey;
ALTER TABLE app_settings ADD PRIMARY KEY (key, user_id);

-- 3. DEFAULT auth.uid() als vangnet op alle user-data tabellen
ALTER TABLE products ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE photos ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE listings ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE bundles ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE bundle_items ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE sticker_sheets ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE buyback_quotes ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE price_history ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE claude_analyses ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE price_watches ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE taxatie_exports ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE app_settings ALTER COLUMN user_id SET DEFAULT auth.uid();

-- 4. reserve_next_sticker per-user conflict target
CREATE OR REPLACE FUNCTION reserve_next_sticker(p_count INT, p_user_id UUID)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  last_num INT;
  start_num INT;
  result TEXT[] := '{}';
  i INT;
BEGIN
  SELECT (value)::int INTO last_num
    FROM public.app_settings
    WHERE key = 'last_sticker_number' AND user_id = p_user_id
    FOR UPDATE;

  IF last_num IS NULL THEN
    last_num := 0;
    INSERT INTO public.app_settings(key, value, user_id)
      VALUES ('last_sticker_number', '0'::jsonb, p_user_id)
      ON CONFLICT (key, user_id) DO NOTHING;
  END IF;

  start_num := last_num + 1;
  IF start_num + p_count - 1 > 9999 THEN
    RAISE EXCEPTION 'sticker_range_overflow: last=% count=%', last_num, p_count;
  END IF;

  FOR i IN 0..(p_count - 1) LOOP
    result := array_append(result, lpad((start_num + i)::text, 4, '0'));
  END LOOP;

  UPDATE public.app_settings
    SET value = to_jsonb(last_num + p_count),
        updated_at = NOW()
    WHERE key = 'last_sticker_number' AND user_id = p_user_id;

  RETURN result;
END $$;

-- 5. profiles + signup bootstrap
CREATE TABLE IF NOT EXISTS profiles (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name     TEXT,
  display_language TEXT NOT NULL DEFAULT 'nl',
  listing_language TEXT NOT NULL DEFAULT 'nl',
  household        JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_profile" ON profiles;
CREATE POLICY "own_profile" ON profiles FOR ALL TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.app_settings (key, value, user_id)
    VALUES ('last_sticker_number', '0'::jsonb, NEW.id)
    ON CONFLICT (key, user_id) DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Backfill voor bestaande users
INSERT INTO profiles (id) SELECT id FROM auth.users ON CONFLICT (id) DO NOTHING;
INSERT INTO app_settings (key, value, user_id)
SELECT 'last_sticker_number', '0'::jsonb, u.id FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM app_settings s WHERE s.key = 'last_sticker_number' AND s.user_id = u.id
);

-- 6. Storage isolatie. Nieuwe uploads: {user_id}/... map. Legacy bestanden
-- (zonder user-prefix) blijven bereikbaar via het owning-record in de DB.
DROP POLICY IF EXISTS "auth_read_product_photos" ON storage.objects;
DROP POLICY IF EXISTS "auth_write_product_photos" ON storage.objects;
DROP POLICY IF EXISTS "auth_update_product_photos" ON storage.objects;
DROP POLICY IF EXISTS "auth_delete_product_photos" ON storage.objects;
DROP POLICY IF EXISTS "auth_read_bulk_uploads" ON storage.objects;
DROP POLICY IF EXISTS "auth_write_bulk_uploads" ON storage.objects;
DROP POLICY IF EXISTS "auth_delete_bulk_uploads" ON storage.objects;
DROP POLICY IF EXISTS "auth_read_taxatie_pdfs" ON storage.objects;
DROP POLICY IF EXISTS "auth_write_taxatie_pdfs" ON storage.objects;
DROP POLICY IF EXISTS "auth_read_sticker_sheets" ON storage.objects;
DROP POLICY IF EXISTS "auth_write_sticker_sheets" ON storage.objects;
DROP POLICY IF EXISTS "auth_delete_sticker_sheets" ON storage.objects;

CREATE POLICY "own_read_product_photos" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'product-photos' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (SELECT 1 FROM public.photos p WHERE p.storage_path = name AND p.user_id = auth.uid())
    )
  );
CREATE POLICY "own_write_product_photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own_update_product_photos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-photos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'product-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own_delete_product_photos" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-photos' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (SELECT 1 FROM public.photos p WHERE p.storage_path = name AND p.user_id = auth.uid())
    )
  );

CREATE POLICY "own_read_sticker_sheets" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'sticker-sheets' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (SELECT 1 FROM public.sticker_sheets ss WHERE ss.pdf_storage_path = name AND ss.user_id = auth.uid())
    )
  );
CREATE POLICY "own_write_sticker_sheets" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sticker-sheets' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own_delete_sticker_sheets" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'sticker-sheets' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (SELECT 1 FROM public.sticker_sheets ss WHERE ss.pdf_storage_path = name AND ss.user_id = auth.uid())
    )
  );

CREATE POLICY "own_read_taxatie_pdfs" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'taxatie-pdfs' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (SELECT 1 FROM public.taxatie_exports te WHERE te.pdf_storage_path = name AND te.user_id = auth.uid())
    )
  );
CREATE POLICY "own_write_taxatie_pdfs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'taxatie-pdfs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "own_all_bulk_uploads" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'bulk-uploads' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'bulk-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
