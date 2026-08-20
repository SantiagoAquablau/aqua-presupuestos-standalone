-- Price history for articles: one row per cost_price/sale_price change
CREATE TABLE public.article_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE NOT NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  cost_price INTEGER NOT NULL,
  sale_price INTEGER NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_article_price_history_article_id ON public.article_price_history(article_id);
CREATE INDEX idx_article_price_history_supplier_id ON public.article_price_history(supplier_id);

ALTER TABLE public.article_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view price history" ON public.article_price_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert price history" ON public.article_price_history FOR INSERT TO authenticated WITH CHECK (true);

-- Records a history row whenever cost_price or sale_price actually changes
CREATE OR REPLACE FUNCTION public.log_article_price_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cost_price IS DISTINCT FROM OLD.cost_price OR NEW.sale_price IS DISTINCT FROM OLD.sale_price THEN
    INSERT INTO public.article_price_history (article_id, supplier_id, cost_price, sale_price, changed_by)
    VALUES (NEW.id, NEW.supplier_id, NEW.cost_price, NEW.sale_price, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER articles_log_price_change
AFTER UPDATE ON public.articles
FOR EACH ROW
EXECUTE FUNCTION public.log_article_price_change();
