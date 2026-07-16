
-- Create the timestamp helper if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============ TABLES ============
CREATE TABLE public.cover_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  cover_type TEXT NOT NULL CHECK (cover_type IN ('fora_aigua', 'submergit')),
  image_url TEXT DEFAULT '',
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.cover_colors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  material TEXT NOT NULL CHECK (material IN ('pvc', 'policarbonat')),
  image_url TEXT DEFAULT '',
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.cover_model_colors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id UUID NOT NULL REFERENCES public.cover_models(id) ON DELETE CASCADE,
  color_id UUID NOT NULL REFERENCES public.cover_colors(id) ON DELETE CASCADE,
  UNIQUE (model_id, color_id)
);

-- ============ RLS ============
ALTER TABLE public.cover_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cover_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cover_model_colors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view cover_models" ON public.cover_models FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage cover_models" ON public.cover_models FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view cover_colors" ON public.cover_colors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage cover_colors" ON public.cover_colors FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view cover_model_colors" ON public.cover_model_colors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage cover_model_colors" ON public.cover_model_colors FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_cover_models_updated BEFORE UPDATE ON public.cover_models FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cover_colors_updated BEFORE UPDATE ON public.cover_colors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ STORAGE BUCKET ============
INSERT INTO storage.buckets (id, name, public) VALUES ('cover-images', 'cover-images', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Cover images public read" ON storage.objects FOR SELECT USING (bucket_id = 'cover-images');
CREATE POLICY "Admins upload cover images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'cover-images' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update cover images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'cover-images' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete cover images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'cover-images' AND has_role(auth.uid(), 'admin'::app_role));

-- ============ BUDGETS COLUMNS ============
ALTER TABLE public.budgets DROP COLUMN IF EXISTS annex_cobertor_article_id;
ALTER TABLE public.budgets DROP COLUMN IF EXISTS annex_cobertor_qty;

ALTER TABLE public.budgets
  ADD COLUMN annex_cobertor_tipus TEXT,
  ADD COLUMN annex_cobertor_model_id UUID REFERENCES public.cover_models(id) ON DELETE SET NULL,
  ADD COLUMN annex_cobertor_lames TEXT,
  ADD COLUMN annex_cobertor_color_id UUID REFERENCES public.cover_colors(id) ON DELETE SET NULL;

-- ============ SEED DATA ============
INSERT INTO public.cover_models (code, name, cover_type, order_index) VALUES
  ('e-classic', 'e-Classic', 'fora_aigua', 1),
  ('e-classic-lux', 'e-Classic Lux', 'fora_aigua', 2),
  ('e-spark', 'e-Spark', 'fora_aigua', 3),
  ('e-solar', 'e-Solar', 'fora_aigua', 4),
  ('e-playa-classic', 'e-Playa Classic', 'fora_aigua', 5),
  ('e-playa-dsign', 'e-Playa Dsign', 'fora_aigua', 6),
  ('s-premium', 's-Premium', 'submergit', 1),
  ('s-lux', 's-Lux', 'submergit', 2),
  ('s-premium-cs', 's-Premium CS', 'submergit', 3);

INSERT INTO public.cover_colors (code, name, material, order_index) VALUES
  ('pvc-blanc', 'Blanc', 'pvc', 1),
  ('pvc-arena', 'Arena', 'pvc', 2),
  ('pvc-blau', 'Blau', 'pvc', 3),
  ('pvc-gris-clar', 'Gris clar', 'pvc', 4),
  ('pvc-gris-fosc', 'Gris fosc', 'pvc', 5),
  ('poli-transp', 'Transp. Negre translúcid', 'policarbonat', 1),
  ('poli-blau-trans', 'Blau translúcid', 'policarbonat', 2),
  ('poli-doble-transp', 'Doble capa transparent', 'policarbonat', 3),
  ('poli-doble-platejat', 'Doble capa platejat', 'policarbonat', 4),
  ('poli-doble-blavos', 'Doble capa blavós', 'policarbonat', 5);

-- Models bàsics: 4 colors PVC + 2 colors poli
INSERT INTO public.cover_model_colors (model_id, color_id)
SELECT m.id, c.id
FROM public.cover_models m
CROSS JOIN public.cover_colors c
WHERE m.code IN ('e-classic', 'e-classic-lux', 'e-spark', 'e-solar')
  AND c.code IN ('pvc-blanc', 'pvc-arena', 'pvc-blau', 'pvc-gris-clar', 'poli-transp', 'poli-blau-trans');

-- Models complets: tots els colors
INSERT INTO public.cover_model_colors (model_id, color_id)
SELECT m.id, c.id
FROM public.cover_models m
CROSS JOIN public.cover_colors c
WHERE m.code IN ('e-playa-classic', 'e-playa-dsign', 's-premium', 's-lux', 's-premium-cs');
