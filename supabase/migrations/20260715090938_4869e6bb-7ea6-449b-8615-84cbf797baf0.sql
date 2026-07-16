
CREATE TABLE public.autoportant_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  model TEXT NOT NULL CHECK (model IN ('line_confort','line_luxe','line_luxe_plus')),
  altura_aigua_m NUMERIC(4,2) NOT NULL,
  altura_total_m NUMERIC(4,2) NOT NULL,
  ample_m NUMERIC(4,2) NOT NULL,
  llarg_m NUMERIC(4,2) NOT NULL,
  cost_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  sale_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(model, altura_aigua_m, ample_m, llarg_m)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.autoportant_prices TO authenticated;
GRANT ALL ON public.autoportant_prices TO service_role;

ALTER TABLE public.autoportant_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read autoportant prices"
  ON public.autoportant_prices FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage autoportant prices"
  ON public.autoportant_prices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_autoportant_prices_updated_at
  BEFORE UPDATE ON public.autoportant_prices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed LINE CONFORT prices
INSERT INTO public.autoportant_prices (model, altura_aigua_m, altura_total_m, ample_m, llarg_m, cost_price, sale_price) VALUES
('line_confort',0.60,0.80,2.30,2.90,9141.00,12797.40),
('line_confort',0.60,0.80,2.30,3.90,9456.00,13238.40),
('line_confort',0.60,0.80,2.30,4.90,9694.50,13572.30),
('line_confort',0.60,0.80,2.30,5.90,10968.75,15356.25),
('line_confort',0.60,0.80,2.30,6.90,11249.25,15748.95),
('line_confort',0.60,0.80,2.50,2.90,9457.50,13240.50),
('line_confort',0.60,0.80,2.50,3.90,9772.50,13681.50),
('line_confort',0.60,0.80,2.50,4.90,10016.25,14022.75),
('line_confort',0.60,0.80,2.50,5.90,11249.25,15748.95),
('line_confort',0.60,0.80,2.50,6.90,11519.25,16126.95),
('line_confort',0.60,0.80,3.00,2.90,9697.50,13576.50),
('line_confort',0.60,0.80,3.00,3.90,10008.75,14012.25),
('line_confort',0.60,0.80,3.00,4.90,10251.75,14352.45),
('line_confort',0.60,0.80,3.00,5.90,11519.25,16126.95),
('line_confort',0.60,0.80,3.00,6.90,11763.75,16469.25),
('line_confort',1.00,1.20,2.30,2.90,9858.75,13802.25),
('line_confort',1.00,1.20,2.30,3.90,10185.00,14259.00),
('line_confort',1.00,1.20,2.30,4.90,10454.25,14635.95),
('line_confort',1.00,1.20,2.30,5.90,11917.50,16684.50),
('line_confort',1.00,1.20,2.30,6.90,12318.75,17246.25),
('line_confort',1.00,1.20,2.50,2.90,10326.75,14457.45),
('line_confort',1.00,1.20,2.50,3.90,10650.00,14910.00),
('line_confort',1.00,1.20,2.50,4.90,10968.75,15356.25),
('line_confort',1.00,1.20,2.50,5.90,12397.50,17356.50),
('line_confort',1.00,1.20,2.50,6.90,12791.25,17907.75),
('line_confort',1.00,1.20,3.00,2.90,10888.50,15243.90),
('line_confort',1.00,1.20,3.00,3.90,11358.75,15902.25),
('line_confort',1.00,1.20,3.00,4.90,11471.25,16059.75),
('line_confort',1.00,1.20,3.00,5.90,12877.50,18028.50),
('line_confort',1.00,1.20,3.00,6.90,13271.25,18579.75),
('line_confort',1.20,1.40,2.30,2.90,9975.00,13965.00),
('line_confort',1.20,1.40,2.30,3.90,10406.25,14568.75),
('line_confort',1.20,1.40,2.30,4.90,10851.75,15192.45),
('line_confort',1.20,1.40,2.30,5.90,12517.50,17524.50),
('line_confort',1.20,1.40,2.30,6.90,12960.00,18144.00),
('line_confort',1.20,1.40,2.50,2.90,10650.00,14910.00),
('line_confort',1.20,1.40,2.50,3.90,11118.75,15566.25),
('line_confort',1.20,1.40,2.50,4.90,11523.75,16133.25),
('line_confort',1.20,1.40,2.50,5.90,13162.50,18427.50),
('line_confort',1.20,1.40,2.50,6.90,13668.75,19136.25),
('line_confort',1.20,1.40,3.00,2.90,11283.75,15797.25),
('line_confort',1.20,1.40,3.00,3.90,11763.75,16469.25),
('line_confort',1.20,1.40,3.00,4.90,12150.00,17010.00),
('line_confort',1.20,1.40,3.00,5.90,13822.50,19351.50),
('line_confort',1.20,1.40,3.00,6.90,14324.25,20053.95);
