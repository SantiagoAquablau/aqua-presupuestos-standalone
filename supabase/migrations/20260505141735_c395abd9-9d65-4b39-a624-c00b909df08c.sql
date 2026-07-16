
-- Articles: restrict writes to admins
DROP POLICY IF EXISTS "Authenticated can insert articles" ON public.articles;
DROP POLICY IF EXISTS "Authenticated can update articles" ON public.articles;
CREATE POLICY "Admins can insert articles" ON public.articles
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update articles" ON public.articles
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Categories: restrict writes to admins
DROP POLICY IF EXISTS "Authenticated can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated can update categories" ON public.categories;
CREATE POLICY "Admins can insert categories" ON public.categories
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update categories" ON public.categories
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Suppliers: restrict writes to admins (update already admin; tighten insert)
DROP POLICY IF EXISTS "Authenticated can insert suppliers" ON public.suppliers;
CREATE POLICY "Admins can insert suppliers" ON public.suppliers
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Storage: stair-images DELETE — require admin
DROP POLICY IF EXISTS "Admins can delete stair images" ON storage.objects;
CREATE POLICY "Admins can delete stair images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'stair-images' AND has_role(auth.uid(), 'admin'::app_role));

-- Storage: company-assets DELETE — require admin
DROP POLICY IF EXISTS "Admins can delete company assets" ON storage.objects;
CREATE POLICY "Admins can delete company assets" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'company-assets' AND has_role(auth.uid(), 'admin'::app_role));

-- Storage: stair-images INSERT — require admin
DROP POLICY IF EXISTS "Authenticated can upload stair images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload stair images" ON storage.objects;
CREATE POLICY "Admins can upload stair images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'stair-images' AND has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated can update stair images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update stair images" ON storage.objects;
CREATE POLICY "Admins can update stair images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'stair-images' AND has_role(auth.uid(), 'admin'::app_role));

-- Storage: company-assets INSERT/UPDATE — require admin
DROP POLICY IF EXISTS "Authenticated can upload company assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload company assets" ON storage.objects;
CREATE POLICY "Admins can upload company assets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-assets' AND has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated can update company assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update company assets" ON storage.objects;
CREATE POLICY "Admins can update company assets" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'company-assets' AND has_role(auth.uid(), 'admin'::app_role));

-- Storage: article-images INSERT/UPDATE — require admin
DROP POLICY IF EXISTS "Authenticated can upload article images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload article images" ON storage.objects;
CREATE POLICY "Admins can upload article images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'article-images' AND has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated can update article images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update article images" ON storage.objects;
CREATE POLICY "Admins can update article images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'article-images' AND has_role(auth.uid(), 'admin'::app_role));

-- Storage: article-images DELETE — require admin (in case it's open)
DROP POLICY IF EXISTS "Authenticated can delete article images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete article images" ON storage.objects;
CREATE POLICY "Admins can delete article images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'article-images' AND has_role(auth.uid(), 'admin'::app_role));
