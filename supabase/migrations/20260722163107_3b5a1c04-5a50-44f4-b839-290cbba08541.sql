
CREATE POLICY "admins read knowledge-base" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'knowledge-base' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins write knowledge-base" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'knowledge-base' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete knowledge-base" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'knowledge-base' AND public.has_role(auth.uid(), 'admin'));
