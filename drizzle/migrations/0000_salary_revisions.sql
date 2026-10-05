CREATE TABLE public.salary_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  effective_year integer NOT NULL,
  effective_month integer NOT NULL CHECK (effective_month BETWEEN 1 AND 12),
  basic_salary numeric NOT NULL DEFAULT 0,
  hra numeric NOT NULL DEFAULT 0,
  allowances numeric NOT NULL DEFAULT 0,
  medical_allowance numeric NOT NULL DEFAULT 0,
  leave_encashment numeric NOT NULL DEFAULT 0,
  statutory_bonus numeric NOT NULL DEFAULT 0,
  special_allowance numeric NOT NULL DEFAULT 0,
  pf_enabled boolean NOT NULL DEFAULT true,
  esi_enabled boolean NOT NULL DEFAULT false,
  tds_enabled boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, effective_year, effective_month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salary_revisions TO authenticated;
GRANT ALL ON public.salary_revisions TO service_role;
ALTER TABLE public.salary_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage salary revisions" ON public.salary_revisions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));