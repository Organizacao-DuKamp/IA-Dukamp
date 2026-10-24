-- Privileged deployment smoke check. Synthetic fixtures only; never sends messages.
-- Run as one batch against the intended TPEC database. Any failed assertion aborts.
-- All fixture rows are rolled back, including the temporary Auth users.
BEGIN;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';
DO $$
DECLARE
  owner_phone text := '000000000000001'; worker_phone text := '000000000000002';
  owner_uid uuid := gen_random_uuid(); worker_uid uuid := gen_random_uuid(); outsider_uid uuid := gen_random_uuid();
  property_id_qa uuid := gen_random_uuid(); event_id_qa uuid := gen_random_uuid();
  turn_id_qa uuid := gen_random_uuid(); claim_qa uuid := gen_random_uuid(); document_id_qa uuid := gen_random_uuid();
  book_qa jsonb := '{"schema":1,"name":"Validação transacional Guardiã","city":"Monte Aprazível","uf":"SP","profile":{},"animals":[],"tasks":[],"ledger":[],"records":[]}'::jsonb;
  vector_qa public.vector := ('[1,' || repeat('0,',3070) || '0]')::public.vector;
  original_text text := 'Registro sintético de validação da memória privada';
  provider_qa text := 'validation:synthetic:3072'; chunks_qa jsonb; version_qa integer; hash_qa text;
  response text; result_qa jsonb; denied boolean;
BEGIN
  IF EXISTS(SELECT 1 FROM public.guardian_accounts WHERE phone_number IN (owner_phone,worker_phone))
    OR EXISTS(SELECT 1 FROM public.whatsapp_followup_profiles WHERE phone_number IN (owner_phone,worker_phone)) THEN
    RAISE EXCEPTION 'qa_fixture_namespace_in_use';
  END IF;
  INSERT INTO auth.users(id,email) VALUES
    (owner_uid,'guardian-qa-'||owner_uid::text||'@example.invalid'),
    (worker_uid,'guardian-qa-'||worker_uid::text||'@example.invalid');
  response := public.guardian_commit_turn(owner_phone,'qa-create',0,property_id_qa,NULL,'create',book_qa,NULL,NULL,'{}','created','[]');
  IF response<>'committed' THEN RAISE EXCEPTION 'qa_create_failed'; END IF;
  response := public.guardian_commit_turn(owner_phone,'qa-create',0,property_id_qa,NULL,'create',book_qa,NULL,NULL,'{}','created','[]');
  IF response<>'replay:created' THEN RAISE EXCEPTION 'qa_idempotency_failed'; END IF;
  UPDATE public.guardian_accounts SET user_id=owner_uid WHERE phone_number=owner_phone;
  UPDATE public.guardian_members SET user_id=owner_uid WHERE property_id=property_id_qa AND phone_number=owner_phone;
  INSERT INTO public.guardian_members(property_id,phone_number,user_id,role) VALUES(property_id_qa,worker_phone,worker_uid,'worker');
  INSERT INTO public.guardian_events(id,property_id,recipient,type,topic,dedupe_key,evidence,message,priority,not_before,expires_at)
    VALUES(event_id_qa,property_id_qa,owner_phone,'task_due','tasks','qa-event','{}','Aviso sintético',1,now()+interval '1 hour',now()+interval '2 hours');

  PERFORM set_config('request.jwt.claim.sub',worker_uid::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  IF (SELECT count(*) FROM public.guardian_properties WHERE id=property_id_qa)<>1
    OR (SELECT count(*) FROM public.guardian_event_history WHERE event_id=event_id_qa)<>1 THEN RAISE EXCEPTION 'qa_member_rls_failed'; END IF;
  denied:=false;
  BEGIN UPDATE public.guardian_properties SET book=book WHERE id=property_id_qa;
  EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'qa_client_write_exposed'; END IF;
  denied:=false;
  BEGIN PERFORM public.guardian_snapshot(owner_phone);
  EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'qa_client_rpc_exposed'; END IF;
  denied:=false;
  BEGIN PERFORM count(*) FROM public.whatsapp_context_vectors;
  EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'qa_private_vectors_exposed'; END IF;
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub',outsider_uid::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',outsider_uid,'role','authenticated','user_metadata',jsonb_build_object('role','admin'))::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  IF EXISTS(SELECT 1 FROM public.guardian_properties WHERE id=property_id_qa)
    OR EXISTS(SELECT 1 FROM public.guardian_event_history WHERE event_id=event_id_qa) THEN RAISE EXCEPTION 'qa_tenant_isolation_failed'; END IF;
  EXECUTE 'RESET ROLE';
  response:=public.guardian_commit_turn(owner_phone,'qa-revoke',1,property_id_qa,0,'revoke',NULL,NULL,NULL,jsonb_build_object('phone',worker_phone),'revoked','[]');
  IF response<>'committed' THEN RAISE EXCEPTION 'qa_revoke_failed'; END IF;
  PERFORM set_config('request.jwt.claim.sub',worker_uid::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  IF EXISTS(SELECT 1 FROM public.guardian_properties WHERE id=property_id_qa)
    OR EXISTS(SELECT 1 FROM public.guardian_event_history WHERE event_id=event_id_qa) THEN RAISE EXCEPTION 'qa_revocation_rls_failed'; END IF;
  EXECUTE 'RESET ROLE';
  EXECUTE 'SET LOCAL ROLE anon';
  denied:=false;
  BEGIN PERFORM public.guardian_snapshot(owner_phone);
  EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'qa_anonymous_rpc_exposed'; END IF;
  EXECUTE 'RESET ROLE';

  INSERT INTO public.whatsapp_followup_profiles(phone_number) VALUES(owner_phone);
  INSERT INTO public.ai_chat_turns(id,conversation_id,user_key,phone_number,channel,user_text,status,created_at)
    VALUES(turn_id_qa,'qa-'||turn_id_qa::text,'wa:'||owner_phone,owner_phone,'whatsapp',original_text,'completed',now()-interval '2 hours');
  INSERT INTO public.whatsapp_context_vectors(turn_id,phone_number,source_hash,embedding_provider,status,lock_token)
    VALUES(turn_id_qa,owner_phone,encode(sha256(convert_to(original_text,'UTF8')),'hex'),provider_qa,'claimed',claim_qa);
  IF NOT public.finish_whatsapp_semantic_memory(turn_id_qa,claim_qa,provider_qa,vector_qa) THEN RAISE EXCEPTION 'qa_vector_finish_failed'; END IF;
  result_qa:=public.recall_whatsapp_semantic(owner_phone,provider_qa,vector_qa,'reset-2026-10-14-duk-a91f',now());
  IF jsonb_array_length(result_qa->'turns')<>1 THEN RAISE EXCEPTION 'qa_semantic_search_failed'; END IF;
  result_qa:=public.recall_whatsapp_semantic(worker_phone,provider_qa,vector_qa,'reset-2026-10-14-duk-a91f',now());
  IF jsonb_array_length(result_qa->'turns')<>0 THEN RAISE EXCEPTION 'qa_private_owner_isolation_failed'; END IF;
  UPDATE public.ai_chat_turns SET user_text='Correção sintética da origem' WHERE id=turn_id_qa;
  result_qa:=public.recall_whatsapp_semantic(owner_phone,provider_qa,vector_qa,'reset-2026-10-14-duk-a91f',now());
  IF jsonb_array_length(result_qa->'turns')<>0 THEN RAISE EXCEPTION 'qa_stale_vector_accepted'; END IF;
  UPDATE public.whatsapp_followup_profiles SET context_reset_at=now() WHERE phone_number=owner_phone;
  IF EXISTS(SELECT 1 FROM public.whatsapp_context_vectors WHERE turn_id=turn_id_qa)
    OR public.finish_whatsapp_semantic_memory(turn_id_qa,claim_qa,provider_qa,vector_qa) THEN RAISE EXCEPTION 'qa_reset_boundary_failed'; END IF;

  INSERT INTO public.knowledge_documents(id,title,filename,category,source_path,content,content_hash)
    VALUES(document_id_qa,'Validação sintética','qa.txt','Validação','qa/'||document_id_qa::text,'Texto sintético',encode(sha256(convert_to('Texto sintético','UTF8')),'hex'));
  SELECT version,content_hash INTO version_qa,hash_qa FROM public.knowledge_documents WHERE id=document_id_qa;
  chunks_qa:=jsonb_build_array(jsonb_build_object('document_id',document_id_qa,'chunk_index',0,'content','Original sintético preservado','embedding',vector_qa::text,'metadata',jsonb_build_object('embedding_provider',provider_qa),'category','Validação','filename','qa.txt','title','Validação sintética'));
  IF public.replace_knowledge_document_chunks(document_id_qa,version_qa,hash_qa,chunks_qa)<>1 THEN RAISE EXCEPTION 'qa_knowledge_swap_failed'; END IF;
  denied:=false;
  BEGIN PERFORM public.replace_knowledge_document_chunks(document_id_qa,version_qa,hash_qa,jsonb_set(chunks_qa,'{0,content}','null'::jsonb));
  EXCEPTION WHEN not_null_violation THEN denied:=true; END;
  IF NOT denied OR NOT EXISTS(SELECT 1 FROM public.knowledge_chunks WHERE document_id=document_id_qa AND content='Original sintético preservado') THEN RAISE EXCEPTION 'qa_knowledge_rollback_failed'; END IF;
END $$;
ROLLBACK;
SELECT jsonb_build_object('success',true,'synthetic_rows_rolled_back',true,'guardian_rpc_and_idempotency',true,'rls_and_revocation',true,'private_pgvector_and_reset',true,'atomic_knowledge_replacement',true) AS validation;
