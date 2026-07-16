ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS autoportant_model text,
  ADD COLUMN IF NOT EXISTS autoportant_ample text,
  ADD COLUMN IF NOT EXISTS autoportant_llarg text,
  ADD COLUMN IF NOT EXISTS autoportant_altura_aigua text,
  ADD COLUMN IF NOT EXISTS autoportant_corona_key text,
  ADD COLUMN IF NOT EXISTS autoportant_revestiment_key text,
  ADD COLUMN IF NOT EXISTS autoportant_revestiment_exterior_key text,
  ADD COLUMN IF NOT EXISTS autoportant_morter_color text,
  ADD COLUMN IF NOT EXISTS autoportant_opc_asiento_acrilico_qty numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS autoportant_opc_colchoneta boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS autoportant_opc_cubierta_electrica boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS autoportant_opc_banco_gresite_qty numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS autoportant_opc_spa boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS autoportant_opc_cascada boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS autoportant_opc_asiento_porcelanico_qty numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS autoportant_opc_cristal boolean DEFAULT false;

ALTER TABLE public.budget_items
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS wizard_key text,
  ADD COLUMN IF NOT EXISTS sub_phase text,
  ADD COLUMN IF NOT EXISTS user_edited boolean DEFAULT false;