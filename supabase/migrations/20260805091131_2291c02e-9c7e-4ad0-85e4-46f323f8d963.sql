CREATE TABLE public.agent_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.commission_agents(id) ON DELETE CASCADE,
  date date NOT NULL,
  status text NOT NULL DEFAULT 'present',
  hours numeric NOT NULL DEFAULT 8,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_attendance TO authenticated;
GRANT ALL ON public.agent_attendance TO service_role;

ALTER TABLE public.agent_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage agent attendance"
ON public.agent_attendance FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_agent_attendance_updated_at
BEFORE UPDATE ON public.agent_attendance
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();