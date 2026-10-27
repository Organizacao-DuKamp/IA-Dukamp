-- A transfer never uses two separate commits: both farm books, the receipt and
-- audit entries are written in one transaction under a common lock order.
CREATE FUNCTION public.guardian_transfer_target(p_phone text,p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT jsonb_build_object('id',p.id,'version',p.version,'role',m.role,'book',p.book)
  FROM public.guardian_properties p JOIN public.guardian_members m ON m.property_id=p.id
  WHERE p.id=p_id AND m.phone_number=p_phone AND m.active;
$$;
CREATE FUNCTION public.guardian_transfer_commit(p_phone text,p_message text,p_proposal text,p_account_version bigint,p_from uuid,p_to uuid,p_from_version bigint,p_to_version bigint,p_from_book jsonb,p_to_book jsonb,p_details jsonb,p_reply text) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a public.guardian_accounts; prior public.guardian_turn_receipts; from_version bigint; to_version bigint;
BEGIN
  IF p_from=p_to OR p_phone !~ '^[0-9]{6,20}$' OR length(p_message) NOT BETWEEN 1 AND 128 OR length(p_reply) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'invalid_guardian_transfer'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('tpec-guardian-account:'||p_phone,0));
  SELECT * INTO a FROM public.guardian_accounts WHERE phone_number=p_phone FOR UPDATE;
  -- Lock both farms in UUID order, also when two different owners transfer in reverse directions.
  PERFORM 1 FROM public.guardian_properties WHERE id IN (p_from,p_to) ORDER BY id FOR UPDATE;
  IF (SELECT count(*) FROM public.guardian_members WHERE property_id IN (p_from,p_to) AND phone_number=p_phone AND active AND role IN ('owner','manager'))<>2 THEN RAISE EXCEPTION 'guardian_access_denied'; END IF;
  SELECT * INTO prior FROM public.guardian_turn_receipts WHERE phone_number=p_phone AND message_id=p_message;
  IF FOUND THEN RETURN 'replay:'||prior.reply; END IF;
  IF a.version IS DISTINCT FROM p_account_version THEN RETURN 'conflict'; END IF;
  IF a.active_property_id IS DISTINCT FROM p_from OR a.pending->>'sourceMessageId' IS DISTINCT FROM p_proposal
    OR a.pending->'action' IS DISTINCT FROM p_details OR (a.pending->>'expiresAt')::timestamptz<=now() THEN RAISE EXCEPTION 'guardian_transfer_proposal_changed'; END IF;
  SELECT version INTO from_version FROM public.guardian_properties WHERE id=p_from;
  SELECT version INTO to_version FROM public.guardian_properties WHERE id=p_to;
  IF from_version IS DISTINCT FROM p_from_version OR to_version IS DISTINCT FROM p_to_version THEN RETURN 'conflict'; END IF;
  UPDATE public.guardian_properties SET book=CASE WHEN id=p_from THEN p_from_book ELSE p_to_book END,version=version+1,updated_at=now() WHERE id IN (p_from,p_to);
  UPDATE public.guardian_accounts SET pending=NULL,version=version+1,updated_at=now() WHERE phone_number=p_phone;
  INSERT INTO public.guardian_audit(property_id,actor,message_id,action,details)
    VALUES(p_from,p_phone,p_message,'property_transfer_out',p_details||jsonb_build_object('sourceMessageId',p_proposal,'counterparty',p_to)),
          (p_to,p_phone,p_message,'property_transfer_in',p_details||jsonb_build_object('sourceMessageId',p_proposal,'counterparty',p_from));
  INSERT INTO public.guardian_turn_receipts(phone_number,message_id,property_id,reply) VALUES(p_phone,p_message,p_from,p_reply);
  RETURN 'committed';
END $$;
REVOKE ALL ON FUNCTION public.guardian_transfer_target(text,uuid),public.guardian_transfer_commit(text,text,text,bigint,uuid,uuid,bigint,bigint,jsonb,jsonb,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_transfer_target(text,uuid),public.guardian_transfer_commit(text,text,text,bigint,uuid,uuid,bigint,bigint,jsonb,jsonb,jsonb,text) TO service_role;
NOTIFY pgrst,'reload schema';
