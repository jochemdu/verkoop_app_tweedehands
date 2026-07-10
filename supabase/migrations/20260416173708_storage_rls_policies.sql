-- Storage RLS policies: authenticated users mogen files lezen/schrijven
-- in alle app-buckets. De service role bypass RLS automatisch.

CREATE POLICY "auth_read_product_photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-photos');

CREATE POLICY "auth_write_product_photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-photos');

CREATE POLICY "auth_update_product_photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-photos') WITH CHECK (bucket_id = 'product-photos');

CREATE POLICY "auth_delete_product_photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-photos');

CREATE POLICY "auth_read_bulk_uploads"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'bulk-uploads');

CREATE POLICY "auth_write_bulk_uploads"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bulk-uploads');

CREATE POLICY "auth_delete_bulk_uploads"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'bulk-uploads');

CREATE POLICY "auth_read_taxatie_pdfs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'taxatie-pdfs');

CREATE POLICY "auth_write_taxatie_pdfs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'taxatie-pdfs');

CREATE POLICY "auth_read_sticker_sheets"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'sticker-sheets');

CREATE POLICY "auth_write_sticker_sheets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sticker-sheets');

CREATE POLICY "auth_delete_sticker_sheets"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'sticker-sheets');
