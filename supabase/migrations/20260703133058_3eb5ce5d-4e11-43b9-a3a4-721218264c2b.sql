
-- Articles: allow comercial to insert/update/delete
CREATE POLICY "Comercial can insert articles" ON public.articles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'comercial'));
CREATE POLICY "Comercial can update articles" ON public.articles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'comercial'));
CREATE POLICY "Comercial can delete articles" ON public.articles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'comercial'));

-- Categories: allow comercial to insert/update/delete
CREATE POLICY "Comercial can insert categories" ON public.categories
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'comercial'));
CREATE POLICY "Comercial can update categories" ON public.categories
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'comercial'));
CREATE POLICY "Comercial can delete categories" ON public.categories
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'comercial'));

-- Storage: allow comercial to manage article-images bucket
CREATE POLICY "Comercial can upload article images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'article-images' AND public.has_role(auth.uid(), 'comercial'));
CREATE POLICY "Comercial can update article images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'article-images' AND public.has_role(auth.uid(), 'comercial'));
CREATE POLICY "Comercial can delete article images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'article-images' AND public.has_role(auth.uid(), 'comercial'));
