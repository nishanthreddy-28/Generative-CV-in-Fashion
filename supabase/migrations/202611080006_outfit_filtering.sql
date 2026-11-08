-- Filtered outfit reads only. Existing mutation and legacy read RPCs remain intact.
BEGIN;
CREATE INDEX outfit_owner_name ON app_private.saved_outfits(owner_id,name COLLATE "C",id);
GRANT CREATE ON SCHEMA app_private TO dd_user_executor;
CREATE FUNCTION app_private.query_outfits(p_limit integer DEFAULT 24,p_cursor jsonb DEFAULT NULL,
 p_search text DEFAULT '',p_source text DEFAULT '',p_category text DEFAULT '',p_sort text DEFAULT 'newest',
 p_created_from timestamptz DEFAULT NULL,p_created_before timestamptz DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE outfit app_private.saved_outfits%ROWTYPE; items jsonb:='[]'::jsonb; position jsonb; count_rows integer:=0;
BEGIN
 IF NOT app_private.current_account_active() THEN RAISE EXCEPTION 'Account access denied' USING ERRCODE='42501'; END IF;
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_search IS NULL OR char_length(p_search)>200
  OR p_source IS NULL OR p_source NOT IN ('','wardrobe','catalog') OR p_category IS NULL
  OR p_category NOT IN ('','Tops','Bottoms','Outerwear','Dresses','Shoes','Accessories')
  OR p_sort IS NULL OR p_sort NOT IN ('newest','name') OR NOT coalesce(isfinite(p_created_from),true)
  OR NOT coalesce(isfinite(p_created_before),true) OR p_created_from>=p_created_before THEN
  RAISE EXCEPTION 'Invalid outfit query' USING ERRCODE='22023'; END IF;
 IF p_cursor IS NOT NULL THEN
  IF jsonb_typeof(p_cursor)<>'object' OR NOT(p_cursor ? 'id' AND p_cursor ? 'createdAt')
   OR jsonb_typeof(p_cursor->'id')<>'string' OR jsonb_typeof(p_cursor->'createdAt')<>'string'
   OR (p_sort='name' AND (NOT(p_cursor ? 'name') OR jsonb_typeof(p_cursor->'name')<>'string' OR char_length(p_cursor->>'name')>200))
   OR (p_cursor-'id'-'createdAt'-'name')<>'{}'::jsonb THEN
   RAISE EXCEPTION 'Invalid outfit cursor' USING ERRCODE='22023'; END IF;
  BEGIN
   PERFORM (p_cursor->>'id')::uuid;
   IF NOT isfinite((p_cursor->>'createdAt')::timestamptz) THEN RAISE EXCEPTION 'Invalid timestamp' USING ERRCODE='22023'; END IF;
  EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN
   RAISE EXCEPTION 'Invalid outfit cursor' USING ERRCODE='22023'; END;
 END IF;
 FOR outfit IN SELECT o.* FROM app_private.saved_outfits o
 WHERE o.owner_id=auth.uid()
  AND (p_search='' OR strpos(lower(o.name),lower(btrim(p_search)))>0)
  AND (p_created_from IS NULL OR o.created_at>=p_created_from)
  AND (p_created_before IS NULL OR o.created_at<p_created_before)
  AND ((p_source='' AND p_category='') OR EXISTS (
   SELECT 1 FROM app_private.outfit_items i WHERE i.outfit_id=o.id AND i.owner_id=o.owner_id
   AND (p_source='' OR (p_source='wardrobe' AND i.wardrobe_garment_id IS NOT NULL) OR (p_source='catalog' AND i.catalog_garment_id IS NOT NULL))
   AND (p_category='' OR EXISTS(SELECT 1 FROM app_private.wardrobe_garments w WHERE w.id=i.wardrobe_garment_id AND w.owner_id=i.owner_id AND w.category=p_category)
    OR EXISTS(SELECT 1 FROM app_private.catalog_garments c WHERE c.id=i.catalog_garment_id AND c.category=p_category))
  ))
  AND (p_cursor IS NULL OR CASE WHEN p_sort='name' THEN
   (o.name COLLATE "C",o.id)>((p_cursor->>'name') COLLATE "C",(p_cursor->>'id')::uuid)
   ELSE (o.created_at,o.id)<((p_cursor->>'createdAt')::timestamptz,(p_cursor->>'id')::uuid) END)
 ORDER BY CASE WHEN p_sort='name' THEN o.name END COLLATE "C" ASC,
  CASE WHEN p_sort='newest' THEN o.created_at END DESC,
  CASE WHEN p_sort='name' THEN o.id END ASC,CASE WHEN p_sort='newest' THEN o.id END DESC LIMIT p_limit+1
 LOOP
  count_rows:=count_rows+1;
  IF count_rows>p_limit THEN RETURN jsonb_build_object('items',items,'nextCursor',position); END IF;
  items:=items||jsonb_build_array(app_private.outfit_record(outfit));
  position:=jsonb_build_object('id',outfit.id,'createdAt',outfit.created_at);
  IF p_sort='name' THEN position:=position||jsonb_build_object('name',outfit.name); END IF;
 END LOOP;
 RETURN jsonb_build_object('items',items,'nextCursor',NULL);
END; $$;
ALTER FUNCTION app_private.query_outfits(integer,jsonb,text,text,text,text,timestamptz,timestamptz) OWNER TO dd_user_executor;
CREATE FUNCTION api.query_outfits(p_limit integer DEFAULT 24,p_cursor jsonb DEFAULT NULL,
 p_search text DEFAULT '',p_source text DEFAULT '',p_category text DEFAULT '',p_sort text DEFAULT 'newest',
 p_created_from timestamptz DEFAULT NULL,p_created_before timestamptz DEFAULT NULL) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT app_private.query_outfits(p_limit,p_cursor,p_search,p_source,p_category,p_sort,p_created_from,p_created_before);
$$;
REVOKE ALL ON FUNCTION api.query_outfits(integer,jsonb,text,text,text,text,timestamptz,timestamptz),
 app_private.query_outfits(integer,jsonb,text,text,text,text,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION api.query_outfits(integer,jsonb,text,text,text,text,timestamptz,timestamptz),
 app_private.query_outfits(integer,jsonb,text,text,text,text,timestamptz,timestamptz) TO authenticated;
REVOKE CREATE ON SCHEMA app_private FROM dd_user_executor;
NOTIFY pgrst,'reload schema';
COMMIT;
