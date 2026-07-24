-- Jacuzzi opcional (Obra Nova): persist all fields collected by StepJacuzzi
-- that were previously kept only in the wizard's in-memory BudgetDraft and
-- never reached the budgets table.
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS has_jacuzzi BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS jacuzzi_type TEXT,
  ADD COLUMN IF NOT EXISTS jacuzzi_position TEXT,
  ADD COLUMN IF NOT EXISTS jacuzzi_length NUMERIC,
  ADD COLUMN IF NOT EXISTS jacuzzi_width NUMERIC,
  ADD COLUMN IF NOT EXISTS jacuzzi_depth NUMERIC,
  -- Jacuzzi independent — bancs interiors
  ADD COLUMN IF NOT EXISTS jacuzzi_bench_count INTEGER,
  ADD COLUMN IF NOT EXISTS jacuzzi_bench_depth NUMERIC,
  ADD COLUMN IF NOT EXISTS jacuzzi_bench_height NUMERIC,
  -- Jacuzzi independent — escalons
  ADD COLUMN IF NOT EXISTS jacuzzi_stairs_count INTEGER,
  ADD COLUMN IF NOT EXISTS jacuzzi_stairs_tread NUMERIC,
  -- Instal·lació jacuzzi — jets d'aire
  ADD COLUMN IF NOT EXISTS jacuzzi_air_jets_count INTEGER,
  ADD COLUMN IF NOT EXISTS jacuzzi_air_jets_intake_count INTEGER,
  ADD COLUMN IF NOT EXISTS jacuzzi_air_pump_qty INTEGER,
  ADD COLUMN IF NOT EXISTS jacuzzi_air_pump_article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
  -- Instal·lació jacuzzi — jets d'aigua
  ADD COLUMN IF NOT EXISTS jacuzzi_water_jets_count INTEGER,
  ADD COLUMN IF NOT EXISTS jacuzzi_water_jets_intake_count INTEGER,
  ADD COLUMN IF NOT EXISTS jacuzzi_water_pump_qty INTEGER,
  ADD COLUMN IF NOT EXISTS jacuzzi_water_pump_article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
  -- Instal·lació jacuzzi — polsadors piezoelèctrics
  ADD COLUMN IF NOT EXISTS jacuzzi_piezo_buttons_count INTEGER,
  -- Instal·lació jacuzzi independent — equips addicionals propis
  ADD COLUMN IF NOT EXISTS jacuzzi_filtration_pump_article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS jacuzzi_filtration_pump_qty INTEGER,
  ADD COLUMN IF NOT EXISTS jacuzzi_filter_article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS jacuzzi_filter_qty INTEGER,
  ADD COLUMN IF NOT EXISTS jacuzzi_led_article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS jacuzzi_led_count INTEGER,
  ADD COLUMN IF NOT EXISTS jacuzzi_heat_pump_article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS jacuzzi_heat_pump_qty INTEGER,
  ADD COLUMN IF NOT EXISTS jacuzzi_saline_electrolysis_article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS jacuzzi_saline_electrolysis_qty INTEGER;
