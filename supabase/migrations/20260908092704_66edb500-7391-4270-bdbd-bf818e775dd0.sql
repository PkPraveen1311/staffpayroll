CREATE TABLE public.agent_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.commission_agents(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  given_on date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_advances TO authenticated;
GRANT ALL ON public.agent_advances TO service_role;
ALTER TABLE public.agent_advances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage agent advances" ON public.agent_advances FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_agent_advances_updated BEFORE UPDATE ON public.agent_advances FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.agent_advance_repayments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advance_id uuid NOT NULL REFERENCES public.agent_advances(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  repaid_on date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_advance_repayments TO authenticated;
GRANT ALL ON public.agent_advance_repayments TO service_role;
ALTER TABLE public.agent_advance_repayments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage agent advance repayments" ON public.agent_advance_repayments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_agent_advance_repayments_updated BEFORE UPDATE ON public.agent_advance_repayments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.commission_payments ADD COLUMN IF NOT EXISTS advance numeric NOT NULL DEFAULT 0;