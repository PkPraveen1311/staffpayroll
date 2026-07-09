
CREATE TABLE public.employee_advances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  given_on DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_advances TO authenticated;
GRANT ALL ON public.employee_advances TO service_role;
ALTER TABLE public.employee_advances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all advances" ON public.employee_advances FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_advances_updated BEFORE UPDATE ON public.employee_advances FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.advance_repayments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  advance_id UUID NOT NULL REFERENCES public.employee_advances(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  repaid_on DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.advance_repayments TO authenticated;
GRANT ALL ON public.advance_repayments TO service_role;
ALTER TABLE public.advance_repayments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all repayments" ON public.advance_repayments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_repayments_updated BEFORE UPDATE ON public.advance_repayments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_advances_emp ON public.employee_advances(employee_id);
CREATE INDEX idx_repayments_adv ON public.advance_repayments(advance_id);
