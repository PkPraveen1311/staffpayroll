CREATE TABLE public.commission_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_code text NOT NULL,
  full_name text NOT NULL,
  pan text,
  aadhaar text,
  phone text,
  email text,
  address text,
  bank_account text,
  ifsc_code text,
  bank_name text,
  tds_enabled boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_agents TO authenticated;
GRANT ALL ON public.commission_agents TO service_role;
ALTER TABLE public.commission_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage commission agents" ON public.commission_agents
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_commission_agents_updated BEFORE UPDATE ON public.commission_agents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.commission_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.commission_agents(id) ON DELETE CASCADE,
  paid_on date NOT NULL DEFAULT CURRENT_DATE,
  gross_amount numeric NOT NULL DEFAULT 0,
  tds_rate numeric NOT NULL DEFAULT 2,
  tds_amount numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_payments TO authenticated;
GRANT ALL ON public.commission_payments TO service_role;
ALTER TABLE public.commission_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage commission payments" ON public.commission_payments
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_commission_payments_updated BEFORE UPDATE ON public.commission_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_commission_payments_agent ON public.commission_payments(agent_id);
CREATE INDEX idx_commission_payments_paid_on ON public.commission_payments(paid_on);