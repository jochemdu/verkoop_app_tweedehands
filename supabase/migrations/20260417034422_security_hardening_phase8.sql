-- Phase 8: security hardening
-- 1. Add user_id + deleted_at to all user-data tables
-- 2. Backfill existing rows (single-user repo) met eerste auth user
-- 3. Replace RLS policies met auth.uid() = user_id
-- 4. DB function voor atomic sticker-ID reservation

-- 1a: Add user_id kolommen
ALTER TABLE products ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE photos ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE bundles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE bundle_items ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE sticker_sheets ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE buyback_quotes ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE price_history ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE claude_analyses ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE price_watches ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE taxatie_exports ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 1b: Add deleted_at voor soft-delete
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE bundles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2: Backfill — pak eerste user (solo-user context, rows zijn van diegene)
DO $$
DECLARE
  default_user UUID;
BEGIN
  SELECT id INTO default_user FROM auth.users ORDER BY created_at LIMIT 1;
  IF default_user IS NOT NULL THEN
    UPDATE products SET user_id = default_user WHERE user_id IS NULL;
    UPDATE photos SET user_id = default_user WHERE user_id IS NULL;
    UPDATE listings SET user_id = default_user WHERE user_id IS NULL;
    UPDATE bundles SET user_id = default_user WHERE user_id IS NULL;
    UPDATE bundle_items SET user_id = default_user WHERE user_id IS NULL;
    UPDATE sticker_sheets SET user_id = default_user WHERE user_id IS NULL;
    UPDATE buyback_quotes SET user_id = default_user WHERE user_id IS NULL;
    UPDATE price_history SET user_id = default_user WHERE user_id IS NULL;
    UPDATE claude_analyses SET user_id = default_user WHERE user_id IS NULL;
    UPDATE price_watches SET user_id = default_user WHERE user_id IS NULL;
    UPDATE taxatie_exports SET user_id = default_user WHERE user_id IS NULL;
    UPDATE app_settings SET user_id = default_user WHERE user_id IS NULL;
  END IF;
END $$;

-- 3: Vervang RLS policies door user_id-scoped varianten
DROP POLICY IF EXISTS "auth_full_access_sticker_sheets" ON sticker_sheets;
DROP POLICY IF EXISTS "auth_full_access_products" ON products;
DROP POLICY IF EXISTS "auth_full_access_photos" ON photos;
DROP POLICY IF EXISTS "auth_full_access_buyback_quotes" ON buyback_quotes;
DROP POLICY IF EXISTS "auth_full_access_listings" ON listings;
DROP POLICY IF EXISTS "auth_full_access_price_history" ON price_history;
DROP POLICY IF EXISTS "auth_full_access_bundles" ON bundles;
DROP POLICY IF EXISTS "auth_full_access_bundle_items" ON bundle_items;
DROP POLICY IF EXISTS "auth_full_access_claude_analyses" ON claude_analyses;
DROP POLICY IF EXISTS "auth_full_access_price_watches" ON price_watches;
DROP POLICY IF EXISTS "auth_full_access_taxatie_exports" ON taxatie_exports;
DROP POLICY IF EXISTS "auth_full_access_app_settings" ON app_settings;

CREATE POLICY "own_sticker_sheets" ON sticker_sheets FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_products" ON products FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_photos" ON photos FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_buyback_quotes" ON buyback_quotes FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_listings" ON listings FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_price_history" ON price_history FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_bundles" ON bundles FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_bundle_items" ON bundle_items FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_claude_analyses" ON claude_analyses FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_price_watches" ON price_watches FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_taxatie_exports" ON taxatie_exports FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_app_settings" ON app_settings FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 4: DB function voor atomic sticker-ID reservation.
-- Gebruikt row-level lock op app_settings rij, dus parallel-safe.
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
  -- Lock app_settings row voor deze user atomisch.
  SELECT (value)::int INTO last_num
    FROM public.app_settings
    WHERE key = 'last_sticker_number' AND user_id = p_user_id
    FOR UPDATE;

  IF last_num IS NULL THEN
    last_num := 0;
    INSERT INTO public.app_settings(key, value, user_id)
      VALUES ('last_sticker_number', '0'::jsonb, p_user_id)
      ON CONFLICT (key) DO NOTHING;
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

GRANT EXECUTE ON FUNCTION reserve_next_sticker(INT, UUID) TO authenticated;
