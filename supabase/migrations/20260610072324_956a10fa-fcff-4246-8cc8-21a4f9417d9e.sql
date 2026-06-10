
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS ifsc_code text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS wedding_anniversary date,
  ADD COLUMN IF NOT EXISTS pf_number text,
  ADD COLUMN IF NOT EXISTS esi_number text,
  ADD COLUMN IF NOT EXISTS uan text;
