BEGIN;
SET LOCAL ROLE service_role;
INSERT INTO public.ai_chat_turns(conversation_id,user_key,channel,phone_number,user_text,assistant_text,created_at) VALUES
('context-regression-A','990000000001','whatsapp','990000000001','Meu lote Orquidea tem 12 vacas','Qual o peso?','2026-10-21T12:00:00Z'),
('context-regression-A','990000000001','whatsapp','990000000001','350 kg','Entendi','2026-10-21T12:01:00Z'),
('context-regression-A','990000000001','whatsapp','990000000001','Corrija o lote Orquidea: são 13 vacas','Corrigido','2026-10-21T12:02:00Z'),
('context-regression-B','990000000002','whatsapp','990000000002','SEGREDO_OUTRA_PESSOA Orquidea tem 999 vacas','Privado','2026-10-21T12:01:00Z');
INSERT INTO public.whatsapp_conversations(phone_number,conversation_id,history,state)
VALUES('990000000001','context-regression-A','[]','{}');
INSERT INTO public.whatsapp_herd_books(phone_number,record_date,version,data,updated_at)
VALUES('990000000001','2026-10-21',1,'{"schema":1,"active":true,"batch":1,"entries":[{"code":"TESTE 1","weight":350}],"procedures":[],"lastKey":null,"defaultSeries":null,"defaultSex":null,"reproductiveMode":false,"pending":null}','2026-10-21T12:00:00Z');
INSERT INTO public.whatsapp_herd_events(phone_number,message_id,record_date,version,source_text,reply,created_at)
VALUES('990000000001','context-regression-old','2026-10-21',1,'TESTE 1 350 kg','Registrado','2026-10-21T12:00:00Z');
DO $$
DECLARE r jsonb; n integer;
BEGIN
 r := public.recall_whatsapp_context('990000000001','Orquidea','reset-2026-10-14-duk-a91f',null,null,'2026-10-23T00:00:00Z');
 ASSERT jsonb_array_length(r->'turns')=3, 'search_and_neighbors';
 ASSERT r::text NOT LIKE '%SEGREDO_OUTRA_PESSOA%', 'owner_isolation';
 ASSERT r::text LIKE '%350 kg%', 'paired_short_answer';
 ASSERT r::text LIKE '%13 vacas%', 'latest_correction';
 PERFORM public.reset_whatsapp_conversation('990000000001','reset-2026-10-14-duk-a91f');
 r := public.recall_whatsapp_context('990000000001','Orquidea','reset-2026-10-14-duk-a91f',null,null,'2026-10-23T00:00:00Z');
 ASSERT jsonb_array_length(r->'turns')=0, 'explicit_reset_hides_old_context';
 SELECT jsonb_array_length(data->'entries') INTO n FROM public.whatsapp_herd_visible_books WHERE phone_number='990000000001';
 ASSERT n=0, 'reset_hides_old_book';
 SELECT count(*) INTO n FROM public.whatsapp_herd_books WHERE phone_number='990000000001';
 ASSERT n=1, 'reset_preserves_original_book';
 SELECT count(*) INTO n FROM public.whatsapp_herd_events WHERE phone_number='990000000001';
 ASSERT n=1, 'reset_preserves_original_events';
 SELECT count(*) INTO n FROM public.whatsapp_herd_visible_events WHERE phone_number='990000000001';
 ASSERT n=0, 'reset_hides_old_receipts';
 r := to_jsonb(public.commit_whatsapp_herd_turn('990000000001','2026-10-21',1,'context-regression-new','{"schema":1,"active":true,"batch":1,"entries":[],"procedures":[],"lastKey":null,"defaultSeries":null,"defaultSex":null,"reproductiveMode":false,"pending":null}','Novo livro','Nova geração'));
 ASSERT r='"committed"'::jsonb, 'new_generation_commits';
 SELECT count(*) INTO n FROM public.whatsapp_herd_book_archives WHERE phone_number='990000000001' AND data->'entries' @> '[{"code":"TESTE 1","weight":350}]';
 ASSERT n=1, 'old_snapshot_preserved';
END $$;
RESET ROLE;
SELECT jsonb_build_object('result','passed','checks',11,'rolled_back',true) AS regression;
ROLLBACK;
