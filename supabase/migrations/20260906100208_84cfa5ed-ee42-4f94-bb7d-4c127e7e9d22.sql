ALTER TABLE public.commission_agents
  ADD COLUMN IF NOT EXISTS pay_type text NOT NULL DEFAULT 'commission',
  ADD COLUMN IF NOT EXISTS fixed_monthly_amount numeric NOT NULL DEFAULT 0;