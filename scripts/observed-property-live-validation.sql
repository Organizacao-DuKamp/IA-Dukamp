-- A transaction containing only synthetic private profiles; always rolled back.
BEGIN;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  p text := '000000000000096';
  older timestamptz := clock_timestamp()-interval '2 minutes';
  newer timestamptz := clock_timestamp()-interval '1 minute';
  r jsonb;
  profile uuid;
  d jsonb;
  day date := (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  ASSERT NOT EXISTS(SELECT 1 FROM public.guardian_observed_properties WHERE phone_number=p), 'synthetic profile already exists';
  ASSERT NOT EXISTS(SELECT 1 FROM public.whatsapp_followup_profiles WHERE phone_number=p), 'synthetic owner already exists';
  ASSERT NOT has_table_privilege('anon','public.guardian_observed_facts','SELECT'), 'anonymous access';
  ASSERT NOT has_table_privilege('authenticated','public.guardian_observed_facts','SELECT'), 'client access';
  ASSERT NOT has_function_privilege('authenticated','public.guardian_observed_profiles(integer)','EXECUTE'), 'client RPC access';
  r := public.guardian_observe_property(p,'synthetic-observed-1',older,'Minha fazenda fica em Tanabi. Tenho 40 bovinos.',NULL,false,
    jsonb_build_array(jsonb_build_object('field','city','value','Tanabi','quote','Minha fazenda fica em Tanabi.','effectiveDate',(older AT TIME ZONE 'America/Sao_Paulo')::date),
      jsonb_build_object('field','herdTotal','value',40,'quote','Tenho 40 bovinos.','effectiveDate',(older AT TIME ZONE 'America/Sao_Paulo')::date)));
  ASSERT r->>'status'='saved' AND (r->>'added')::int=2, 'initial projection failed';
  profile := (r->>'propertyId')::uuid;
  r := public.guardian_observe_property(p,'synthetic-observed-2',newer,'Agora tenho 38 bovinos.',NULL,false,
    jsonb_build_array(jsonb_build_object('field','herdTotal','value',38,'quote','Agora tenho 38 bovinos.','effectiveDate',(newer AT TIME ZONE 'America/Sao_Paulo')::date)));
  ASSERT (r->>'propertyId')::uuid=profile, 'duplicate property';
  r := public.guardian_observe_property(p,'synthetic-observed-2',newer,'Agora tenho 38 bovinos.',NULL,false,
    jsonb_build_array(jsonb_build_object('field','herdTotal','value',38,'quote','Agora tenho 38 bovinos.','effectiveDate',(newer AT TIME ZONE 'America/Sao_Paulo')::date)));
  ASSERT (r->>'added')::int=0, 'replay duplicated fact';
  d := public.guardian_observed_profile(profile);
  ASSERT (SELECT f->>'value' FROM jsonb_array_elements(d->'current') f WHERE f->>'field'='herdTotal')='38', 'variable count not updated';
  ASSERT (SELECT f->>'value' FROM jsonb_array_elements(d->'current') f WHERE f->>'field'='city')='Tanabi', 'stable city lost';
  ASSERT jsonb_array_length(d->'history')=3, 'history not preserved';
  ASSERT NOT EXISTS(SELECT 1 FROM public.guardian_accounts WHERE phone_number=p), 'shared account created implicitly';
  INSERT INTO public.whatsapp_followup_profiles(phone_number,followups_enabled,context_reset_at) VALUES(p,false,clock_timestamp());
  ASSERT public.guardian_observed_profile(profile) IS NULL, 'reset exposed earlier generation';
  r := public.guardian_observe_property(p,'synthetic-late',older,'Tenho 40 bovinos.',NULL,false,
    jsonb_build_array(jsonb_build_object('field','herdTotal','value',40,'quote','Tenho 40 bovinos.','effectiveDate',(older AT TIME ZONE 'America/Sao_Paulo')::date)));
  ASSERT r->>'status'='reset', 'late source restored earlier data';
END;
$$;
RESET ROLE;
ROLLBACK;
SELECT 'observed_property_live_validation_passed_and_rolled_back' AS validation;
