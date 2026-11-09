BEGIN;
ALTER TABLE app_private.saved_outfits ADD COLUMN origin_recommendation_id uuid;
ALTER TABLE app_private.saved_outfits ADD CONSTRAINT outfit_recommendation_provenance FOREIGN KEY(origin_recommendation_id,owner_id) REFERENCES app_private.recommendation_results(id,owner_id) ON DELETE SET NULL(origin_recommendation_id);
CREATE UNIQUE INDEX outfit_recommendation_once ON app_private.saved_outfits(owner_id,origin_recommendation_id) WHERE origin_recommendation_id IS NOT NULL;
GRANT DELETE ON app_private.saved_outfits TO dd_user_executor;
GRANT UPDATE(origin_recommendation_id) ON app_private.saved_outfits TO dd_user_executor;
CREATE POLICY outfit_owner_delete ON app_private.saved_outfits FOR DELETE TO dd_user_executor USING(owner_id=app_private.request_subject() AND app_private.current_account_active());
GRANT CREATE ON SCHEMA app_private TO dd_user_executor;
CREATE FUNCTION app_private.delete_outfit(p_id uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM app_private.require_active_account();
 DELETE FROM app_private.saved_outfits WHERE id=p_id AND owner_id=app_private.request_subject();
 IF NOT FOUND THEN RAISE EXCEPTION 'Outfit not found' USING ERRCODE='P0002'; END IF;
END; $$;
ALTER FUNCTION app_private.delete_outfit(uuid) OWNER TO dd_user_executor;
CREATE FUNCTION app_private.save_recommendation_outfit(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE rec app_private.recommendation_results%ROWTYPE;run app_private.recommendation_requests%ROWTYPE;existing app_private.saved_outfits%ROWTYPE;refs jsonb;result jsonb;
BEGIN
 PERFORM app_private.require_active_account();
 SELECT * INTO rec FROM app_private.recommendation_results WHERE id=p_id AND owner_id=app_private.request_subject() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Recommendation not found' USING ERRCODE='P0002'; END IF;
 SELECT * INTO existing FROM app_private.saved_outfits WHERE owner_id=app_private.request_subject() AND origin_recommendation_id=p_id;
 IF FOUND THEN RETURN app_private.outfit_record(existing); END IF;
 SELECT * INTO run FROM app_private.recommendation_requests WHERE id=rec.request_id AND owner_id=app_private.request_subject();
 SELECT jsonb_agg(jsonb_build_object('source',item->'source','garmentId',item->'garmentId') ORDER BY n) INTO refs FROM jsonb_array_elements(rec.items) WITH ORDINALITY x(item,n);
 result:=app_private.create_outfit(left(run.occasion||' look '||rec.rank,200),refs,left(array_to_string(rec.reasons,' '),2000),run.occasion);
 UPDATE app_private.saved_outfits SET origin_recommendation_id=p_id WHERE id=(result->>'id')::uuid AND owner_id=app_private.request_subject();
 RETURN result;
END; $$;
ALTER FUNCTION app_private.save_recommendation_outfit(uuid) OWNER TO dd_user_executor;
CREATE FUNCTION api.delete_outfit(p_id uuid) RETURNS void LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.delete_outfit(p_id); $$;
CREATE FUNCTION api.save_recommendation_outfit(p_id uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.save_recommendation_outfit(p_id); $$;
REVOKE ALL ON FUNCTION api.delete_outfit(uuid),app_private.delete_outfit(uuid),api.save_recommendation_outfit(uuid),app_private.save_recommendation_outfit(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION api.delete_outfit(uuid),app_private.delete_outfit(uuid),api.save_recommendation_outfit(uuid),app_private.save_recommendation_outfit(uuid) TO authenticated;
REVOKE CREATE ON SCHEMA app_private FROM dd_user_executor;
NOTIFY pgrst,'reload schema';
COMMIT;
