-- Owner-scoped bookmarks of generated results, not copied garments or saved outfits.
BEGIN;
ALTER TABLE app_private.recommendation_results ADD CONSTRAINT recommendation_result_owner_identity UNIQUE(id,owner_id);
CREATE TABLE app_private.saved_recommendations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 recommendation_id uuid NOT NULL,
 saved_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(recommendation_id,owner_id) REFERENCES app_private.recommendation_results(id,owner_id) ON DELETE CASCADE,
 UNIQUE(owner_id,recommendation_id)
);
CREATE INDEX saved_recommendation_owner_recent ON app_private.saved_recommendations(owner_id,saved_at DESC,id DESC);
ALTER TABLE app_private.saved_recommendations OWNER TO dd_owner;
ALTER TABLE app_private.saved_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.saved_recommendations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.saved_recommendations FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,DELETE ON app_private.saved_recommendations TO dd_user_executor;
CREATE POLICY own_active ON app_private.saved_recommendations TO dd_user_executor
 USING(owner_id=app_private.request_subject() AND app_private.current_account_active()) WITH CHECK(owner_id=app_private.request_subject() AND app_private.current_account_active());
-- Row locks protect provenance during save. No actual history update is permitted.
GRANT UPDATE(id) ON app_private.recommendation_results TO dd_user_executor;
CREATE POLICY recommendation_history_immutable ON app_private.recommendation_results AS RESTRICTIVE FOR UPDATE TO dd_user_executor
 USING(true) WITH CHECK(false);
GRANT CREATE ON SCHEMA app_private TO dd_user_executor;

CREATE OR REPLACE FUNCTION app_private.recommendation_record(p_result app_private.recommendation_results,p_request app_private.recommendation_requests) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('id',p_result.id,'requestId',p_request.id,'name',p_request.occasion||' look '||p_result.rank,
 'description',array_to_string(p_result.reasons,' '),'occasion',p_request.occasion,'items',p_result.items,
 'garmentIds',coalesce((SELECT jsonb_agg(item->'garmentId' ORDER BY n) FROM jsonb_array_elements(p_result.items) WITH ORDINALITY x(item,n) WHERE item->>'source'='wardrobe'),'[]'::jsonb),
 'score',p_result.score,'reasons',to_jsonb(p_result.reasons),'engineVersion',p_request.engine_version,'generatedAt',p_request.created_at,
 'savedId',(SELECT id FROM app_private.saved_recommendations WHERE owner_id=app_private.request_subject() AND recommendation_id=p_result.id));
$$;

CREATE FUNCTION app_private.saved_recommendation_record(p_saved app_private.saved_recommendations) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE rec app_private.recommendation_results%ROWTYPE; run app_private.recommendation_requests%ROWTYPE; available boolean:=false;
BEGIN
 SELECT * INTO rec FROM app_private.recommendation_results WHERE id=p_saved.recommendation_id AND owner_id=app_private.request_subject();
 IF FOUND THEN
  available:=app_private.recommendation_visible(rec.items);
  SELECT * INTO run FROM app_private.recommendation_requests WHERE id=rec.request_id AND owner_id=app_private.request_subject();
 END IF;
 RETURN jsonb_build_object('id',p_saved.id,'recommendationId',p_saved.recommendation_id,'savedAt',p_saved.saved_at,
  'available',available,'recommendation',CASE WHEN available THEN app_private.recommendation_record(rec,run) ELSE NULL END);
END; $$;
ALTER FUNCTION app_private.saved_recommendation_record(app_private.saved_recommendations) OWNER TO dd_user_executor;

CREATE FUNCTION app_private.save_recommendation(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE rec app_private.recommendation_results%ROWTYPE; saved app_private.saved_recommendations%ROWTYPE;
 item jsonb; target uuid; inserted boolean;
BEGIN
 PERFORM app_private.require_active_account();
 SELECT * INTO rec FROM app_private.recommendation_results WHERE id=p_id AND owner_id=app_private.request_subject() FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Recommendation not found' USING ERRCODE='P0002'; END IF;
 -- Lock real sources, in deterministic order, before accepting the saved link.
 BEGIN
  FOR item IN SELECT value FROM jsonb_array_elements(rec.items) ORDER BY value->>'source',(value->>'garmentId')::uuid LOOP
   target:=(item->>'garmentId')::uuid;
   IF item->>'source'='wardrobe' THEN
    PERFORM 1 FROM app_private.wardrobe_garments WHERE id=target AND owner_id=app_private.request_subject() FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Source unavailable' USING ERRCODE='P0002'; END IF;
   ELSE PERFORM app_private.lock_outfit_catalog_item(target);
   END IF;
  END LOOP;
 EXCEPTION WHEN SQLSTATE 'P0002' THEN RAISE EXCEPTION 'Recommendation garments unavailable' USING ERRCODE='DD001';
 END;
 INSERT INTO app_private.saved_recommendations(owner_id,recommendation_id) VALUES(app_private.request_subject(),p_id)
 ON CONFLICT(owner_id,recommendation_id) DO NOTHING RETURNING * INTO saved;
 inserted:=FOUND;
 IF NOT inserted THEN SELECT * INTO saved FROM app_private.saved_recommendations WHERE owner_id=app_private.request_subject() AND recommendation_id=p_id; END IF;
 IF saved.id IS NULL THEN RAISE EXCEPTION 'Save changed concurrently' USING ERRCODE='DD001'; END IF;
 RETURN app_private.saved_recommendation_record(saved)||jsonb_build_object('created',inserted);
END; $$;
ALTER FUNCTION app_private.save_recommendation(uuid) OWNER TO dd_user_executor;

CREATE FUNCTION app_private.remove_saved_recommendation(p_id uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM app_private.require_active_account();
 DELETE FROM app_private.saved_recommendations WHERE id=p_id AND owner_id=app_private.request_subject();
 IF NOT FOUND THEN RAISE EXCEPTION 'Saved recommendation not found' USING ERRCODE='P0002'; END IF;
END; $$;
ALTER FUNCTION app_private.remove_saved_recommendation(uuid) OWNER TO dd_user_executor;

CREATE FUNCTION app_private.list_saved_recommendations(p_limit integer DEFAULT 24,p_cursor jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE saved app_private.saved_recommendations%ROWTYPE; items jsonb:='[]'::jsonb; position jsonb; count_rows integer:=0;
BEGIN
 IF NOT app_private.current_account_active() THEN RAISE EXCEPTION 'Account access denied' USING ERRCODE='42501'; END IF;
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid saved list limit' USING ERRCODE='22023'; END IF;
 IF p_cursor IS NOT NULL THEN
  IF jsonb_typeof(p_cursor)<>'object' OR NOT(p_cursor ? 'id' AND p_cursor ? 'savedAt') OR (p_cursor-'id'-'savedAt')<>'{}'::jsonb
   OR jsonb_typeof(p_cursor->'id')<>'string' OR jsonb_typeof(p_cursor->'savedAt')<>'string' THEN
   RAISE EXCEPTION 'Invalid saved cursor' USING ERRCODE='22023'; END IF;
  BEGIN
   PERFORM (p_cursor->>'id')::uuid;
   IF NOT isfinite((p_cursor->>'savedAt')::timestamptz) THEN RAISE EXCEPTION 'Invalid timestamp' USING ERRCODE='22023'; END IF;
  EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN
   RAISE EXCEPTION 'Invalid saved cursor' USING ERRCODE='22023'; END;
 END IF;
 FOR saved IN SELECT * FROM app_private.saved_recommendations WHERE owner_id=app_private.request_subject()
  AND (p_cursor IS NULL OR (saved_at,id)<((p_cursor->>'savedAt')::timestamptz,(p_cursor->>'id')::uuid))
  ORDER BY saved_at DESC,id DESC LIMIT p_limit+1
 LOOP
  count_rows:=count_rows+1;
  IF count_rows>p_limit THEN RETURN jsonb_build_object('items',items,'nextCursor',position); END IF;
  items:=items||jsonb_build_array(app_private.saved_recommendation_record(saved));
  position:=jsonb_build_object('id',saved.id,'savedAt',saved.saved_at);
 END LOOP;
 RETURN jsonb_build_object('items',items,'nextCursor',NULL);
END; $$;
ALTER FUNCTION app_private.list_saved_recommendations(integer,jsonb) OWNER TO dd_user_executor;

CREATE FUNCTION api.save_recommendation(p_id uuid) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.save_recommendation(p_id); $$;
CREATE FUNCTION api.remove_saved_recommendation(p_id uuid) RETURNS void
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.remove_saved_recommendation(p_id); $$;
CREATE FUNCTION api.list_saved_recommendations(p_limit integer DEFAULT 24,p_cursor jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.list_saved_recommendations(p_limit,p_cursor); $$;
DO $permissions$
DECLARE func regprocedure;
BEGIN
 FOR func IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN ('api','app_private') AND p.proname IN ('save_recommendation','remove_saved_recommendation','list_saved_recommendations','saved_recommendation_record') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',func);
  IF func::text NOT LIKE '%saved_recommendation_record(%' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',func); END IF;
 END LOOP;
END; $permissions$;
REVOKE CREATE ON SCHEMA app_private FROM dd_user_executor;
NOTIFY pgrst,'reload schema';
COMMIT;
