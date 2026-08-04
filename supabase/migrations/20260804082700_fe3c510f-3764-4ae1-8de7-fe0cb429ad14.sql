ALTER TABLE public.commission_agents
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS designation text,
  ADD COLUMN IF NOT EXISTS joining_date date,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS wedding_anniversary date;

ALTER TABLE public.commission_payments
  ADD COLUMN IF NOT EXISTS month integer,
  ADD COLUMN IF NOT EXISTS year integer;

UPDATE public.commission_payments
  SET month = EXTRACT(MONTH FROM paid_on)::int,
      year = EXTRACT(YEAR FROM paid_on)::int
  WHERE month IS NULL OR year IS NULL;