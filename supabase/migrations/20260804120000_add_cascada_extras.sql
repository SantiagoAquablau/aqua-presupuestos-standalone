-- Cascada (Accessoris opcionals): bomba Dolfi + pulsador(s) piezoelèctrics,
-- a més de l'article de la cascada ja existent (acc_cascada_model_id). La mà
-- d'obra d'instal·lació NO es tracka com a camp propi — la genera una regla
-- condicional del Motor de Càlcul (acc_cascada_enabled), igual que "VIDRE AFM".
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS acc_cascada_bomba_article_id UUID,
  ADD COLUMN IF NOT EXISTS acc_cascada_pulsador_article_id UUID,
  ADD COLUMN IF NOT EXISTS acc_cascada_pulsador_qty NUMERIC;
