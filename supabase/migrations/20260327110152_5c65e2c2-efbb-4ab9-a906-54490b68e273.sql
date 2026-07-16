
-- Add image_url to articles
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS image_url text DEFAULT '';

-- Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view categories" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert categories" ON public.categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update categories" ON public.categories FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete categories" ON public.categories FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed default categories
INSERT INTO public.categories (name) VALUES
  ('Estructura'), ('Filtració'), ('Impermeabilització'), ('Il·luminació'),
  ('Robòtica'), ('Calefacció'), ('Acabats'), ('Coronament'), ('Gressite'),
  ('Porcelànic'), ('Varis')
ON CONFLICT (name) DO NOTHING;

-- Create article-images storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('article-images', 'article-images', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated can upload article images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'article-images');
CREATE POLICY "Authenticated can update article images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'article-images');
CREATE POLICY "Public can view article images" ON storage.objects FOR SELECT USING (bucket_id = 'article-images');
