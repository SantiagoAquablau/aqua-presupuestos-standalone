
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'comercial');

-- Profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table (separate per security guidelines)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Company settings (single row)
CREATE TABLE public.company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT DEFAULT 'AquaBlau',
  cif TEXT DEFAULT '',
  address TEXT DEFAULT '',
  town TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  website TEXT DEFAULT '',
  logo_url TEXT DEFAULT '',
  default_iva NUMERIC(5,2) DEFAULT 21.00,
  default_payment_conditions TEXT DEFAULT '50% a la signatura del contracte, 30% a meitat d''obra, 20% a la finalització.',
  budget_number_format TEXT DEFAULT 'PRE-YYYY-NNN',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stair images config
CREATE TABLE public.stair_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stair_type TEXT NOT NULL UNIQUE,
  image_url TEXT DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Suppliers
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_email TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Articles (catalog)
CREATE TABLE public.articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  reference TEXT DEFAULT '',
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'Varis',
  cost_price INTEGER NOT NULL DEFAULT 0,
  sale_price INTEGER NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'ud',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Budgets
CREATE TABLE public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL UNIQUE,
  client_name TEXT NOT NULL DEFAULT '',
  client_nif TEXT DEFAULT '',
  client_address TEXT DEFAULT '',
  client_town TEXT DEFAULT '',
  client_phone TEXT DEFAULT '',
  client_email TEXT DEFAULT '',
  budget_date DATE DEFAULT CURRENT_DATE,
  comercial_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'obra_nueva',
  status TEXT NOT NULL DEFAULT 'borrador',
  pool_type TEXT DEFAULT '',
  pool_shape TEXT DEFAULT '',
  pool_length NUMERIC(8,2) DEFAULT 0,
  pool_width NUMERIC(8,2) DEFAULT 0,
  pool_depth_min NUMERIC(8,2) DEFAULT 0,
  pool_depth_max NUMERIC(8,2) DEFAULT 0,
  pool_depth_avg NUMERIC(8,2) DEFAULT 0,
  pool_volume_liters NUMERIC(12,2) DEFAULT 0,
  pool_surface_m2 NUMERIC(10,2) DEFAULT 0,
  has_exterior_stairs BOOLEAN DEFAULT false,
  ext_stairs_length NUMERIC(8,2) DEFAULT 0,
  ext_stairs_width NUMERIC(8,2) DEFAULT 0,
  interior_stairs_type TEXT DEFAULT '',
  stairs_width NUMERIC(8,2) DEFAULT 0,
  stairs_length NUMERIC(8,2) DEFAULT 0,
  stairs_height NUMERIC(8,2) DEFAULT 0,
  platform_width NUMERIC(8,2) DEFAULT 0,
  platform_length NUMERIC(8,2) DEFAULT 0,
  platform_height NUMERIC(8,2) DEFAULT 0,
  bench_width NUMERIC(8,2) DEFAULT 0,
  bench_length NUMERIC(8,2) DEFAULT 0,
  bench_height NUMERIC(8,2) DEFAULT 0,
  construction_system TEXT DEFAULT '',
  waterproofing_system TEXT DEFAULT '',
  internal_notes TEXT DEFAULT '',
  payment_conditions TEXT DEFAULT '',
  observations TEXT DEFAULT '',
  total_cost INTEGER DEFAULT 0,
  total_sale INTEGER DEFAULT 0,
  margin_pct NUMERIC(5,2) DEFAULT 0,
  deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Budget phases
CREATE TABLE public.budget_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID REFERENCES public.budgets(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  total_cost INTEGER DEFAULT 0,
  total_sale INTEGER DEFAULT 0
);

-- Budget items
CREATE TABLE public.budget_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID REFERENCES public.budget_phases(id) ON DELETE CASCADE NOT NULL,
  article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
  description TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT 'ud',
  quantity NUMERIC(10,2) DEFAULT 1,
  unit_cost INTEGER DEFAULT 0,
  unit_sale INTEGER DEFAULT 0,
  "order" INTEGER DEFAULT 0
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stair_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;

-- PROFILES RLS
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Admins can manage profiles" ON public.profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- USER_ROLES RLS
CREATE POLICY "Users can view roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- COMPANY_SETTINGS RLS
CREATE POLICY "Authenticated can view settings" ON public.company_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can update settings" ON public.company_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- STAIR_IMAGES RLS
CREATE POLICY "Authenticated can view stair images" ON public.stair_images FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage stair images" ON public.stair_images FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- SUPPLIERS RLS
CREATE POLICY "Authenticated can view suppliers" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage suppliers" ON public.suppliers FOR ALL TO authenticated USING (true);

-- ARTICLES RLS
CREATE POLICY "Authenticated can view articles" ON public.articles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage articles" ON public.articles FOR ALL TO authenticated USING (true);

-- BUDGETS RLS
CREATE POLICY "Admins see all budgets" ON public.budgets FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR comercial_id = auth.uid());
CREATE POLICY "Users can insert budgets" ON public.budgets FOR INSERT TO authenticated WITH CHECK (comercial_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own budgets" ON public.budgets FOR UPDATE TO authenticated USING (comercial_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete budgets" ON public.budgets FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- BUDGET_PHASES RLS
CREATE POLICY "View phases via budget" ON public.budget_phases FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.budgets b WHERE b.id = budget_id AND (b.comercial_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
);
CREATE POLICY "Manage phases via budget" ON public.budget_phases FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.budgets b WHERE b.id = budget_id AND (b.comercial_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
);

-- BUDGET_ITEMS RLS
CREATE POLICY "View items via phase" ON public.budget_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.budget_phases bp JOIN public.budgets b ON b.id = bp.budget_id WHERE bp.id = phase_id AND (b.comercial_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
);
CREATE POLICY "Manage items via phase" ON public.budget_items FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.budget_phases bp JOIN public.budgets b ON b.id = bp.budget_id WHERE bp.id = phase_id AND (b.comercial_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
);

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create stair-images storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('stair-images', 'stair-images', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('company-assets', 'company-assets', true);

-- Storage RLS
CREATE POLICY "Authenticated can upload stair images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'stair-images');
CREATE POLICY "Anyone can view stair images" ON storage.objects FOR SELECT USING (bucket_id = 'stair-images');
CREATE POLICY "Admins can delete stair images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'stair-images');
CREATE POLICY "Authenticated can upload company assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'company-assets');
CREATE POLICY "Anyone can view company assets" ON storage.objects FOR SELECT USING (bucket_id = 'company-assets');
CREATE POLICY "Admins can delete company assets" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'company-assets');

-- Seed default stair image entries
INSERT INTO public.stair_images (stair_type) VALUES
  ('estandard'), ('plataforma'), ('banc'), ('tot_ample'), ('sense');

-- Seed default company settings
INSERT INTO public.company_settings (company_name) VALUES ('AquaBlau');
