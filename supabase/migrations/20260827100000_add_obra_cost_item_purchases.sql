-- Historial de compres per partida (Control d'Obres)
-- ---------------------------------------------------
-- Fins ara real_qty / real_unit_cost / real_total_cost d'obra_cost_items
-- s'editaven directament amb inputs inline a la taula (un sol proveïdor,
-- un sol preu). Quan una partida es compra a diversos proveïdors o a preus
-- diferents no hi havia manera de registrar-ho.
--
-- Aquesta taula guarda una fila per compra. Un trigger recalcula
-- automàticament els agregats de la partida:
--   real_qty        = Σ qty_i
--   real_unit_cost  = Σ(qty_i · unit_cost_i) / Σ qty_i     (mitjana ponderada)
--   real_total_cost = Σ(qty_i · unit_cost_i)               (despesa real exacta)
-- L'UPDATE resultant sobre obra_cost_items dispara en cascada el trigger
-- existent trg_obra_cost_items_recalc, que fa el roll-up a fase / obra / marge.
--
-- Model híbrid: mentre la partida no tingui cap compra registrada, els
-- inputs inline segueixen funcionant com fins ara. En afegir la primera
-- compra, els agregats passen a ser gestionats pel trigger; en esborrar
-- l'última compra, real_* torna a NULL (partida "Pendent" un altre cop).

-- =============================================================
-- 1. Netejar columnes mortes d'obra_cost_items
--    (mai llegides ni escrites per la UI/PDF/export; substituïdes
--     pel detall per compra a la taula nova)
-- =============================================================
ALTER TABLE public.obra_cost_items
  DROP COLUMN IF EXISTS supplier_name,
  DROP COLUMN IF EXISTS invoice_ref,
  DROP COLUMN IF EXISTS invoice_date;

-- =============================================================
-- 2. Taula d'historial de compres
-- =============================================================
CREATE TABLE public.obra_cost_item_purchases (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id        uuid NOT NULL REFERENCES public.obra_cost_items(id) ON DELETE CASCADE,
  obra_id        uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  qty            numeric NOT NULL CHECK (qty > 0),
  unit_cost      numeric NOT NULL,          -- cèntims, mateixa convenció que real_unit_cost
  supplier_id    uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_label text,                      -- snapshot del nom o text lliure
  invoice_ref    text,                      -- nº albarà / factura (opcional)
  purchased_at   date NOT NULL DEFAULT CURRENT_DATE,
  note           text,
  created_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ocip_item_id ON public.obra_cost_item_purchases(item_id);
CREATE INDEX idx_ocip_obra_id ON public.obra_cost_item_purchases(obra_id);
CREATE INDEX idx_ocip_supplier_id ON public.obra_cost_item_purchases(supplier_id);

CREATE TRIGGER trg_obra_cost_item_purchases_updated_at
  BEFORE UPDATE ON public.obra_cost_item_purchases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- 3. RLS  (mateix predicat que "Manage cost items via obra")
-- =============================================================
ALTER TABLE public.obra_cost_item_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View item purchases via obra" ON public.obra_cost_item_purchases
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Manage item purchases via obra" ON public.obra_cost_item_purchases
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.obras o WHERE o.id = obra_cost_item_purchases.obra_id
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'administrativa'::app_role)
      OR o.comercial_id = auth.uid()
    )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.obras o WHERE o.id = obra_cost_item_purchases.obra_id
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'administrativa'::app_role)
      OR o.comercial_id = auth.uid()
    )
  ));

-- =============================================================
-- 4. Recàlcul dels agregats de la partida a partir de les compres
-- =============================================================
CREATE OR REPLACE FUNCTION public.recompute_obra_cost_item_from_purchases(_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
  v_qty   numeric;
  v_spend numeric;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(qty), 0), COALESCE(SUM(qty * unit_cost), 0)
  INTO v_count, v_qty, v_spend
  FROM public.obra_cost_item_purchases
  WHERE item_id = _item_id;

  IF v_count = 0 THEN
    -- Sense compres: la partida torna a l'estat manual ("Pendent").
    UPDATE public.obra_cost_items
    SET real_qty = NULL, real_unit_cost = NULL, real_total_cost = NULL
    WHERE id = _item_id;
  ELSE
    UPDATE public.obra_cost_items
    SET real_qty        = v_qty,
        real_unit_cost  = CASE WHEN v_qty <> 0 THEN v_spend / v_qty ELSE 0 END,
        real_total_cost = v_spend
    WHERE id = _item_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_obra_cost_item_purchases_recompute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_obra_cost_item_from_purchases(OLD.item_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND NEW.item_id IS DISTINCT FROM OLD.item_id THEN
    PERFORM public.recompute_obra_cost_item_from_purchases(OLD.item_id);
    PERFORM public.recompute_obra_cost_item_from_purchases(NEW.item_id);
    RETURN NEW;
  ELSE
    PERFORM public.recompute_obra_cost_item_from_purchases(NEW.item_id);
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trg_ocip_recompute
AFTER INSERT OR UPDATE OR DELETE ON public.obra_cost_item_purchases
FOR EACH ROW EXECUTE FUNCTION public.trg_obra_cost_item_purchases_recompute();

-- =============================================================
-- 5. Permisos (mateix criteri que la resta de funcions SECURITY DEFINER)
-- =============================================================
REVOKE EXECUTE ON FUNCTION public.recompute_obra_cost_item_from_purchases(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.trg_obra_cost_item_purchases_recompute()      FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.recompute_obra_cost_item_from_purchases(uuid) TO authenticated, service_role;
