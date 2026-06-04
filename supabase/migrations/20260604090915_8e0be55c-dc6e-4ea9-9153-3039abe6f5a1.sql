CREATE TABLE public.allowed_week_offs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  year integer NOT NULL,
  month integer NOT NULL,
  allowed integer NOT NULL DEFAULT 4,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, year, month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.allowed_week_offs TO authenticated;
GRANT ALL ON public.allowed_week_offs TO service_role;

ALTER TABLE public.allowed_week_offs ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_all_allowed_week_offs ON public.allowed_week_offs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER set_allowed_week_offs_updated_at
  BEFORE UPDATE ON public.allowed_week_offs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();