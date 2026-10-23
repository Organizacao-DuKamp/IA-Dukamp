-- Swap a fully prepared generation in one transaction; failures preserve previous chunks.
CREATE FUNCTION public.replace_knowledge_document_chunks(p_document_id uuid,p_expected_version integer,p_expected_hash text,p_chunks jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE doc public.knowledge_documents; n integer; item jsonb;
BEGIN
  SELECT * INTO doc FROM public.knowledge_documents WHERE id=p_document_id FOR UPDATE;
  IF NOT FOUND OR doc.version IS DISTINCT FROM p_expected_version OR doc.content_hash IS DISTINCT FROM p_expected_hash THEN RAISE EXCEPTION 'knowledge_source_changed'; END IF;
  IF jsonb_typeof(p_chunks) IS DISTINCT FROM 'array' OR jsonb_array_length(p_chunks) NOT BETWEEN 1 AND 2000 OR octet_length(p_chunks::text)>50000000 THEN RAISE EXCEPTION 'invalid_knowledge_generation'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_chunks) LOOP
    IF (item->>'document_id')::uuid IS DISTINCT FROM p_document_id OR length(item->>'content')<1 OR item->'metadata'->>'embedding_provider' IS NULL THEN RAISE EXCEPTION 'invalid_knowledge_chunk'; END IF;
  END LOOP;
  DELETE FROM public.knowledge_chunks WHERE document_id=p_document_id;
  INSERT INTO public.knowledge_chunks(document_id,chunk_index,content,embedding,metadata,category,subcategory,filename,title)
    SELECT c.document_id,c.chunk_index,c.content,c.embedding,c.metadata,c.category,c.subcategory,c.filename,c.title
    FROM jsonb_populate_recordset(NULL::public.knowledge_chunks,p_chunks) c;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.replace_knowledge_document_chunks(uuid,integer,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.replace_knowledge_document_chunks(uuid,integer,text,jsonb) TO service_role;
