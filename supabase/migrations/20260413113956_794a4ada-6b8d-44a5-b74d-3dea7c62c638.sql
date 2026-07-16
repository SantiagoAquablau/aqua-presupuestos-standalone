
-- Annex Section 1: Projecte d'obra
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_projecte_estat text DEFAULT 'no';
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_projecte_article_id uuid;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_projecte_qty integer DEFAULT 1;

-- Annex Section 2: Excavació
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_excavacio_estat text DEFAULT 'no';
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_excavacio_import numeric;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_excavacio_reompliment numeric;

-- Annex Section 3: Paviment perimetral
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_paviment_estat text DEFAULT 'no';
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_paviment_tipus text;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_paviment_retirada_enabled boolean DEFAULT false;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_paviment_retirada_m2 numeric;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_paviment_regularitzacio_enabled boolean DEFAULT false;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_paviment_regularitzacio_m2 numeric;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_paviment_actuacio text;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_paviment_formigo_enabled boolean DEFAULT false;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_paviment_formigo_m2 numeric;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_paviment_material text;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_paviment_format text;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_paviment_m2 numeric;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_paviment_model_id uuid;

-- Annex Section 4: Gespa artificial
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_gespa_estat text DEFAULT 'no';
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_gespa_preparacio_enabled boolean DEFAULT false;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_gespa_preparacio_m2 numeric;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_gespa_model text;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_gespa_m2 numeric;

-- Annex Section 5: Cobertor
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_cobertor_estat text DEFAULT 'no';
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_cobertor_article_id uuid;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_cobertor_qty integer DEFAULT 1;

-- Annex Section 6: Robot netejafons
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_robot_estat text DEFAULT 'no';
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_robot_article_id uuid;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_robot_qty integer DEFAULT 1;

-- Annex Section 7: Bomba de calor
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_bomba_calor_estat text DEFAULT 'no';
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_bomba_calor_coberta boolean;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_bomba_calor_des_de date;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_bomba_calor_fins_a date;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_bomba_calor_temperatura integer DEFAULT 27;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_bomba_calor_article_id uuid;

-- Annex Section 8: Sistema netejafons
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_netejafons_estat text DEFAULT 'no';
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_netejafons_fons integer;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_netejafons_escala integer;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_netejafons_plataforma integer;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_netejafons_total integer;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_netejafons_extra_cost numeric DEFAULT 0;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS annex_netejafons_article_id uuid;
