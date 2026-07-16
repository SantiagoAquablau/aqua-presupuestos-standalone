
-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_budgets_comercial_id ON public.budgets(comercial_id);
CREATE INDEX IF NOT EXISTS idx_budgets_status ON public.budgets(status);
CREATE INDEX IF NOT EXISTS idx_budgets_created_at ON public.budgets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_budgets_deleted ON public.budgets(deleted);
CREATE INDEX IF NOT EXISTS idx_budgets_list ON public.budgets(deleted, created_at DESC);

-- Add columns for rehab/maintenance budget types
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS current_coating text DEFAULT '';
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS construction_year integer;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS general_condition text DEFAULT '';
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS detected_problems jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS rehab_works jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS rehab_notes jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS new_coating text DEFAULT '';
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS filtration_system text DEFAULT '';
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS has_robot boolean DEFAULT false;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS has_cover boolean DEFAULT false;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS maintenance_services jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS maintenance_periodicity text DEFAULT '';
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS maintenance_price integer DEFAULT 0;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS photo_url text DEFAULT '';
