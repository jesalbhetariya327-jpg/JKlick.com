CREATE POLICY "Product photos readable by everyone" ON storage.objects FOR SELECT USING (bucket_id = 'product-photos');
CREATE POLICY "Owners can upload product photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-photos');
CREATE POLICY "Owners can update product photos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'product-photos');
CREATE POLICY "Owners can delete product photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-photos');