
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS medical_allowance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS leave_encashment numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS statutory_bonus numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS special_allowance numeric NOT NULL DEFAULT 0;

ALTER TABLE public.payslips
  ADD COLUMN IF NOT EXISTS medical_allowance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS leave_encashment numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS statutory_bonus numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS special_allowance numeric NOT NULL DEFAULT 0;
