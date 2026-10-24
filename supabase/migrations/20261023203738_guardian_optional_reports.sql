ALTER TABLE public.guardian_accounts ADD COLUMN reports_checked_at timestamptz;
CREATE INDEX guardian_accounts_reports_idx ON public.guardian_accounts(reports_checked_at NULLS FIRST);
CREATE FUNCTION public.guardian_claim_reports(p_limit integer DEFAULT 3) RETURNS SETOF public.guardian_accounts
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  RETURN QUERY WITH due AS (SELECT a.phone_number FROM public.guardian_accounts a WHERE a.preferences->>'enabled'='true' AND a.preferences->>'consentAt' IS NOT NULL
    AND a.preferences->'topics' ? 'reports' AND a.preferences->>'reportCadence' IN ('daily','weekly','monthly') AND a.active_property_id IS NOT NULL
    AND (a.reports_checked_at IS NULL OR a.reports_checked_at<now()-interval '1 hour')
    ORDER BY a.reports_checked_at NULLS FIRST,a.phone_number LIMIT LEAST(GREATEST(p_limit,1),10) FOR UPDATE SKIP LOCKED)
    UPDATE public.guardian_accounts a SET reports_checked_at=now() FROM due WHERE a.phone_number=due.phone_number RETURNING a.*;
END $$;
REVOKE ALL ON FUNCTION public.guardian_claim_reports(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_claim_reports(integer) TO service_role;
