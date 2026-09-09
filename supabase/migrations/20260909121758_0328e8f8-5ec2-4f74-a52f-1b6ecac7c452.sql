CREATE TABLE public.agent_allowed_week_offs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid NOT NULL REFERENCES public.commission_agents(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL,
  allowed integer NOT NULL DEFAULT 4,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (agent_id, year, month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_allowed_week_offs TO authenticated;
GRANT ALL ON public.agent_allowed_week_offs TO service_role;

ALTER TABLE public.agent_allowed_week_offs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage agent allowed week offs"
ON public.agent_allowed_week_offs
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_agent_allowed_week_offs_updated_at
BEFORE UPDATE ON public.agent_allowed_week_offs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();