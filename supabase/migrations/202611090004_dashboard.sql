BEGIN;
GRANT CREATE ON SCHEMA app_private TO dd_user_executor;
CREATE FUNCTION app_private.dashboard() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT app_private.current_account_active() THEN RAISE EXCEPTION 'Account access denied' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('wardrobeCount',(SELECT count(*) FROM app_private.wardrobe_garments WHERE owner_id=app_private.request_subject()),
 'savedOutfitCount',(SELECT count(*) FROM app_private.saved_outfits WHERE owner_id=app_private.request_subject()),
 'recommendationCount',(SELECT count(*) FROM app_private.recommendation_results WHERE owner_id=app_private.request_subject()),
 'savedRecommendationCount',(SELECT count(*) FROM app_private.saved_recommendations WHERE owner_id=app_private.request_subject()),
 'tryOnJobCount',(SELECT count(*) FROM app_private.tryon_jobs WHERE owner_id=app_private.request_subject()));
END; $$;
ALTER FUNCTION app_private.dashboard() OWNER TO dd_user_executor;
CREATE FUNCTION api.dashboard() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.dashboard(); $$;
REVOKE ALL ON FUNCTION api.dashboard(),app_private.dashboard() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION api.dashboard(),app_private.dashboard() TO authenticated;
REVOKE CREATE ON SCHEMA app_private FROM dd_user_executor;
NOTIFY pgrst,'reload schema';
COMMIT;
