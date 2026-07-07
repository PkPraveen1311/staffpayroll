
CREATE TABLE public.leave_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_id uuid NOT NULL REFERENCES public.leaves(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  changed_by uuid,
  changed_by_email text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_status_history TO authenticated;
GRANT ALL ON public.leave_status_history TO service_role;

ALTER TABLE public.leave_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_all_leave_status_history ON public.leave_status_history
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_leave_status_history_leave ON public.leave_status_history(leave_id, created_at DESC);

-- Trigger: log status changes automatically
CREATE OR REPLACE FUNCTION public.log_leave_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid;
  actor_email text;
BEGIN
  actor := auth.uid();
  BEGIN
    SELECT email INTO actor_email FROM auth.users WHERE id = actor;
  EXCEPTION WHEN OTHERS THEN
    actor_email := NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.leave_status_history(leave_id, from_status, to_status, changed_by, changed_by_email)
    VALUES (NEW.id, NULL, NEW.status, actor, actor_email);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.leave_status_history(leave_id, from_status, to_status, changed_by, changed_by_email)
    VALUES (NEW.id, OLD.status, NEW.status, actor, actor_email);
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_leave_status_insert ON public.leaves;
DROP TRIGGER IF EXISTS trg_log_leave_status_update ON public.leaves;

CREATE TRIGGER trg_log_leave_status_insert
AFTER INSERT ON public.leaves
FOR EACH ROW EXECUTE FUNCTION public.log_leave_status_change();

CREATE TRIGGER trg_log_leave_status_update
AFTER UPDATE OF status ON public.leaves
FOR EACH ROW EXECUTE FUNCTION public.log_leave_status_change();

-- Backfill: seed initial history rows for existing leaves
INSERT INTO public.leave_status_history (leave_id, from_status, to_status, created_at)
SELECT l.id, NULL, l.status, l.created_at
FROM public.leaves l
WHERE NOT EXISTS (
  SELECT 1 FROM public.leave_status_history h WHERE h.leave_id = l.id
);
