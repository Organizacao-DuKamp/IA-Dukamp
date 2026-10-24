-- History inherits the parent event's RLS, including membership revocation.
-- Keep writes exclusive to the server and its durable processing trigger.
GRANT SELECT ON public.guardian_event_history TO authenticated;
CREATE POLICY guardian_event_history_read
  ON public.guardian_event_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.guardian_events e
      WHERE e.id = guardian_event_history.event_id
    )
  );
